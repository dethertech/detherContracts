pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../dth/tokenfoundry/ERC223ReceivingContract.sol";
import "../dth/IDetherToken.sol";// TODO: replace with zeppelin ERC20 abstract contract?
import "../core/IUsers.sol";
import "../core/IControl.sol";
import "./IGeoRegistry.sol";
import "./IZoneFactory.sol";
// import "./IZone.sol"; TODO

contract Zone is ERC223ReceivingContract {
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
  }

  struct Auction {
    // since we do a lot of calcuations with these uints, it's best to leave them uint256
    // evm will convert to uint256 anyways when doing calculations
    uint startTime;
    uint endTime;
    AuctionState state;
    address highestBidder;
  }

  struct Teller {
    uint8 currencyId;  // 1 - 100 , see README
    bytes16 messenger; // telegrame nickname
    bytes10 position;  // 10 char geohash for location of teller
    bytes1 settings;   // bitmask containing up to 8 boolean settings (only 2 used currently: isSeller, isBuyer)
    // TODO: wouldn't it be wiser to use uint256, to make all calculations cost less
    int16 buyRate;     // margin of tellers , -999 - +9999 , corresponding to -99,9% x 10  , 999,9% x 10
    int16 sellRate;    // margin of tellers , -999 - +9999 , corresponding to -99,9% x 10  , 999,9% x 10
    // 256 bits in total
    address referrer;
  }

  // ------------------------------------------------
  //
  // Variables Private
  //
  // ------------------------------------------------

  uint private constant MIN_STAKE = 100 * 1 ether; // DTH, which is also 18 decimals!
  uint private constant BID_PERIOD = 24 * 1 hours;
  uint private constant COOLDOWN_PERIOD = 48 * 1 hours;
  uint private constant ENTRY_FEE_PERCENTAGE = 1; // 1%
  uint private constant TAX_PERCENTAGE = 1; // 1%
  uint private constant REFERRER_FEE_PERCENTAGE = 1; // 0.1%
  address private constant ADDRESS_BURN = 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF;

  ZoneOwner private zoneOwner;

  mapping(uint => Auction) private auctionIdToAuction;

  Teller private teller;
  bytes1 private constant isSellerBitMask = hex"01";
  bytes1 private constant isBuyerBitMask = hex"02";

  // ------------------------------------------------
  //
  // Variables Public
  //
  // ------------------------------------------------

  IDetherToken public dth;
  IGeoRegistry public geo;
  IUsers public users;
  IControl public control;
  IZoneFactory public zoneFactory;

  bytes2 public country;
  bytes7 public geohash;

  mapping(address => uint) public withdrawableDth;
  mapping(address => uint) public withdrawableEth;

  uint public currentAuctionId;

  //      auctionId       bidder     dthAmount
  mapping(uint => mapping(address => uint)) public auctionBids;

  //(prev)zoneOwner          ethAmount
  mapping(address => uint) public funds;

  // ------------------------------------------------
  //
  // Events
  //
  // ------------------------------------------------

  event ZoneCreated(address indexed zoneAddress, bytes2 indexed countryCode, bytes7 indexed geohash, uint dthAmount);
  event ZoneOwnerUpdated(address indexed zoneAddress, address indexed oldOwner, address indexed newOwner);
  event ZoneOwnerForeClosed(address indexed owner, uint lifeStart, uint lifeEnd, uint taxPaidTotal, uint taxDebtOutstanding);
  event ZoneOwnerTaxesPaid(address indexed owner, uint taxStart, uint taxEnd, uint taxAmount);
  event ZoneOwnerTopUp(address indexed owner, uint oldBalance, uint newBalance);
  event ZoneAuctionStarted(address indexed auctionId, uint lifeStart);
  event ZoneAuctionEnded(address indexed auctionId, uint lifeEnd, address indexed newOwner);
  event ZoneAuctionBid(address indexed auctionId, address indexed bidder, uint bidAmount); // NOTE: this includes current stake if zone owner bids
  event ZoneUpdatedTeller(address indexed owner);

  // ------------------------------------------------
  //
  // Constructor
  //
  // ------------------------------------------------

  // executed by ZoneFactory.sol when this Zone does not yet exist (= not yet deployed)
  constructor(
    bytes2 _countryCode,
    bytes7 _geohash,
    address _zoneOwner,
    uint _dthAmount,
    address _dth,
    address _geo,
    address _users,
    address _control,
    address _zoneFactory
  )
    public
  {
    require(_dthAmount >= MIN_STAKE, "zone dth stake shoulld be at least minimum (100DTH)");

    country = _countryCode;
    geohash = _geohash;

    dth = IDetherToken(_dth);
    geo = IGeoRegistry(_geo);
    users = IUsers(_users);
    control = IControl(_control);
    zoneFactory = IZoneFactory(_zoneFactory);

    zoneOwner.addr = _zoneOwner;
    zoneOwner.startTime = now;
    zoneOwner.staked = _dthAmount;
    zoneOwner.balance = _dthAmount;
    zoneOwner.lastTaxTime = now;

    // create a Sentinel Auction for the user that first creates this Zone
    Auction memory sentinelAuction = Auction({
      state: AuctionState.Ended,
      startTime: now,
      endTime: now,
      highestBidder: _zoneOwner // called by zoneFactory.createAndClaim, which passes msg.sender as _zoneOwner
    });
    auctionIdToAuction[currentAuctionId] = sentinelAuction;

    auctionBids[currentAuctionId][_zoneOwner] = _dthAmount;

    emit ZoneCreated(address(this), _countryCode, _geohash, _dthAmount);
    emit ZoneOwnerUpdated(address(this), address(0), _zoneOwner);
  }

  // ------------------------------------------------
  //
  // Functions Getters Public
  //
  // ------------------------------------------------

  function computeCSC(bytes7 _geohash, address _addr)
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
    taxAmount = _dthAmount.mul(_endTime.sub(_startTime)).mul(TAX_PERCENTAGE).div(100).div(1 days);
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

  function calcReferrerFee(uint _value)
    public
    view
    returns (uint referrerAmount)
  {
    referrerAmount = _value.div(1000).mul(REFERRER_FEE_PERCENTAGE); // 0.1%
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
    returns (address, uint, uint, uint, uint)
  {
    return (
      zoneOwner.addr,       // address of current owner
      zoneOwner.startTime,  // time this address became owner
      zoneOwner.staked,     // "price you sell at"
      zoneOwner.balance,    // will decrease whenever harberger taxes are paid
      zoneOwner.lastTaxTime // time until taxes have been paid
    );
  }

  /// @notice get a specific auction
  function getAuction(uint _auctionId)
    public
    view
    returns (uint, uint, uint, uint, address, uint)
  {
    Auction memory auction = auctionIdToAuction[_auctionId];

    uint highestBid = auctionBids[_auctionId][auction.highestBidder];
    // for current zone owner his existing zone stake is added to his bid
    if (auction.highestBidder == zoneOwner.addr) highestBid = highestBid.add(zoneOwner.staked);

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
    external
    view
    returns (uint, uint, uint, uint, address, uint)
  {
    return getAuction(currentAuctionId);
  }

  function getTeller()
    external
    view
    returns (uint8, bytes16, bytes10, bytes1, int16, int16, uint, address)
  {
    return (
      teller.currencyId,
      teller.messenger,
      teller.position,
      teller.settings,
      teller.buyRate,
      teller.sellRate,
      funds[zoneOwner.addr],
      teller.referrer
    );
  }

  // ------------------------------------------------
  //
  // Functions Getters Private
  //
  // ------------------------------------------------

  function toBytes1(bytes _bytes, uint _start)
    private
    pure
    returns (bytes1) {
      require(_bytes.length >= (_start + 1), " not long enough");
      bytes1 tempBytes1;

      assembly {
          tempBytes1 := mload(add(add(_bytes, 0x20), _start))
      }

      return tempBytes1;
  }
  function toBytes7(bytes _bytes, uint _start)
    private
    pure
    returns (bytes7) {
      require(_bytes.length >= (_start + 7), " not long enough");
      bytes7 tempBytes7;

      assembly {
          tempBytes7 := mload(add(add(_bytes, 0x20), _start))
      }

      return tempBytes7;
  }
  function toBytes10(bytes _bytes, uint _start)
    private
    pure
    returns (bytes10) {
      require(_bytes.length >= (_start + 10), " not long enough");
      bytes10 tempBytes10;

      assembly {
          tempBytes10 := mload(add(add(_bytes, 0x20), _start))
      }

      return tempBytes10;
  }

  // ------------------------------------------------
  //
  // Functions Setters Private
  //
  // ------------------------------------------------

  function _handleTaxPayment()
    private
  {
    Auction storage lastAuction = auctionIdToAuction[currentAuctionId];

    uint taxEndTime; // set depending on current auction state
    uint taxStartTime = zoneOwner.lastTaxTime; // always keep track of time until taxes are paid
    uint taxableAmount = zoneOwner.staked;     // you pay taxes over "the price you sell at"

    // Auction state did not change in this transaction/block!!
    // current Auction is in state Started or Ended
    if (lastAuction.state == AuctionState.Started) {
      // if there is a current auction, taxes need to be paid until auction start time
      taxEndTime = lastAuction.startTime;
      if (taxStartTime == taxEndTime) {
        return; // short-circuit: multiple txes in 1 block OR many blocks but in same Auction
      }
    } else if (lastAuction.state == AuctionState.Ended) {
      // if there is NO current auction, measure tax until "now"
      taxEndTime = now;
      if (taxStartTime == taxEndTime) {
        return; // short-circuit: multiple txes in 1 block
      }
    }
    // ANY auction has to be in one of those 2 states, first auction ever (constructor()) starts in state Ended

    uint taxAmount;
    uint keepAmount;
    (taxAmount, keepAmount) = calcHarbergerTax(taxStartTime, taxEndTime, taxableAmount);

    if (taxAmount >= zoneOwner.balance) {
      // zone owner DOES NOT have anough balance to be owner any longer

      // set tax amount to max he can pay
      uint taxDebt = taxAmount.sub(zoneOwner.balance); // TODO: what to do with debt, just forget about it?
      taxAmount = zoneOwner.balance;

      address prevOwnerAddr = zoneOwner.addr;

      // reset zone owner to nobody, somebody can now call claimFreeZone() with 100DTH
      zoneOwner.addr = address(0);
      zoneOwner.startTime = 0;
      zoneOwner.staked = 0;
      zoneOwner.balance = 0;
      zoneOwner.lastTaxTime = 0;

      emit ZoneOwnerTaxesPaid(zoneOwner.addr, taxStartTime, taxEndTime, taxAmount);
      emit ZoneOwnerForeClosed(zoneOwner.addr, zoneOwner.startTime, taxEndTime, taxableAmount, taxDebt);
      emit ZoneOwnerUpdated(address(this), prevOwnerAddr, zoneOwner.addr);
    } else {
      // zone onwer has enough balance to pay his harberger taxes

      zoneOwner.balance = zoneOwner.balance.sub(taxAmount);
      zoneOwner.lastTaxTime = taxEndTime;

      emit ZoneOwnerTaxesPaid(zoneOwner.addr, taxStartTime, taxEndTime, taxAmount);
    }

    dth.transfer(ADDRESS_BURN, taxAmount);
  }

  function _handleAuctionEnd()
    private
  {
    Auction storage lastAuction = auctionIdToAuction[currentAuctionId];

    // 1. update current Auction state to Ended
    lastAuction.state = AuctionState.Ended;

    // 2. collect winning bidder address
    address winningBidder = lastAuction.highestBidder;

    // 3. collect winning bid amount
    uint winningAmount = auctionBids[currentAuctionId][winningBidder];

    // 4. reset winning bidders bid in Auction
    auctionBids[currentAuctionId][winningBidder] = 0;

    // 5. calc harberger tax of current zoneOwner
    uint taxAmount;
    uint keepAmount;
    (taxAmount, keepAmount) = calcHarbergerTax(zoneOwner.lastTaxTime, lastAuction.startTime, zoneOwner.staked);

    // 6. check if highest bidder is current zone owner or not
    if (zoneOwner.addr == winningBidder) {
      // 6a. highest bidder is current zone owner

      // 6a.1 update zone owner info (current zone owner always has his stake amount added to all his bids)
      zoneOwner.staked = zoneOwner.staked.add(winningAmount);
      zoneOwner.balance = zoneOwner.balance.add(winningAmount);
      zoneOwner.lastTaxTime = now;
    } else {
      // 6b. winning bidder differs from current zone owner

      address prevOwnerAddr = zoneOwner.addr;

      // 6b.1 make the winnig bidder the new zoneOwner
      zoneOwner.addr = winningBidder;
      zoneOwner.startTime = lastAuction.endTime;
      zoneOwner.staked = winningAmount; // entry fee is already deducted when user calls bid()
      zoneOwner.balance = winningAmount;
      zoneOwner.lastTaxTime = now;

      // 6b.2 make left-over staked DTH of old zone owner withdrawable
      withdrawableDth[prevOwnerAddr] = withdrawableDth[prevOwnerAddr].add(keepAmount);

      // 6b.3 make added eth funds withdrawable
      uint ethAmount = funds[prevOwnerAddr];
      funds[prevOwnerAddr] = 0;
      withdrawableEth[prevOwnerAddr] = withdrawableEth[prevOwnerAddr].add(ethAmount);

      emit ZoneOwnerUpdated(address(this), prevOwnerAddr, winningBidder);
    }

    // 7. burn the tax amount
    dth.transfer(ADDRESS_BURN, taxAmount);
  }

  /// @notice private function to update the current auction state
  function _processState()
    private
  {
    Auction memory lastAuction = auctionIdToAuction[currentAuctionId];

    if (lastAuction.state == AuctionState.Started && now >= lastAuction.endTime) {
      // current Auction is still set to Started and endTime has passed, we need to update it to Ended
      _handleAuctionEnd();
    } else if (zoneOwner.addr != address(0)) {
      // there is currently a zone owner, check/handle his tax payment
      _handleTaxPayment();
    }
  }

  /// @notice private function to update the current auction state
  function _bid(address _sender, uint _dthAmount) // GAS COST +/- 223.689
    private
  {
    require(zoneOwner.addr != address(0), "cannot bid on zone without owner, use claimFreeZone()");

    uint burnAmount;
    uint bidAmount;

    Auction storage lastAuction = auctionIdToAuction[currentAuctionId];

    if (lastAuction.state == AuctionState.Ended) {
      //---------------------------------------------//
      // let's see if sender can start a new Auction //
      //---------------------------------------------//

      require(now > lastAuction.endTime.add(COOLDOWN_PERIOD), "cooldown period did not end yet");
      require(_sender != zoneOwner.addr, "zoneowner cannot start an auction");

      (burnAmount, bidAmount) = calcEntryFee(_dthAmount);
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

      dth.transfer(ADDRESS_BURN, burnAmount);

    } else if (lastAuction.state == AuctionState.Started) {
      //------------------------------------------------------------------------------//
      // there is a running auction, lets see if we can join the auction with our bid //
      //------------------------------------------------------------------------------//

      require(_sender != lastAuction.highestBidder, "highest bidder cannot bid");

      uint currentHighestBid = auctionBids[currentAuctionId][lastAuction.highestBidder];

      if (_sender == zoneOwner.addr) {
        uint dthAddedBidsAmount = auctionBids[currentAuctionId][_sender].add(_dthAmount); // NOTE: _dthAmount
        // the current zone owner's stake also counts in his bid
        require(zoneOwner.staked.add(dthAddedBidsAmount) > currentHighestBid, "bid + already staked is less than current highest");
        auctionBids[currentAuctionId][_sender] = dthAddedBidsAmount;
      } else {
        // _sender is not the current zone owner
        if (auctionBids[currentAuctionId][_sender] == 0) {
          // this is the first bid of this challenger, deduct entry fee
          (burnAmount, bidAmount) = calcEntryFee(_dthAmount);
          require(bidAmount > currentHighestBid, "bid is less than current highest");
          auctionBids[currentAuctionId][_sender] = bidAmount;
          dth.transfer(ADDRESS_BURN, burnAmount);
        } else {
          // not the first bid, no entry fee
          uint newUserTotalBid = auctionBids[currentAuctionId][_sender].add(_dthAmount);
          require(newUserTotalBid > currentHighestBid, "bid is less than current highest");
          auctionBids[currentAuctionId][_sender] = newUserTotalBid;
        }
      }

      // it worked, _sender placed a bid
      lastAuction.highestBidder = _sender;
    }
  }

  function _claimFreeZone(address _sender, uint _dthAmount) // GAS COSt +/- 177.040
    private
  {
    require(zoneOwner.addr == address(0), "can not claim zone with owner");
    require(_dthAmount >= MIN_STAKE, "need at least minimum zone stake amount (100 DTH)");

    // NOTE: empty zone claim will not have entry fee deducted, its not bidding it's taking immediately
    zoneOwner.addr = _sender;
    zoneOwner.startTime = now;
    zoneOwner.staked = _dthAmount;
    zoneOwner.balance = _dthAmount;
    zoneOwner.lastTaxTime = now;
  }

  function _topUp(address _sender, uint _dthAmount) // GAS COST +/- 104.201
    private
  {
    require(zoneOwner.addr != address(0), "zone has no owner");
    require(_sender == zoneOwner.addr, "caller is not zone owner");
    require(auctionIdToAuction[currentAuctionId].state == AuctionState.Ended, "cannot top up while auction running");

    uint oldBalance = zoneOwner.balance;
    uint newBalance = oldBalance.add(_dthAmount);
    zoneOwner.balance = newBalance;

    emit ZoneOwnerTopUp(_sender, oldBalance, newBalance);
  }

  // ------------------------------------------------
  //
  // Functions Setters Public
  //
  // ------------------------------------------------

  /////////////
  //
  //
  // Zone ownership + Auction
  //
  //
  /////////////

  /// @notice ERC223 receiving function called by Dth contract when Eth is sent to this contract
  /// @param _from Who send DTH to this contract
  /// @param _value How much DTH was sent to this contract
  /// @param _data Additional bytes data sent
  function tokenFallback(address _from, uint _value, bytes _data)
    public
  {
    require(msg.sender == address(dth), "can only be called by dth contract");
    require(control.paused() == false, "contract is paused");
    require(geo.countryIsEnabled(country), "country is disabled");

    bytes1 func = toBytes1(_data, 0);

    require(func == bytes1(0x40) || func == bytes1(0x41) || func == bytes1(0x42) || func == bytes1(0x43), "did not match Zone function");

    if (func == bytes1(0x40)) { // zone was created by factory, sending through DTH
      return; // just retun success
    }

    require(users.getUserTier(_from) > 0, "user not certified");

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
  {
    require(control.paused() == false, "contract is paused");
    // allow also when country is disabled, otherwise no way for zone owner to get their eth/dth back
    require(users.getUserTier(msg.sender) > 0, "user not certified");

    // zone owner could be removed if he does not have enough balance to pay his taxes
    _processState();

    require(msg.sender == zoneOwner.addr, "caller is not zone owner");
    require(auctionIdToAuction[currentAuctionId].state == AuctionState.Ended, "cannot release while auction running");

    Auction storage lastAuction = auctionIdToAuction[currentAuctionId];

    uint ownerBalance = zoneOwner.balance;

    zoneOwner.addr = address(0);
    zoneOwner.startTime = 0; // we dont really need startTime, lastTaxTime initially is startTime
    zoneOwner.staked = 0;
    zoneOwner.balance = 0;
    zoneOwner.lastTaxTime = 0;

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
  {
    require(control.paused() == false, "contract is paused");
    // even when country is disabled, otherwise users cannot withdraw their bids
    require(users.getUserTier(msg.sender) > 0, "user not certified");

    require(_auctionId <= currentAuctionId, "auctionId does not exist");

    _processState();

    require(auctionIdToAuction[_auctionId].state == AuctionState.Ended, "cannot withdraw while auction is active");
    require(auctionBids[_auctionId][msg.sender] > 0, "nothing to withdraw");

    uint withdrawAmount = auctionBids[_auctionId][msg.sender];
    auctionBids[_auctionId][msg.sender] = 0;

    dth.transfer(msg.sender, withdrawAmount);
  }

  /// @notice withdraw from a given list of auction ids
  function withdrawFromAuctions(uint[] _auctionIds) // GAS COST +/- 127.070
    external
  {
    require(control.paused() == false, "contract is paused");
    // even when country is disabled, can withdraw
    require(users.getUserTier(msg.sender) > 0, "user not certified");

    _processState();

    require(_auctionIds.length > 0, "auctionIds list is empty");
    // auction 0 cannot be withdrawn from
    require(_auctionIds.length <= currentAuctionId, "auctionIds list is longer than allowed");

    uint withdrawAmountTotal = 0;

    for (uint idx = 0; idx < _auctionIds.length; idx++) {
      uint auctionId = _auctionIds[idx];
      require(auctionId > 0 && auctionId <= currentAuctionId, "auctionId does not exist");
      require(auctionIdToAuction[auctionId].state == AuctionState.Ended, "cannot withdraw from running auction");
      uint withdrawAmount = auctionBids[auctionId][msg.sender];
      if (withdrawAmount > 0) {
        // if user supplies the same auctionId multiple times in auctionIds,
        // only the first one will get a withdrawal amount
        auctionBids[auctionId][msg.sender] = 0;
        withdrawAmountTotal = withdrawAmountTotal.add(withdrawAmount);
      }
    }

    // TODO: not throw here?
    require(withdrawAmountTotal > 0, "nothing to withdraw");

    dth.transfer(msg.sender, withdrawAmountTotal);
  }

  function withdrawDth()
    external
  {
    uint dthWithdraw = withdrawableDth[msg.sender];
    require(dthWithdraw > 0, "nothing to withdraw");

    if (dthWithdraw > 0) {
      withdrawableDth[msg.sender] = 0;
      dth.transfer(msg.sender, dthWithdraw);
    }
  }

  function withdrawEth()
    external
  {
    uint ethWithdraw = withdrawableEth[msg.sender];
    require(ethWithdraw > 0, "nothing to withdraw");

    if (ethWithdraw > 0) {
      withdrawableEth[msg.sender] = 0;
      msg.sender.transfer(ethWithdraw);
    }
  }

  /////////////
  //
  //
  // TELLER
  //
  //
  /////////////


  // NOTE: we could just require only last 3 bytes of a bytes10 geohash, since
  // the first 7 bytes will be the geohash of this zone. But by requiring the full geohash
  // we can mkae more sure the user is talking to the right zone
  function addTeller(bytes _position, uint8 _currencyId, bytes16 _messenger, int16 _sellRate, int16 _buyRate, bytes1 _settings, address _referrer) // GAS COST +/- 75.301
    external
  {
    require(control.paused() == false, "contract is paused");
    require(geo.countryIsEnabled(country), "country is disabled");
    require(users.getUserTier(msg.sender) > 0, "user not certified");
    require(_position.length == 10, "expected position to be 10 bytes");
    require(toBytes7(_position, 0) == geohash, "position is not inside this zone");
    require(geo.validGeohashChars(_position), "invalid position geohash characters");

    require(_currencyId >= 1 && _currencyId <= 100, "currency id must be in range 1-100");
    // _messenger can be 0x0 if he has no telegram

    if (_settings & isSellerBitMask != 0) { // seller bit is set => teller is a "seller"
      require(_sellRate >= -9999 && _sellRate <= 9999, "sellRate should be between -9999 and 9999");
    } else {
      require(_sellRate == 0, "cannot set sellRate if not set as seller");
    }

    if (_settings & isBuyerBitMask != 0) { // buyer bit is set => teller is a "buyer"
      require(_buyRate >= -9999 && _buyRate <= 9999, "buyRate should be between -9999 and 9999");
    } else {
      require(_buyRate == 0, "cannot set buyRate if not set as buyer");
    }

    _processState();

    require(msg.sender == zoneOwner.addr, "only zone owner can add teller info");

    teller.currencyId = _currencyId;
    teller.messenger = _messenger;
    teller.buyRate = _buyRate;
    teller.sellRate = _sellRate;
    teller.position = toBytes10(_position, 0);
    teller.settings = _settings;
    teller.referrer = _referrer;

    emit ZoneUpdatedTeller(msg.sender);
  }

  // called by Teller, adding ETH to Teller funds
  function addFunds() // GAS COST +/- 59.809
    external
    payable
  {
    require(control.paused() == false, "contract is paused");
    require(geo.countryIsEnabled(country), "country is disabled");
    require(users.getUserTier(msg.sender) > 0, "user not certified");
    require(msg.value > 0, "no eth send with call");

    _processState();

    require(msg.sender == zoneOwner.addr, "only zoneOwner can add funds");
    require(teller.currencyId != 0, "not yet added teller info");

    // register ETH sent to this contract
    funds[msg.sender] = funds[msg.sender].add(msg.value);
  }

  // called by Teller, sending ETH from Zone to _to
  function sellEth(address _to, uint _amount) // GAS COST +/- 147.310
    external
  {
    require(control.paused() == false, "contract is paused");
    require(geo.countryIsEnabled(country), "country is disabled");
    require(users.getUserTier(msg.sender) > 0, "user not certified");
    require(msg.sender != _to, "sender cannot also be to");
    require(_amount > 0, "amount to sell cannot be zero");

    _processState();

    require(msg.sender == zoneOwner.addr, "can only be called by zone owner");
    require(teller.currencyId != 0, "not yet added teller info");

    if (teller.referrer != address(0)) { // need to pay referrer fee
      uint referrerAmount = calcReferrerFee(_amount);
      require(funds[msg.sender] >= _amount + referrerAmount, "not enough funds to sell eth amount plus pay referrer fee");
      funds[msg.sender] = funds[msg.sender].sub(_amount + referrerAmount);
      withdrawableEth[teller.referrer] = withdrawableEth[teller.referrer].add(referrerAmount);
    } else {
      require(funds[msg.sender] >= _amount, "cannot sell more than in funds");
      funds[msg.sender] = funds[msg.sender].sub(_amount);
    }

    zoneFactory.updateUserDailySold(country, msg.sender, _to, _amount); // MIGHT THROW if exceeds daily limit

    _to.transfer(_amount);
  }
}
