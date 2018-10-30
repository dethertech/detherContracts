pragma solidity ^0.4.22;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/*
things still to do:
- implement release function
- add tests
- add events
- try and get rid of the multiple auctions and just use 1 Auction (like ZoneOwner)
- (partially) implement burn/entry fee
- cancel bid?? (with cancel fee??)
- implement harberger taxes

main ideas:
- _processAuction is used to update the state of the contract whenever we can,
  i see no other way to make this work. Having multiple consecutive auctions really complicates things,
  also nobody calling claim after an auction will cause severe problems.
  solution to all this, call _processAuction at the beginning of each "set" function
*/

contract Zone {
  using SafeMath for uint;

  // ------------------------------------------------
  // Variables (Getters)
  // ------------------------------------------------

  uint private constant MIN_STAKE = 100 ether; // DTH, which is also 18 decimals!
  uint private constant BID_PERIOD = 24 hours;
  uint private constant COOLDOWN_PERIOD = 48 hours;

  bytes7 public geohash;

  mapping(address => uint) public zoneOwnerWithdraw;

  struct ZoneOwner {
    address addr;
    uint startTime;
    uint staked;
  }
  ZoneOwner public zoneOwner;

  enum AuctionState { Started, Ended }
  struct Auction {
    AuctionState state;
    uint startTime;
    uint endTime;
    address highestBidder;
    uint totalBids;
    bool processed;
    mapping (address => uint) bids;
  }
  uint public currentAuctionId;
  mapping(uint => Auction) private auctionIdToAuction;

  // ------------------------------------------------
  //
  // Events
  //
  // ------------------------------------------------

  event ZoneBidPlaced(address who, uint amount);
  event ZoneBidWithdraw(address who, uint amount);
  // TODO: add all necessary events

  // ------------------------------------------------
  //
  // Modifiers
  //
  // ------------------------------------------------

  modifier onlyZoneOwner() {
    require(msg.sender == zoneOwner);
    _;
  }

  modifier onlyZoneOperator() {
    require(msg.sender == zoneOperator);
    _;
  }

  // ------------------------------------------------
  //
  // Constructor
  //
  // ------------------------------------------------

  // executed by ZoneFactory.sol when this Zone does not yet exist (= not yet deployed)
  constructor(bytes7 _geohash, address _zoneOwner, uint _dthAmount)
    internal
  {
    require(_geohash != bytes7(0), "geohash should not be 0x0");
    require(_zoneOwner != address(0), "zone owner should not be 0x0");
    require(_dthStake >= MIN_STAKE, "zone dth stake is less than minimum (100 DTH)");

    geohash = _geohash;

    zoneOwner = ZoneOwner({
      addr: _zoneOwner,
      startTime: now,
      staked: _dthAmount
    });

    // create a Sentinel Auction
    Auction memory sentinelAuction = Auction({
      state: AuctionState.Ended,
      startTime: now,
      endTime: now,
      highestBidder: msg.sender, // caller (challenger)
      totalBids: 0, // caller (challenger) dth stake bid
      processed: true
      // bids is a mapping
    });
    sentinelAuction.bids[_zoneOwner] = _dthAmount;
    auctionIdToAuction[currentAuctionId] = sentinelAuction;

    // NO BURN FEE
    dth.transfer(address(this), _dthAmount);

    emit ZoneCreated(address(this), _geohash, _zoneOwner, _dthAmount);
  }

  // ------------------------------------------------
  //
  // Getters
  //
  // ------------------------------------------------

  // if we bid 100DTH, how much will that be after the entry fee (1%) has been deducted
  function calcBidMinusEntryFee(uint _bid)
    external
    pure
    returns(uint)
  {
    return _bid.sub(_bid.div(100));
  }

  // get the current auction, with its state updated to the correct one (depending on current time)
  // used by below Getters
  function _getLiveAuction(uint _currentAuctionId)
    private
    returns (Auction)
  {
    Auction memory auction = auctionIdToAuction[_currentAuctionId];

    // get the current(!) auction state
    if (auction.state == AuctionState.Started && now >= auction.endTime) {
      auction.state = AuctionState.Ended;
    }

    return auction;
  }

  // can a specific user place a bid
  function canCallBid(address _who)
    external
    view
    returns (bool)
  {
    Auction memory lastAuction = _getLiveAuction(currentAuctionId);

    if (lastAuction.state == AuctionState.Started) {
      // there is an auction currently running, can we place a bid in it?

      if (lastAuction.highestBidder == _who) return false; // already highest bidder

      return true; // we are currently not the highest bidder, so we can place new bid
    }

    if (lastAuction.state == AuctionState.Ended) {
      // current auction has ended, but can we call bid and start a new auction?

      if (lastAuction.highestBidder == _who) return false; // we won the auction and will be the new zoneOner (call claim())

      if (now <= lastAuction.endTime.add(COOLDOWN_PERIOD)) return false; // still in cooldown period

      return true; // we did not win the last auction AND cooldown period is over, so placing a new bid will start a new auction
    }
  }

  function canCallClaim(address _who)
    external
    view
    returns (bool)
  {
    Auction memory onchainAuction = auctionIdToAuction[currentAuctionId];

    // this could have it's state variable updated to Ended if now >= endTime
    Auction memory updatedAuction = _getLiveAuction(currentAuctionId);

    if (onchainAuction.state == AuctionState.Ended) {
      // claiming already happened, either by _processAuction() or we already called claim() ourselves
      return false;
    }

    if (onchainAuction.state == AuctionState.Started) {
      // the onchain auction state is Started

      if (updatedAuction.state == AuctionState.Started) {
        // the actual auction state is (still) Started

        return false; // auction is still active
      }

      if (updatedAuction.state == AuctionState.Ended) {
        // the acutal auction has Ended

        if (onchainAuction.highestBidder == _who) return true; // we won the auction, we can call claim() to set ourselves as zoneOwner

        return false; // we are not the one that won the auction, so we cannot claim(), only highestBidder can
      }
    }
  }

  function canCallClaimEmptyZone(address _who)
    external
    view
    returns (bool)
  {
    // get the current onchain Auction
    Auction memory lastAuction = auctionIdToAuction[currentAuctionId];

    if (lastAuction.processed && zoneOwer == address(0)) {
      // the last auction was (onchain) processed (meaning its highestBidder was set as new zoneOwner)
      // however current zoneOwner is set to address(0) which can only mean that the highestBidder
      // "released" his zone ownership after he was made zoneOwner
      return true;
    }

    return false;
  }

  function canCallWithdrawFromAuction(address _who, uint _auctionId)
    public
    view
    returns (bool)
  {
    if (_auctionId > currentAuctionId) return false; // auctionId does not exist

    Auction memory auction = _getLiveAuction(_auctionId);

    return auction.state == AuctionState.Ended && // can only withdraw if auction has ended
           auction.highestBidder != _who && // can only withdraw if _who is not the winner of the auction
           auction.bids[_who] > 0; // can only withdraw if _who still has funds inside the auction
  }

  function getWithdrawFromAuctionAmount(address _who, uint _auctionId)
    external
    view
    returns (uint)
  {
    if (!canCallWithdrawFromAuction(_who, _auctionId)) return 0; // _who currently cannot call withdrawFromAuction

    return auctionIdToAuction[_auctionId].bids[_who]; // return the amount he can withdraw
  }

  function canCallWithdrawFromAllAuctions(address _who)
    public
    view
    returns (bool)
  {
    uint withdrawAmountTotal = 0;

    // NOTE: the current (= last) auction is handled separately below
    for (uint i = 1; i <= currentAuctionId - 1; i++) {
      if (auctionIdToAuction[i].bids[_who] > 0) return true; // we found an auction from which the user can withdraw
    }

    Auction memory lastAuction = _getLiveAuction(currentAuctionId);
    if (lastAuction.state == AuctionState.Ended && // last auction ended
        lastAuction.highestBidder != _who && // _who is not the winner of the auction
        lastAuction.bids[_who] > 0) // who did participate and thus has funds in side the auction
    {
      return true;
    }

    return false;
  }

  // return all fields of a specific auction
  function getAuction(uint _auctionId)
    public
    view
    returns (uint, uint, uint, uint, address, uint, bool)
  {
    // so we get the correct auction.state depending on block.timestamp
    Auction memory auction = _getLiveAuction(_auctionId);

    return (
      _auctionId,
      uint(auction.state),
      auction.startTime,
      auction.endTime,
      auction.highestBidder,
      auction.totalBids,
      auction.processed
    );
  }

  // easy way to get the current(=last) auction
  function getLastAuction()
    external
    view
    returns (uint, uint, uint, uint, address, uint, bool)
  {
    return getAuction(currentAuctionId);
  }

  // ------------------------------------------------
  //
  //
  // Setters
  //
  //
  // ------------------------------------------------

  // there really is no other way to keep everything running smoothly
  // we need to run this function at the beginning of every "set" operation
  function _processAuction()
    private
  {
    Auction storage lastAuction = auctionIdToAuction[currentAuctionId];

    // update auction state if auction end time has passed
    if (lastAuction.state == AuctionState.Started && now >= lastAuction.endTime) {
      lastAuction.state = AuctionState.Ended;
    }

    // check to see if we need to process the auction results
    if (lastAuction.state == AuctionStatus.Ended && lastAuction.processed == false) {
      uint winningAmount = lastAuction.bids[lastAuction.highestBidder];
      lastAuction.bids[lastAuction.highestBidder] = 0;

      if (zoneOwner.addr == lastAuction.highestBidder) {
        // the current zoneowner is the highest bidder
        zoneOwner.staked = winningAmount;
      } else {
        // the highest bidder is not the same as the current zone owner

        // uint beginTime = zoneOwner.startTime;
        // uint taxBeginTime = beginTime + 48 hours; // first 48 hours are tax free
        // uint taxEndTime = lastAuction.endTime;
        // uint taxTime = taxEndTime.sub(taxBeginTime);
        //
        // uint taxAmount = taxTime.mul(2).div(100); // 2%
        // uint bidAmount = _dthAmount.sub(burnAmount); // 98%
        // TODO: deduct harberger tax
        zoneOwnerWithdraw[zoneOwner.addr] = zoneOwnerWithdraw[zoneOwner.addr].add(zoneOwner.staked);

        // set the new zoneOwner
        zoneOwner = ZoneOwner({
          addr: lastAuction.highestBidder,
          startTime: lastAuction.endTime,
          staked: winningAmount
        });
      }

      lastAuction.processed = true;
    }
  }

  function bid(uint _dthAmount)
    external
  {
    _processAuction();

    require(zoneOwner.addr != address(0), "cannot bid on zone without owner, use claim()");
    require(dth.balanceOf(msg.sender) >= _dthAmount, "caller does not have enough dth");

    Auction storage lastAuction = auctionIdToAuction[currentAuctionId];

    uint burnAmount = _dthAmount.div(100); // 1%
    uint bidAmount = _dthAmount.sub(burnAmount); // 99%

    if (lastAuction.state == AuctionState.Ended) {
      // lets see if we can start a new Auction
      require(now > lastAuction.endTime.add(COOLDOWN_PERIOD), "cooldown period hasnt ended yet");
      require(msg.sender != zoneOwner.addr, "zoneowner cannot start an auction");
      require(bidAmount > zoneOwner.staked, "bid needs to be higher than current zoneowner stake");

      // create new Auction
      Auction memory newAuction = Auction({
        state: AuctionState.Started,
        startTime: now,
        endTime: now.add(BID_PERIOD),
        highestBidder: msg.sender, // caller (challenger)
        totalBids: bidAmount, // caller (challenger) dth stake bid
        processed: false
        // bids is a mapping
      });
      newAuction.bids[msg.sender] = bidAmount;

      // save the new Auction
      auctionIdToAuction[++currentAuctionId] = newAuction;

    } else if (lastAuction.state == AuctionState.Started) {
      // there is a running auction, lets see if we can join the auction with our bid
      require(msg.sender != lastAuction.highestBidder, "caller already has highest bid");

      if (msg.sender == zoneOwner.addr) {
        if (lastAuction.bids[msg.sender] == 0) {
          // zoneowner's first challenge counter-bid
          uint firstCounterBidAmount = zoneOwner.staked.add(bidAmount);
          require(firstCounterBidAmount > lastAuction.bids[lastAuction.highestBidder], "bid is not higher than current highest");
          lastAuction.bids[msg.sender] = firstCounterBidAmount;
        } else {
          // zoneowner already placed a first challenge counter-bid, this is his second/third/etc. counter bid
          uint newCounterBidAmount = lastAuction.bids[msg.sender].add(bidAmount);
          require(newCounterBidAmount > lastAuction.bids[lastAuction.highestBidder], "bid is not higher than current highest");
          lastAuction.bids[msg.sender] = newCounterBidAmount;
        }
      } else {
        // msg.sender is not the current zone owner
        require(lastAuction.bids[msg.sender].add(bidAmount) > lastAuction.bids[lastAuction.highestBidder], "bid is not higher than current highest");
        lastAuction.bids[msg.sender] = lastAuction.bids[msg.sender].add(bidAmount);
      }

      // update the Auction
      lastAuction.highestBidder = msg.sender;
      lastAuction.totalBids = lastAuction.totalBids.add(bidAmount);
    }

    dth.transfer(address(0), burnAmount); // burn
    dth.transfer(address(this), bidAmount);
  }

  // even though we use _processAuction in every "set" function, there still should be a way
  // to manually claim a zone after the auction ended.
  function claim()
    external
  {
    _processAuction();
  }

  // user can claim empty zone --> which has no zoneowner AND for which there is no running auction
  function claimEmptyZone(uint _dthAmount)
    external
  {
    _processAuction();

    require(auctionIdToAuction[currentAuctionId].state == AuctionStatus.Ended, "can not claim while auction is running");
    require(zoneOwner.addr == address(0), "can only claim a zone which has no zoneowner");
    require(dth.balanceOf(msg.sender) >= _dthAmount, "caller does not have enough dth");
    require(_dthAmount >= MIN_STAKE, "bid needs to be at least minimum zone stake amount (100 DTH)");

    zoneOwner = ZoneOwner({
      addr: msg.sender,
      startTime: now,
      staked: _dthAmount
    });

    dth.transfer(address(this), _dthAmount);
  }

  // user can always try to withdraw from a specific auction
  function withdrawFromAuction(uint _auctionId)
    external
  {
    _processAuction();

    require(_auctionId <= currentAuctionId, "auctionId does not exist");

    Auction storage auction = auctionIdToAuction[_auctionId];

    require(auction.state == AuctionState.Ended, "can not withdraw while auction is active");
    require(auction.bids[msg.sender] > 0, "nothing to withdraw");

    uint withdrawAmount = auction.bids[msg.sender];

    auction.bids[msg.sender] = 0;
    auction.totalBids = auction.totalBids.sub(withdrawAmount);

    dth.transfer(msg.sender, withdrawAmount);
  }

  // if this function costs too much gas, the user can still withdraw using the above withdrawFromAuction(auctionId)
  function withdrawFromAllAuctions()
    external
  {
    _processAuction();

    uint withdrawAmountTotal = 0;

    for (uint i = 1; i <= currentAuctionId; i++) {
      Auction storage auction = auctionIdToAuction[i];

      uint withdrawAmount = auction.bids[msg.sender];
      if (withdrawAmount == 0) continue; // go to next auction

      auction.bids[msg.sender] = 0;
      auction.totalBids = auction.totalBids.sub(withdrawAmount);

      withdrawAmountTotal = withdrawAmountTotal.add(withdrawAmount);
    }

    if (withdrawAmountTotal == 0) return;

    dth.transfer(msg.sender, withdrawAmountTotal);
  }

  // zone owner can release his zone ownership
  function release()
    external
  {
    _processAuction();

    require(msg.sender == zoneOwner, "can only be called by zoneowner");

    ////////////////////////////////////////////////////////////
    // TODO
    ////////////////////////////////////////////////////////////
  }
}
