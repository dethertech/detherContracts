pragma solidity ^0.5.10;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../interfaces/IERC223ReceivingContract.sol";
import "../interfaces/IDetherToken.sol";
import "../interfaces/IGeoRegistry.sol";
import "../interfaces/IZoneFactory.sol";
import "../interfaces/IZone.sol";
import "../interfaces/ITeller.sol";

contract Zone is IERC223ReceivingContract {
  // ------------------------------------------------
  //
  // Library init
  //
  // ------------------------------------------------

  using SafeMath for uint;

  // ------------------------------------------------
  //
  // Enums
  //
  // ------------------------------------------------

  enum AuctionState { Started, Ended }

  // ------------------------------------------------
  //
  // Structs
  //
  // ------------------------------------------------

  // NOTE:
  // evm will convert to uint256 when doing calculations, so 1 time higher storage cost
  // will be less than all the increased gas costs if we were to use smaller uints in the struct

  struct ZoneOwner {
    address addr;
    uint startTime;
    uint staked;
    uint balance;
    uint lastTaxTime;
    uint auctionId;
  }

  struct Auction {
    // since we do a lot of calcuations with these uints, it's best to leave them uint256
    // evm will convert to uint256 anyways when doing calculations
    uint startTime;
    uint endTime;
    AuctionState state;
    address highestBidder;
  }

  // ------------------------------------------------
  //
  // Variables Private
  //
  // ------------------------------------------------

  uint public constant MIN_STAKE = 100 * 1 ether; // DTH, which is also 18 decimals!
  uint private constant BID_PERIOD = 24 * 1 hours;
  uint private constant COOLDOWN_PERIOD = 48 * 1 hours;
  uint private constant ENTRY_FEE_PERCENTAGE = 5; // 1%
  uint private constant TAX_PERCENTAGE = 4; // 0,04% daily / around 15% yearly

  ZoneOwner private zoneOwner;

  mapping(uint => Auction) private auctionIdToAuction;

  // ------------------------------------------------
  //
  // Variables Public
  //
  // ------------------------------------------------

  bool private inited;
  bool private tellerConnected;

  IDetherToken public dth;
  IGeoRegistry public geo;
  IZoneFactory public zoneFactory;
  ITeller public teller;
  address public taxCollector;

  bytes2 public country;
  bytes6 public geohash;

  mapping(address => uint) public withdrawableDth;

  uint public currentAuctionId; // starts at 0, first auction will get id 1, etc.

  //      auctionId       bidder     dthAmount
  mapping(uint => mapping(address => uint)) public auctionBids;

  // ------------------------------------------------
  //
  // Events
  //
  // ------------------------------------------------

  event AuctionCreated(address indexed sender, uint auctionId, uint bidAmount);
  event AuctionEnded(address indexed newOwner, uint auctionId,  uint winingBid);
  event Bid(address indexed sender, uint auctionId, uint bidAmount);


  // ------------------------------------------------
  //
  // Modifiers
  //
  // ------------------------------------------------

  modifier onlyWhenInited() {
    require(inited == true, "contract not yet initialized");
    _;
  }
  modifier onlyWhenNotInited() {
    require(inited == false, "contract already initialized");
    _;
  }

  modifier onlyWhenTellerConnected() {
    require(tellerConnected == true, "teller contract not yet connected");
    _;
  }
  modifier onlyWhenTellerNotConnected() {
    require(tellerConnected == false, "teller contract already connected");
    _;
  }

  modifier onlyWhenZoneEnabled {
    require(geo.zoneIsEnabled(country), "country is disabled");
    _;
  }

  modifier updateState {
    _processState();
    _;
  }

  modifier onlyWhenZoneHasOwner {
    require(zoneOwner.addr != address(0), "zone has no owner");
    _;
  }

  modifier onlyWhenCallerIsNotZoneOwner {
    require(msg.sender != zoneOwner.addr, "can not be called by zoneowner");
    _;
  }

  modifier onlyWhenCallerIsZoneOwner {
    require(msg.sender == zoneOwner.addr, "caller is not zoneowner");
    _;
  }

  modifier onlyByTellerContract {
    require(msg.sender == address(teller), "can only be called by teller contract");
    _;
  }

  modifier onlyWhenZoneHasNoOwner {
    require(zoneOwner.addr == address(0), "can not claim zone with owner");
    _;
  }

  // ------------------------------------------------
  //
  // Constructor
  //
  // ------------------------------------------------

  // executed by ZoneFactory.sol when this Zone does not yet exist (= not yet deployed)
  function init(
    bytes2 _countryCode,
    bytes6 _geohash,
    address _zoneOwner,
    uint _dthAmount,
    address _dth,
    address _geo,
    address _zoneFactory,
    address _taxCollector
  )
    onlyWhenNotInited
    external
  {
    require(_dthAmount >= MIN_STAKE, "zone dth stake shoulld be at least minimum (100DTH)");

    country = _countryCode;
    geohash = _geohash;

    dth = IDetherToken(_dth);
    geo = IGeoRegistry(_geo);
    zoneFactory = IZoneFactory(_zoneFactory);
    taxCollector = _taxCollector;

    zoneOwner.addr = _zoneOwner;
    zoneOwner.startTime = now;
    zoneOwner.staked = _dthAmount;
    zoneOwner.balance = _dthAmount;
    zoneOwner.lastTaxTime = now;
    zoneOwner.auctionId = 0; // was not gained by winning an auction

    inited = true;
    currentAuctionId = 0;
  }

  function connectToTellerContract(address _teller)
    onlyWhenInited
    onlyWhenTellerNotConnected
    external
  {
    teller = ITeller(_teller);

    tellerConnected = true;
  }

  // ------------------------------------------------
  //
  // Functions Getters Public
  //
  // ------------------------------------------------

  function ownerAddr()
    external view
    returns (address)
  {
    return zoneOwner.addr;
  }

  function computeCSC(bytes6 _geohash, address _addr)
    public
    pure
    returns (bytes12)
  {
    return bytes12(keccak256(abi.encodePacked(_geohash, _addr)));
  }

  function calcHarbergerTax(uint _startTime, uint _endTime, uint _dthAmount)
    public
    view
    returns (uint taxAmount, uint keepAmount)
  {
    // TODO use smaller uint variables, hereby preventing under/overflows, so no need for SafeMath
    // source: https://programtheblockchain.com/posts/2018/09/19/implementing-harberger-tax-deeds/
    taxAmount = _dthAmount.mul(_endTime.sub(_startTime)).mul(TAX_PERCENTAGE).div(10000).div(1 days);
    keepAmount = _dthAmount.sub(taxAmount);
  }

  function calcEntryFee(uint _value)
    public
    view
    returns (uint burnAmount, uint bidAmount)
  {
    burnAmount = _value.div(100).mul(ENTRY_FEE_PERCENTAGE); // 1%
    bidAmount = _value.sub(burnAmount); // 99%
  }

  function auctionExists(uint _auctionId)
    external
    view
    returns (bool)
  {
    // if aucton does not exist we should get back zero, otherwise this field
    // will contain a block.timestamp, set whe creating an Auction, in constructor() and bid()
    return auctionIdToAuction[_auctionId].startTime > 0;
  }

  /// @notice get current zone owner data
  function getZoneOwner()
    external
    view
    returns (address, uint, uint, uint, uint, uint)
  {
    return (
      zoneOwner.addr,        // address of current owner
      zoneOwner.startTime,   // time this address became owner
      zoneOwner.staked,      // "price you sell at"
      zoneOwner.balance,     // will decrease whenever harberger taxes are paid
      zoneOwner.lastTaxTime, // time until taxes have been paid
      zoneOwner.auctionId    // if gained by winning auction, the auction id, otherwise zero
    );
  }

  /// @notice get a specific auction
  function getAuction(uint _auctionId)
    public
    view
    returns (uint, uint, uint, uint, address, uint)
  {
    require(_auctionId > 0 && _auctionId <= currentAuctionId, "auction does not exist");

    Auction memory auction = auctionIdToAuction[_auctionId];

    uint highestBid = auctionBids[_auctionId][auction.highestBidder];

    // for current zone owner his existing zone stake is added to his bid
    if (auction.state == AuctionState.Started &&
        auction.highestBidder == zoneOwner.addr)
    {
      highestBid = highestBid.add(zoneOwner.staked);
    }

    return (
      _auctionId,
      uint(auction.state),
      auction.startTime,
      auction.endTime,
      auction.highestBidder,
      highestBid
    );
  }

  /// @notice get the last auction
  function getLastAuction()
    external view
    returns (uint, uint, uint, uint, address, uint)
  {
    return getAuction(currentAuctionId);
  }

  // ------------------------------------------------
  //
  // Functions Utils
  //
  // ------------------------------------------------

  function toBytes1(bytes memory _bytes, uint _start)
    private pure
    returns (bytes1) {
      require(_bytes.length >= (_start + 1), " not long enough");
      bytes1 tempBytes1;

      assembly {
          tempBytes1 := mload(add(add(_bytes, 0x20), _start))
      }

      return tempBytes1;
  }
  function toBytes7(bytes memory _bytes, uint _start)
    private pure
    returns (bytes7) {
      require(_bytes.length >= (_start + 7), " not long enough");
      bytes7 tempBytes7;

      assembly {
          tempBytes7 := mload(add(add(_bytes, 0x20), _start))
      }

      return tempBytes7;
  }
    function toBytes6(bytes memory _bytes, uint _start)
    private
    pure
    returns (bytes6)
  {
    require(_bytes.length >= (_start + 6), " not long enough");
    bytes6 tempBytes6;

    assembly {
        tempBytes6 := mload(add(add(_bytes, 0x20), _start))
    }

    return tempBytes6;
  }
  function toBytes12(bytes memory _bytes, uint _start)
    private pure
    returns (bytes12) {
      require(_bytes.length >= (_start + 12), " not long enough");
      bytes12 tempBytes12;

      assembly {
          tempBytes12 := mload(add(add(_bytes, 0x20), _start))
      }

      return tempBytes12;
  }

  // ------------------------------------------------
  //
  // Functions Setters Private
  //
  // ------------------------------------------------

  function _removeZoneOwner()
    private
  {
    withdrawableDth[zoneOwner.addr] = withdrawableDth[zoneOwner.addr].add(zoneOwner.balance);

    if (teller.hasTeller()) {
      teller.removeTellerByZone();
    }
    zoneFactory.changeOwner(address(0), zoneOwner.addr);
    zoneOwner.addr = address(0);
    zoneOwner.startTime = 0;
    zoneOwner.staked = 0;
    zoneOwner.balance = 0;
    zoneOwner.lastTaxTime = 0;
    zoneOwner.auctionId = 0;
  }
  /*
   * calculate harberger taxes and send dth to taxCollector and referrer (if exist)
   */
  function _handleTaxPayment()
    private
  {
    // processState ensured that: no running auction + there is a zone owner

    if (zoneOwner.lastTaxTime >= now) {
      return; // short-circuit: multiple txes in 1 block OR many blocks but in same Auction
    }

    (uint taxAmount, uint keepAmount) = calcHarbergerTax(zoneOwner.lastTaxTime, now, zoneOwner.staked);

    if (taxAmount >= zoneOwner.balance) {
      // zone owner does not have enough balance, remove him as zone owner
      uint oldZoneOwnerBalance = zoneOwner.balance;
            (address referrer, uint refFee) = teller.getReferrer();
      _removeZoneOwner();
      dth.transfer(taxCollector, oldZoneOwnerBalance);
    } else {
      // zone owner can pay due taxes
      zoneOwner.balance = zoneOwner.balance.sub(taxAmount);
      zoneOwner.lastTaxTime = now;
      (address referrer, uint refFee) = teller.getReferrer();
      if (referrer != address(0x00) && refFee > 0) {
        uint referralFee =  taxAmount.mul(refFee).div(1000) ;
        dth.transfer(referrer, referralFee);
        dth.transfer(taxCollector, taxAmount - referralFee);
      } else {
        dth.transfer(taxCollector, taxAmount);
      }
    }
  }

  /*
   * Called when auction is ended by _processState()
   * update the state with new owner and new bid
   */
  function _endAuction()
    private
  {
    Auction storage lastAuction = auctionIdToAuction[currentAuctionId];

    lastAuction.state = AuctionState.Ended;

    uint highestBid = auctionBids[currentAuctionId][lastAuction.highestBidder];
    uint auctionEndTime = auctionIdToAuction[currentAuctionId].endTime;

    if (zoneOwner.addr == lastAuction.highestBidder) {
      // current zone owner won the auction, extend his zone ownershp
      zoneOwner.staked = zoneOwner.staked.add(highestBid);
      zoneOwner.balance = zoneOwner.balance.add(highestBid);

      // need to set it since it might've been zero
      zoneOwner.auctionId = currentAuctionId; // the (last) auctionId that gave the zoneOwner zone ownership
    } else {
      // we need to update the zone owner
      _removeZoneOwner();
      zoneFactory.changeOwner(lastAuction.highestBidder, zoneOwner.addr);
      zoneOwner.addr = lastAuction.highestBidder;
      zoneOwner.startTime = auctionEndTime;
      zoneOwner.staked = highestBid; // entry fee is already deducted when user calls bid()
      zoneOwner.balance = highestBid;
      zoneOwner.auctionId = currentAuctionId; // the auctionId that gave the zoneOwner zone ownership
    }

    // (new) zone owner needs to pay taxes from the moment he acquires zone ownership until now
    (uint taxAmount, uint keepAmount) = calcHarbergerTax(auctionEndTime, now, zoneOwner.staked);
    zoneOwner.balance = zoneOwner.balance.sub(taxAmount);
    zoneOwner.lastTaxTime = now;
    emit AuctionEnded(lastAuction.highestBidder, currentAuctionId,  highestBid);
  }
  function processState()
    external
    /* onlyByTellerContract */
  {
    _processState();
  }

  /// @notice private function to update the current auction state
  function _processState()
    private
  {
    if (currentAuctionId > 0 && auctionIdToAuction[currentAuctionId].state == AuctionState.Started) {
      // while uaction is running, no taxes need to be paid

      // handling of taxes around change of zone ownership are handled inside _endAuction
      if (now >= auctionIdToAuction[currentAuctionId].endTime) _endAuction();
    } else { // no running auction, currentAuctionId could be zero
      if (zoneOwner.addr != address(0)) _handleTaxPayment();
    }
  }

  function _joinAuction(address _sender, uint _dthAmount)
    private
  {
    Auction storage lastAuction = auctionIdToAuction[currentAuctionId];

    //------------------------------------------------------------------------------//
    // there is a running auction, lets see if we can join the auction with our bid //
    //------------------------------------------------------------------------------//

    require(_sender != lastAuction.highestBidder, "highest bidder cannot bid");

    uint currentHighestBid = auctionBids[currentAuctionId][lastAuction.highestBidder];

    if (_sender == zoneOwner.addr) {
      uint dthAddedBidsAmount = auctionBids[currentAuctionId][_sender].add(_dthAmount); 
      // the current zone owner's stake also counts in his bid
      require(zoneOwner.staked.add(dthAddedBidsAmount) > currentHighestBid, "bid + already staked is less than current highest");
      auctionBids[currentAuctionId][_sender] = dthAddedBidsAmount;
    } else {
      // _sender is not the current zone owner
      if (auctionBids[currentAuctionId][_sender] == 0) {
        // this is the first bid of this challenger, deduct entry fee
        (uint burnAmount, uint bidAmount) = calcEntryFee(_dthAmount);
        require(bidAmount > currentHighestBid, "bid is less than current highest");
        auctionBids[currentAuctionId][_sender] = bidAmount;
        dth.transfer(taxCollector, burnAmount);
      } else {
        // not the first bid, no entry fee
        uint newUserTotalBid = auctionBids[currentAuctionId][_sender].add(_dthAmount);
        require(newUserTotalBid > currentHighestBid, "bid is less than current highest");
        auctionBids[currentAuctionId][_sender] = newUserTotalBid;
      }
    }

    // it worked, _sender placed a bid
    lastAuction.highestBidder = _sender;
    emit Bid(_sender, _dthAmount, currentAuctionId);
  }
  function _createAuction(address _sender, uint _dthAmount)
    private
  {
    require(_sender != zoneOwner.addr, "zoneowner cannot start an auction");

    (uint burnAmount, uint bidAmount) = calcEntryFee(_dthAmount);
    require(bidAmount > zoneOwner.staked, "bid is lower than current zone stake");

    // save the new Auction
    uint newAuctionId = ++currentAuctionId;

    auctionIdToAuction[newAuctionId] = Auction({
      state: AuctionState.Started,
      startTime: now,
      endTime: now.add(BID_PERIOD),
      highestBidder: _sender // caller (challenger)
    });

    auctionBids[newAuctionId][_sender] = bidAmount;

    dth.transfer(taxCollector, burnAmount);
    emit AuctionCreated(_sender, _dthAmount, newAuctionId);
  }
  /// @notice private function to update the current auction state
  function _bid(address _sender, uint _dthAmount) // GAS COST +/- 223.689
    private
    onlyWhenZoneHasOwner
  {
    if (currentAuctionId > 0 && auctionIdToAuction[currentAuctionId].state == AuctionState.Started) {
      _joinAuction(_sender, _dthAmount);
    } else { // there currently is no running auction
      if (zoneOwner.auctionId == 0) {
        // current zone owner did not become owner by winning an auction, but by creating this zone or caliming it when it was free
        require(now > zoneOwner.startTime.add(COOLDOWN_PERIOD), "cooldown period did not end yet");
      } else {
        // current zone owner became owner by winning an auction (which has ended)
        require(now > auctionIdToAuction[currentAuctionId].endTime.add(COOLDOWN_PERIOD), "cooldown period did not end yet");
      }
      _createAuction(_sender, _dthAmount);
    }
  }

  function _claimFreeZone(address _sender, uint _dthAmount) // GAS COSt +/- 177.040
    private
    onlyWhenZoneHasNoOwner
  {
    require(_dthAmount >= MIN_STAKE, "need at least minimum zone stake amount (100 DTH)");

    // NOTE: empty zone claim will not have entry fee deducted, its not bidding it's taking immediately
    zoneFactory.changeOwner(_sender, zoneOwner.addr);
    zoneOwner.addr = _sender;
    zoneOwner.startTime = now;
    zoneOwner.staked = _dthAmount;
    zoneOwner.balance = _dthAmount;
    zoneOwner.lastTaxTime = now;
    zoneOwner.auctionId = 0; // since it was not gained wby winning an auction
  }

  function _topUp(address _sender, uint _dthAmount) // GAS COST +/- 104.201
    private
    onlyWhenZoneHasOwner
  {
    require(_sender == zoneOwner.addr, "caller is not zoneowner");
    require(currentAuctionId == 0 || auctionIdToAuction[currentAuctionId].state == AuctionState.Ended, "cannot top up while auction running");

    uint oldBalance = zoneOwner.balance;
    uint newBalance = oldBalance.add(_dthAmount);
    zoneOwner.balance = newBalance;

    // a zone owner can currently keep calling this to increase his dth balance inside the zone
    // without a change in his sell price (= zone.staked) or tax amount he needs to pay
  }

  // ------------------------------------------------
  //
  // Functions Setters Public
  //
  // ------------------------------------------------

  /// @notice ERC223 receiving function called by Dth contract when Eth is sent to this contract
  /// @param _from Who send DTH to this contract
  /// @param _value How much DTH was sent to this contract
  /// @param _data Additional bytes data sent
  function tokenFallback(address _from, uint _value, bytes memory _data)
    public
    onlyWhenInited
    onlyWhenTellerConnected
    onlyWhenZoneEnabled
  {
    require(msg.sender == address(dth), "can only be called by dth contract");

    bytes1 func = toBytes1(_data, 0);

    require(func == bytes1(0x40) || func == bytes1(0x41) || func == bytes1(0x42) || func == bytes1(0x43), "did not match Zone function");

    if (func == bytes1(0x40)) { // zone was created by factory, sending through DTH
      return; // just retun success
    }

    _processState();

    if (func == bytes1(0x41)) { // claimFreeZone
      _claimFreeZone(_from, _value);
    } else if (func == bytes1(0x42)) { // bid
      _bid(_from, _value);
    } else if (func == bytes1(0x43)) { // topUp
      _topUp(_from, _value);
    }
  }

  /// @notice release zone ownership
  /// @dev can only be called by current zone owner, when there is no running auction
  function release() // GAS COST +/- 72.351
    external
    onlyWhenInited
    onlyWhenTellerConnected
    updateState
    onlyWhenCallerIsZoneOwner
  {
    // allow also when country is disabled, otherwise no way for zone owner to get their eth/dth back

    require(currentAuctionId == 0 || auctionIdToAuction[currentAuctionId].state == AuctionState.Ended, "cannot release while auction running");

    uint ownerBalance = zoneOwner.balance;

    _removeZoneOwner();

    // if msg.sender is a contract, the DTH ERC223 contract will try to call tokenFallback
    // on msg.sender, this could lead to a reentrancy. But we prevent this by resetting
    // zoneOwner before we do dth.transfer(msg.sender)
    dth.transfer(msg.sender, ownerBalance);
  }

  // offer three different withdraw functions, single auction, multiple auctions, all auctions

  /// @notice withdraw losing bids from a specific auction
  /// @param _auctionId The auction id
  function withdrawFromAuction(uint _auctionId) // GAS COST +/- 125.070
    external
    onlyWhenInited
    onlyWhenTellerConnected
    updateState
  {
    // even when country is disabled, otherwise users cannot withdraw their bids
    require(_auctionId > 0 && _auctionId <= currentAuctionId, "auctionId does not exist");

    require(auctionIdToAuction[_auctionId].state == AuctionState.Ended, "cannot withdraw while auction is active");
    require(auctionIdToAuction[_auctionId].highestBidder != msg.sender, "auction winner can not withdraw");
    require(auctionBids[_auctionId][msg.sender] > 0, "nothing to withdraw");

    uint withdrawAmount = auctionBids[_auctionId][msg.sender];
    auctionBids[_auctionId][msg.sender] = 0;

    dth.transfer(msg.sender, withdrawAmount);
  }

  /// @notice withdraw from a given list of auction ids
  function withdrawFromAuctions(uint[] calldata _auctionIds) // GAS COST +/- 127.070
    external
    onlyWhenInited
    onlyWhenTellerConnected
    updateState
  {
    // even when country is disabled, can withdraw
    require(currentAuctionId > 0, "there are no auctions");

    require(_auctionIds.length > 0, "auctionIds list is empty");
    require(_auctionIds.length <= currentAuctionId, "auctionIds list is longer than allowed");

    uint withdrawAmountTotal = 0;

    for (uint idx = 0; idx < _auctionIds.length; idx++) {
      uint auctionId = _auctionIds[idx];
      require(auctionId > 0 && auctionId <= currentAuctionId, "auctionId does not exist");
      require(auctionIdToAuction[auctionId].state == AuctionState.Ended, "cannot withdraw from running auction");
      require(auctionIdToAuction[auctionId].highestBidder != msg.sender, "auction winner can not withdraw");
      uint withdrawAmount = auctionBids[auctionId][msg.sender];
      if (withdrawAmount > 0) {
        // if user supplies the same auctionId multiple times in auctionIds,
        // only the first one will get a withdrawal amount
        auctionBids[auctionId][msg.sender] = 0;
        withdrawAmountTotal = withdrawAmountTotal.add(withdrawAmount);
      }
    }

    require(withdrawAmountTotal > 0, "nothing to withdraw");

    dth.transfer(msg.sender, withdrawAmountTotal);
  }

  // - bids in past auctions
  // - zone owner stake
  function withdrawDth()
    external
    onlyWhenInited
    onlyWhenTellerConnected
    updateState
  {
    uint dthWithdraw = withdrawableDth[msg.sender];
    require(dthWithdraw > 0, "nothing to withdraw");

    if (dthWithdraw > 0) {
      withdrawableDth[msg.sender] = 0;
      dth.transfer(msg.sender, dthWithdraw);
    }
  }
}
