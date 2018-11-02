pragma solidity ^0.4.22;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";

// will be deployed by this factory
import "./Zone.sol";

import "../dth/IDetherToken.sol";

contract ZoneFactory is Ownable {

  // ------------------------------------------------
  // Variables (Getters)
  // ------------------------------------------------

  //      geohash   zoneContractAddress or 0x0 if it doesnt exist
  mapping(bytes7 => address) public geohashToZone;

  IDetherToken public dth;

  // ------------------------------------------------
  // Events
  // ------------------------------------------------

  event ZoneFactoryCreatedZone(address indexed zoneAddress, bytes7 indexed zoneGeohash, address indexed zoneOwner, uint dthStake);

  // ------------------------------------------------
  // Constructor
  // ------------------------------------------------
  constructor(address _dth)
    public
  {
    require(_dth != address(0), "dth address cannot be 0x0");
    dth = IDetherToken(_dth);
  }
  // ------------------------------------------------
  // Getters
  // ------------------------------------------------

  function zoneExists(bytes7 _geohash)
    external
    view
    returns (bool)
  {
    return geohashToZone[_geohash] != address(0);
  }

  // ------------------------------------------------
  // Setters
  // ------------------------------------------------

  function createAndClaim(bytes7 _geohash, uint _dthAmount)
    external
  {
    // checks
    require(geohashToZone[_geohash] == address(0), "cannot claim this zone, it already exists");
    require(_geohash != bytes7(0), "geohash cannot be 0x0");

    // TODO: already checked by transferFrom, but use require to check this upfront (hog much gas does this add?)
    require(dth.allowance(msg.sender, address(this)) >= _dthAmount, "zone factory dth allowance not high enough");

    // internal changes
    Zone newZone = new Zone(_geohash, msg.sender, _dthAmount, address(dth));
    geohashToZone[_geohash] = newZone;

    // external calls
    dth.transferFrom(msg.sender, address(newZone), _dthAmount);

    // event
    emit ZoneFactoryCreatedZone(address(newZone), _geohash, msg.sender, _dthAmount);
  }

  // // any address can call this method
  // function bidForZone(address _from, bytes7 _geohash, uint _dthStake)
  //   external
  //   onlyOwner
  //   returns (address)
  // {
  //   require(_dthStake >= MIN_ZONE_DTH_STAKE, "bid dth amount is less than minimum (100 DTH)");
  //
  //   if (zoneExists(_geohash)) {
  //     // place a bid, this might be in an existing ZoneAuction or a new ZoneAuction is created
  //     Zone existingZone = Zone(zones[_geohash]);
  //     existingZone.bid(msg.sender, _dthStake);
  //
  //     emit ZoneFactoryPlacedZoneBid(address(existingZone), _geohash, _zoneOwner, _dthStake);
  //
  //     return address(existingZone);
  //   } else {
  //     // zone doesn't exist yet, createit and give it to _from
  //     Zone newZone = new Zone(_geohash, _from, _dthStake);
  //     zones[_geohash] = address(newZone);
  //
  //     emit ZoneFactoryCreatedZone(address(newZone), _geohash, _zoneOwner, _dthStake);
  //
  //     return address(newZone);
  //   }
  // }
}
