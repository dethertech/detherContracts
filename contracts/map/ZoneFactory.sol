pragma solidity ^0.4.22;

// will be deployed by this factory
import "./Zone.sol";

contract IZoneAuctionFactory {

}

contract ZoneFactory {

  // ------------------------------------------------
  // Variables (Getters)
  // ------------------------------------------------

  mapping(bytes7 => bool) public zoneExists;
  mapping(bytes7 => address) public zones;

  // ------------------------------------------------
  // Events
  // ------------------------------------------------

  event ZoneFactoryCreatedZone(address zoneAddress, bytes7 zoneGeohash, address zoneOwner);

  // ------------------------------------------------
  // Constructor
  // ------------------------------------------------

  constructor(address _zoneAuctionFactory)
    public
  {
    zoneAuctionFactory = IZoneAuctionFactory(_zoneAuctionFactory);
  }

  // ------------------------------------------------
  // Setters
  // ------------------------------------------------

  function createZone(bytes7 _geohash, address _zoneOwner, uint _dthStake)
    public
    returns (address)
  {
    require(!zoneExists[_geohash], "zone already exists");
    require(zones[_geohash] == address(0), "zone already set to non-zero address");

    // pass in the ZoneAuctionFactory address that was set inside this ZoneFactory
    Zone newZone = new Zone(_geohash, _zoneOwner, _dthStake, address(_zoneAuctionFactory));

    // update this Factory's state
    zoneExists[_geohash] = true;
    zones[_geohash] = address(newZone);

    emit ZoneFactoryCreatedZone(address(newZone), _geohash, _zoneOwner);

    return address(newZone);
  }
}
