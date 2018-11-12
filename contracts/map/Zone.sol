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
  uint public currentAuctionId;
  mapping(uint => Auction) private auctionIdToAuction;

  //      auctionId address dthInThisAuction
  mapping(uint => mapping(address => uint)) public auctionBids;

  // ------------------------------------------------
  //
  // Events
  //
  // ------------------------------------------------

  event ZoneCreated(address indexed zoneAddress, bytes7 indexed geohash, address indexed zoneOwner, uint dthAmount);

  // ------------------------------------------------
  //
  // Modifiers
  //
  // ------------------------------------------------

  // no modifiers, its confusing

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
    // TODO: https://programtheblockchain.com/posts/2018/09/19/implementing-harberger-tax-deeds/

    // NOTE: we never reach 0 since we take percentage as harberger tax

    // uint amountToPayOut = zoneOwner.staked.sub(taxAmount);

    // uint taxAmount = taxTime.mul(2).div(100); // 2%
    // uint bidAmount = _dthAmount.sub(burnAmount); // 98%

    return (0, _dthAmount);
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

  function hasNoOwner()
    public
    view
    returns (bool)
  {
    return zoneOwner.addr == 0;
  }

  /// @notice get current zone owner data
  function getZoneOwner()
    external
    view
    returns (address, uint, uint)
  {
    return (zoneOwner.addr, zoneOwner.startTime, zoneOwner.staked);
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

  /// @notice private function to update the current auction state
  function _processLiveAuction()
    private
  {
    Auction storage lastAuction = auctionIdToAuction[currentAuctionId];

    // check if the current Auction is still set to Started and endTime has passed
    if (lastAuction.state == AuctionState.Started && now >= lastAuction.endTime) {
      // 1. update current Auction state to Ended
      lastAuction.state = AuctionState.Ended;

      // 2. collect winning bidder address
      address winningBidder = lastAuction.highestBidder;

      // 3. collect winning bid amount
      uint winningAmount = auctionBids[currentAuctionId][winningBidder];

      // 4. reset winning bidders bid in Auction
      auctionBids[currentAuctionId][winningBidder] = 0;

      // 5. check if winning bidder is the same as current zone owner
      if (zoneOwner.addr == winningBidder) {

        // current zone owner always has his stake amount added to all his bids
        // 5.1 set the new zone stake amount
        zoneOwner.staked = zoneOwner.staked.add(winningAmount);

      // 6. winning bidder differs from current zone owner
      } else {
        // 6.1 calculate amount of harberger tax to pay
        uint taxAmount;
        uint keepAmount;
        (taxAmount, keepAmount) = calcHarbergerTax(zoneOwner.lastTaxTime, now, zoneOwner.staked);

        address prevOwnerAddr = zoneOwner.addr;

        // 6.2 make the winnig bidder the new zoneOwner
        zoneOwner.addr = winningBidder;
        zoneOwner.staked = winningAmount; // entry fee is already deducted when user calls bid()
        zoneOwner.startTime = lastAuction.endTime;
        zoneOwner.lastTaxTime = now;

        // 6.3 burn the entry fee amount
        dth.transfer(ADDRESS_BURN, taxAmount);

        // 6.4 make left-over staked DTH of old zone owner withdrawable
        withdrawableDth[prevOwnerAddr] += keepAmount;
      }
    }
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

    if (_data.length == 0) {
      // TODO
      // ERC223 will always call this function when eth is sent to this contract,
      // if there is no data, just return success?
      return;
    }

    _processLiveAuction();

    address sender = _from;
    uint dthAmount = _value;

    bytes1 func = _data.toBytes1(0);

    // used in some cases, stupid solidity variable scope!
    uint burnAmount;
    uint bidAmount;

    if (func == bytes1(0x40)) { // zone was created by factory, sending through DTH
      return; // just retun success
    } else if (func == bytes1(0x41)) { // claimEmptyZone
      require(zoneOwner.addr == address(0), "can only claim a zone which has no owner");
      require(auctionIdToAuction[currentAuctionId].state == AuctionState.Ended, "can not claim while auction is running");
      require(dthAmount >= MIN_STAKE, "bid needs to be at least minimum zone stake amount (100 DTH)");

      // NOTE: empty zone claim will not have entry fee deducted, its not bidding it's taking immediately
      zoneOwner.addr = sender;
      zoneOwner.startTime = now;
      zoneOwner.lastTaxTime = now;
      zoneOwner.staked = dthAmount;

    } else if (func == bytes1(0x42)) { // bid
      require(zoneOwner.addr != address(0), "cannot bid on zone without owner, use claimEmptyZone()");

      Auction storage lastAuction = auctionIdToAuction[currentAuctionId];

      if (lastAuction.state == AuctionState.Ended) {
        // let's see if sender can start a new Auction
        require(now > lastAuction.endTime.add(COOLDOWN_PERIOD), "cooldown period did not end yet");
        require(sender != zoneOwner.addr, "zoneowner cannot start an auction");

        (burnAmount, bidAmount) = calcEntryFee(dthAmount);
        require(bidAmount > zoneOwner.staked, "bid is lower than current zone stake");

        // save the new Auction
        uint newAuctionId = ++currentAuctionId;

        auctionIdToAuction[newAuctionId] = Auction({
          state: AuctionState.Started,
          startTime: now,
          endTime: now.add(BID_PERIOD),
          highestBidder: sender // caller (challenger)
        });

        auctionBids[newAuctionId][sender] = bidAmount;

        dth.transfer(ADDRESS_BURN, burnAmount);

      } else if (lastAuction.state == AuctionState.Started) {
        // there is a running auction, lets see if we can join the auction with our bid
        require(sender != lastAuction.highestBidder, "highest bidder cannot bid");

        uint currentHighestBid = auctionBids[currentAuctionId][lastAuction.highestBidder];

        if (sender == zoneOwner.addr) {
          uint dthAddedBidsAmount = auctionBids[currentAuctionId][sender].add(dthAmount); // NOTE: dthAmount
          // the current zone owner's stake also counts in his bid
          require(zoneOwner.staked.add(dthAddedBidsAmount) > currentHighestBid, "bid + already staked is less than current highest");
          auctionBids[currentAuctionId][sender] = dthAddedBidsAmount;
        } else {
          // sender is not the current zone owner
          if (auctionBids[currentAuctionId][sender] == 0) {
            // this is the first bid of this challenger, deduct entry fee
            (burnAmount, bidAmount) = calcEntryFee(dthAmount);
            require(bidAmount > currentHighestBid, "bid is less than current highest");
            auctionBids[currentAuctionId][sender] = bidAmount;
            dth.transfer(ADDRESS_BURN, burnAmount);
          } else {
            // not the first bid, no entry fee
            uint newUserTotalBid = auctionBids[currentAuctionId][sender].add(dthAmount);
            require(newUserTotalBid > currentHighestBid, "bid is less than current highest");
            auctionBids[currentAuctionId][sender] = newUserTotalBid;
          }
        }

        // it worked, sender placed a bid
        lastAuction.highestBidder = sender;
      }
    } else {
      require(false, "did not match a Zone function");
    }
  }

  /// @notice release zone ownership
  /// @dev can only be called by current zone owner, when there is no running auction
  function release()
    external
  {
    _processLiveAuction();

    require(msg.sender == zoneOwner.addr, "only zone owner can release");
    require(auctionIdToAuction[currentAuctionId].state == AuctionState.Ended, "can not release while auction is running");

    uint taxAmount;
    uint keepAmount;
    (taxAmount, keepAmount) = calcHarbergerTax(zoneOwner.lastTaxTime, now, zoneOwner.staked);

    zoneOwner.addr = address(0);
    zoneOwner.startTime = 0; // we dont really need startTime, lastTaxTime initially is startTime
    zoneOwner.staked = 0;
    zoneOwner.lastTaxTime = 0;

    dth.transfer(ADDRESS_BURN, taxAmount);

    // if msg.sender is a contract, the DTH ERC223 contract will try to call tokenFallback
    // on msg.sender, this could lead to a reentrancy. But we prevent this by resetting
    // zoneOwner before we do dth.transfer(msg.sender)
    // TODO? add require(tx.origin == msg.sender) to prevent contracts from calling this function?
    dth.transfer(msg.sender, keepAmount);
  }

  /// @notice withdraw losing bids from a specific auction
  /// @param _auctionId The auction id
  function withdrawFromAuction(uint _auctionId)
    external
  {
    require(_auctionId <= currentAuctionId, "auctionId does not exist");

    _processLiveAuction();

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
    require(auctionIds.length > 0, "auctionIds list is empty");
    // auction 0 cannot be withdrawn from, therefore max length is currentAuctionId - 1
    require(auctionIds.length < (currentAuctionId - 1), "auctionIds list is longer than allowed");

    _processLiveAuction();

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

    require(withdrawAmountTotal > 0, "nothing to withdraw");

    dth.transfer(msg.sender, withdrawAmountTotal);
  }

  /// @notice withdraw losing bids from a specific auction
  /// @dev if this function exceeds the gas limit, a user could always still use withdrawFromAuction(auctionId)
  function withdrawFromAllAuctions()
    external
  {
    _processLiveAuction();

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

    require(withdrawAmountTotal > 0, "nothing to withdraw");

    dth.transfer(msg.sender, withdrawAmountTotal);
  }
}
