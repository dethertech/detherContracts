pragma solidity ^0.4.22;

contract IDetherToken {
  function transfer(address to, uint256 value) public returns (bool);
  function balanceOf(address _owner) public view returns (uint256 balance);
}

contract IGeoRegistry {
  function countryIsEnabled(bytes2 _countryCode) public view returns (bool);
  function zoneInsideCountry(bytes2 _countryCode, bytes7 _zone) public view returns (bool);
}

contract IZoneFactory {
  function zoneExists(bytes7 _geohash) public view returns (bool);
  function zones(bytes7 _geohash) public view returns (address);
  function createZone(bytes7 _geohash, address _buyer, uint _dthAmount) public returns (address);
}

contract IZone {
  function bid(address buyer, uint dthAmount) public;
  function hasZoneOwner() public returns (bool);
  function auction() public returns (address);
}

contract ZoneManager {

  // ------------------------------------------------
  // Variables (Getters)
  // ------------------------------------------------

  IGeoRegistry public geoRegistry;
  IZoneFactory public zoneFactory;
  IDetherToken public dth;

  // ------------------------------------------------
  // Constructor
  // ------------------------------------------------

  constructor(
    address _detherToken,
    address _geoRegistry,
    address _zoneFactory
  )
    public
  {
    dth = IDetherToken(_detherToken);
    geoRegistry = IGeoRegistry(_geoRegistry);
    zoneFactory = IZoneFactory(_zoneFactory);
  }

  // ------------------------------------------------
  // Setters
  // ------------------------------------------------

  // any address can call this method
  function bidForZone(bytes2 _country, bytes7 _geohash, uint _dthAmount)
    external
  {
    require(geoRegistry.countryIsEnabled(_country), "country is not enabled");
    require(geoRegistry.zoneInsideCountry(_country, _geohash), "geohash is not in country");
    require(dth.balanceOf(msg.sender) >= _dthAmount, "address does not have enough dth");

    IZone zone;

    if (zoneFactory.zoneExists(_geohash)) {
      zone = IZone(zoneFactory.zones(_geohash));
      // place a bid, this might be in an existing ZoneAuction or a new ZoneAuction is created
      zone.bid(msg.sender, _dthAmount);

      // we successfully placed a bid in a ZoneAuction of the Zone, transfer the dth to the
      // address of the ZoneAuction
      dth.transfer(zone.auction(), _dthAmount);
    } else {
      // zone doesn't exist yet, give it to the caller for 100DTH
      zone = IZone(zoneFactory.createZone(_geohash, msg.sender, _dthAmount));

      // we created a new zone and immediately took ownership of it, transfer the stake to
      // the address of the created Zone contract
      dth.transfer(address(zone), _dthAmount);
    }
  }
}
