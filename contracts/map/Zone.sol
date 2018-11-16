pragma solidity ^0.4.22;

import "zeppelin-solidity/contracts/math/SafeMath.sol";
import 'bytes/BytesLib.sol';

import '../dth/tokenfoundry/ERC223ReceivingContract.sol';
import "../dth/IDetherToken.sol";// TODO: replace with zeppelin ERC20 abstract contract?

contract Zone is ERC223ReceivingContract {
  using SafeMath for uint;
  using BytesLib for bytes;

  // ------------------------------------------------
  // Variables (Getters)
  // ------------------------------------------------

  uint private constant MIN_STAKE = 100 * 1 ether; // DTH, which is also 18 decimals!
  uint private constant BID_PERIOD = 24 * 1 hours;
  uint private constant COOLDOWN_PERIOD = 48 * 1 hours;
  uint private constant ENTRY_FEE_PERCENTAGE = 1;
  uint private constant TAX_PERCENTAGE = 1;
  address private constant ADDRESS_BURN = 0xffffffffffffffffffffffffffffffffffffffff;

  IDetherToken public dth;

  bytes7 public geohash;

  mapping(address => uint) public withdrawableDth;

  //
  // zone owner
  //
  struct ZoneOwner {
    address addr;
    uint startTime;
    uint staked;
    uint balance;
    uint lastTaxTime;
  }
  ZoneOwner private zoneOwner;

  //
  // auction
  //
  enum AuctionState { Started, Ended }
  struct Auction {
    AuctionState state;
    uint startTime;
    uint endTime;
    address highestBidder;
  }
  mapping(uint => Auction) private auctionIdToAuction;
  uint public currentAuctionId;

  //      auctionId       bidder     dthAmount
  mapping(uint => mapping(address => uint)) public auctionBids;

  // ------------------------------------------------
  //
  // Events
  //
  // ------------------------------------------------

  event ZoneCreated(address indexed zoneAddress, bytes7 indexed geohash, address indexed zoneOwner, uint dthAmount);
  event ZoneOwnerForeClosed(address ownerAddress, uint lifeStart, uint lifeEnd, uint taxPaidTotal, uint taxDebtOutstanding);
  event ZoneOwnerTaxesPaid(address ownerAddress, uint taxStart, uint taxEnd, uint taxAmount);
  event ZoneOwnerTopUp(address ownerAddress, uint oldBalance, uint newBalance);
  event ZoneAuctionStarted(address auctionId, uint lifeStart);
  event ZoneAuctionEnded(address auctionId, uint lifeEnd, address newOwner);
  event ZoneAuctionBid(address auctionId, address bidder, uint bidAmount); // NOTE: this includes current stake if zone owner bids

  // ------------------------------------------------
  //
  // Constructor
  //
  // ------------------------------------------------

  // executed by ZoneFactory.sol when this Zone does not yet exist (= not yet deployed)
  constructor(bytes7 _geohash, address _zoneOwner, uint _dthAmount, address _dth)
    public // will be internal and inherited by Zone.sol if this becomes a separate ZoneAuction.sol contract
  {
    require(_dthAmount >= MIN_STAKE, "zone dth stake shoulld be at least minimum (100DTH)");

    geohash = _geohash;

    dth = IDetherToken(_dth);

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

    emit ZoneCreated(address(this), _geohash, _zoneOwner, _dthAmount);
  }

  // ------------------------------------------------
  //
  // Getters
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
    pure
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
    returns (uint, uint, uint, uint, address)
  {
    // so we get the correct auction.state depending on block.timestamp
    Auction memory auction = auctionIdToAuction[_auctionId];

    return (
      _auctionId,
      uint(auction.state),
      auction.startTime,
      auction.endTime,
      auction.highestBidder
    );
  }

  /// @notice get the last auction
  function getLastAuction()
    external
    view
    returns (uint, uint, uint, uint, address)
  {
    return getAuction(currentAuctionId);
  }

  // ------------------------------------------------
  //
  //
  // Private Functions
  //
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

      // reset zone owner to nobody, somebody can now call claimFreeZone() with 100DTH
      zoneOwner.addr = address(0);
      zoneOwner.startTime = 0;
      zoneOwner.staked = 0;
      zoneOwner.balance = 0;
      zoneOwner.lastTaxTime = 0;

      emit ZoneOwnerTaxesPaid(zoneOwner.addr, taxStartTime, taxEndTime, taxAmount);
      emit ZoneOwnerForeClosed(zoneOwner.addr, zoneOwner.startTime, taxEndTime, taxableAmount, taxDebt);

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

  function _bid(address _sender, uint _dthAmount)
    private
  {
    _processState();

    // if there is no auction, and the zone owner does not have enough balance to pay
    // his harberger taxes, zoneOwner could be removed, in that case, user should call
    // claimFreeZone(), not bid()

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

  function _claimFreeZone(address _sender, uint _dthAmount)
    private
  {
    _processState();

    require(zoneOwner.addr == address(0), "can not claim zone with owner");
    require(_dthAmount >= MIN_STAKE, "need at least minimum zone stake amount (100 DTH)");

    // NOTE: empty zone claim will not have entry fee deducted, its not bidding it's taking immediately
    zoneOwner.addr = _sender;
    zoneOwner.startTime = now;
    zoneOwner.staked = _dthAmount;
    zoneOwner.balance = _dthAmount;
    zoneOwner.lastTaxTime = now;
  }

  function _topUp(address _sender, uint _dthAmount)
    private
  {
    _processState();

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
  //
  // Public Functions
  //
  //
  // ------------------------------------------------

  /// @notice ERC223 receiving function called by Dth contract when Eth is sent to this contract
  /// @param _from Who send DTH to this contract
  /// @param _value How much DTH was sent to this contract
  /// @param _data Additional bytes data sent
  function tokenFallback(address _from, uint _value, bytes _data)
    public
  {
    require(msg.sender == address(dth), "can only be called by dth contract");

    // if (_data.length == 0) {
    //   // TODO
    //   // ERC223 will always call this function when eth is sent to this contract,
    //   // if there is no data, just return success?
    //   return;
    // }

    bytes1 func = _data.toBytes1(0);

    if (func == bytes1(0x40)) { // zone was created by factory, sending through DTH
      return; // just retun success
    } else if (func == bytes1(0x41)) { // claimFreeZone
      _claimFreeZone(_from, _value);
    } else if (func == bytes1(0x42)) { // bid
      _bid(_from, _value);
    } else if (func == bytes1(0x43)) { // topUp
      _topUp(_from, _value);
    } else {
      require(false, "did not match a Zone function");
    }
  }

  /// @notice release zone ownership
  /// @dev can only be called by current zone owner, when there is no running auction
  function release()
    external
  {
    // zone owner could be removed if he does not have enough balance to pay his taxes
    _processState();

    require(zoneOwner.addr != address(0), "zone has no owner");
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
    // TODO? add require(tx.origin == msg.sender) to prevent contracts from calling this function?
    dth.transfer(msg.sender, ownerBalance);
  }


  // offer three different withdraw functions, single auction, multiple auctions, all auctions

  /// @notice withdraw losing bids from a specific auction
  /// @param _auctionId The auction id
  function withdrawFromAuction(uint _auctionId)
    external
  {
    require(_auctionId <= currentAuctionId, "auctionId does not exist");

    _processState();

    require(auctionIdToAuction[_auctionId].state == AuctionState.Ended, "can not withdraw while auction is active");
    require(auctionBids[_auctionId][msg.sender] > 0, "nothing to withdraw");

    uint withdrawAmount = auctionBids[_auctionId][msg.sender];
    auctionBids[_auctionId][msg.sender] = 0;

    dth.transfer(msg.sender, withdrawAmount);
  }

  /// @notice withdraw from a given list of auction ids
  function withdrawFromAuctions(uint[] auctionIds)
    external
  {
    _processState();

    require(auctionIds.length > 0, "auctionIds list is empty");
    // auction 0 cannot be withdrawn from, therefore max length is currentAuctionId - 1
    require(auctionIds.length < (currentAuctionId - 1), "auctionIds list is longer than allowed");

    uint withdrawAmountTotal = 0;

    for (uint idx = 0; idx < auctionIds.length; idx++) {
      uint auctionId = auctionIds[idx];
      require(auctionId > 0 && auctionId <= currentAuctionId, "invalid auctionId");
      if (auctionId == currentAuctionId && auctionIdToAuction[auctionId].state == AuctionState.Started) {
        // cannot withdraw from running auction
        continue;
      }
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

  /// @notice withdraw losing bids from a specific auction
  /// @dev if this function exceeds the gas limit, a user could always still use withdrawFromAuction(auctionId)
  function withdrawFromAllAuctions()
    external
  {
    _processState();

    uint withdrawAmountTotal = 0;

    // start at 1, auction 0 is sentinel, has no bidders except initial zone owner
    for (uint auctionId = 1; auctionId <= currentAuctionId; auctionId++) {
      if (auctionId == currentAuctionId && auctionIdToAuction[auctionId].state == AuctionState.Started) {
        // cannot withdraw from running auction
        continue;
      }
      uint withdrawAmount = auctionBids[auctionId][msg.sender];
      if (withdrawAmount > 0) {
        auctionBids[auctionId][msg.sender] = 0;
        withdrawAmountTotal = withdrawAmountTotal.add(withdrawAmount);
      }
    }

    // TODO: not throw here?
    require(withdrawAmountTotal > 0, "nothing to withdraw");

    dth.transfer(msg.sender, withdrawAmountTotal);
  }
}
