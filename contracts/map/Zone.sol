pragma solidity ^0.4.22;

import "./ZoneAuction.sol";

contract Zone is ZoneAuction {

  // ------------------------------------------------
  // Variables (Getters)
  // ------------------------------------------------

  uint private constant MIN_STAKE = 100 ether; // DTH, which is also 18 decimals!

  // set by constructor
  IZoneAuctionFactory public zoneAuctionFactory;
  bytes7 public geohash;
  bytes12 public csc;
  address public zoneOwner;
  uint public stakedAmount;

  // can/will be updated after deployment
  bool public delegated;
  address public zoneOperator;

  // auction related
  uint public highestBid;
  address public highestBidder;
  mapping(address => uint256) public fundsByBidder;

  // ------------------------------------------------
  // Events
  // ------------------------------------------------

  event ZoneCreated(address zoneAddress, bytes7 zoneGeohash, bytes12 cscId, address zoneOwner);
  event ZoneAmountReceived(uint amount, uint newBalance);
  event ZoneWithdraw(uint amount);

  // ------------------------------------------------
  // Modifiers
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
  // Constructor
  // ------------------------------------------------

  constructor(bytes7 _geohash, address _zoneOwner, uint _dthStake)
    public
  {
    require(_geohash != bytes7(0), "geohash should not be 0x0");
    require(_zoneOwner != address(0), "zone owner should not be 0x0");
    require(_dthStake >= MIN_STAKE, "zone dth stake is less than minimum (100 DTH)");
    require(_zoneAuctionFactory != address(0), "auction factory address cannot be 0x0");

    geohash = _geohash;
    csc = computeCSC(geohash, address(this));
    zoneOwner = _zoneOwner;
    zoneOperator = address(0); // initially set to nobody
    delegated = false; // initially set to false
    stakedAmount = _dthStake;

    emit ZoneCreated(address(this), geohash, csc, zoneOwner);
  }

  // ------------------------------------------------
  // Fallback function
  // ------------------------------------------------

  function()
    payable
    public
  {
    emit ZoneAmountReceived(msg.value, address(this).balance);
  }


  // ------------------------------------------------
  // Getters
  // ------------------------------------------------

  function hasZoneOwner()
    public
    view
    returns (bool)
  {
    return (zoneOwner == address(0));
  }

  function computeCSC(bytes7 _geohashArg, address _addr)
    public
    pure
    returns(bytes12)
  {
    return bytes12(keccak256(abi.encodePacked(_geohashArg, _addr)));
  }

  // ------------------------------------------------
  // Setters
  // ------------------------------------------------

  function changeZoneOwner(address _newZoneOwner, uint _dthAmount)
    private
  {
    zoneOwner = _newZoneOwner;
    stakedAmount = _dthAmount;
  }

  function bid(address _buyer, uint _dthAmount)
    external
  {
    require(msg.sender != zoneOwner, "cannot be called by zone owner");
    require(_buyer != zoneOwner, "buyer cannot be the same as current zone owner");
    require(_dthAmount > stakedAmount, "bid amount is less than current zone stake amount");
    require(_dthAmount > fundsByBidder[highestBidder], "bid amount is less than current highest bid");

    uint newBid = fundsByBidder[msg.sender] + _dthAmount;
    require(newBid > highestBid);

    fundsByBidder[msg.sender] = newBid;

    if (msg.sender != highestBidder) {
      highestBidder = msg.sender;
    }
    highestBid = newBid;

    emit ZoneAuctionBid(msg.sender, newBid, highestBidder, highestBid);
  }

  function withdraw()
    external
  {
    require(msg.sender == zoneOwner, "can only be called by zone owner");

    uint zoneBalance = address(this).balance;
    require(zoneBalance > 0, "zone has no balance to withdraw");

    msg.sender.transfer(zoneBalance);

    emit ZoneWithdraw(zoneOwner, zoneBalance);
  }

  // when auction has completed an new zone owner has beeen determined, that new zoneowner can
  // now claim this zone
  function claim()
    external
  {

  }

  // the current zone owner can always stop being the zoneowner, thereby letting other people
  // try and bid for the zone
  function release()
    external
  {

  }
}
