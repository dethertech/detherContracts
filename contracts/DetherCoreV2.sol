pragma solidity ^0.4.22;

import "./DetherSetup.sol";
import "./map/CSCZone.sol";

contract GeoRegistry {
  function zoneInsideCountry(bytes2 _countryCode, bytes7 _zone) public view returns (bool);
}

contract DetherCoreV2 is DetherSetup {
  //      cscId      zoneOwnerAddress
  mapping(bytes12 => address) public zoneToOwner;
  bytes12[] public cscs;

  //      countryCode isEnabled
  mapping(bytes2 => bool) public countryIsEnabled;
  bytes2[] public enabledCountries;

  GeoRegistry public geoRegistry;

  event ZoneAdded(address cscAddress, bytes12 csc, bytes7 geohash, address zoneOwner, address cscContractOwner);

  constructor(address _geoRegistry)
    public
  {
    geoRegistry = GeoRegistry(_geoRegistry);
  }

  function addCountryZone(bytes2 _country, bytes7 _geohash)
    public
    onlyCEO
  {
    require(countryIsEnabled[_country], "country is not enabled");
    require(geoRegistry.zoneInsideCountry(_country, _geohash), "zone is not inside country");

    CSCZone zone = new CSCZone(_geohash, msg.sender, address(this));

    bytes12 csc = zone.csc();
    bytes7 geohash = zone.geohash();
    address cscZoneContractOwner = zone.cscZoneContractOwner();
    address zoneOwner = zone.zoneOwner();

    zoneToOwner[csc] = zoneOwner;
    cscs.push(csc);

    emit ZoneAdded(address(zone), csc, geohash, zoneOwner, cscZoneContractOwner);
  }

  function enableCountry(bytes2 _country)
    public
    onlyCEO
  {
    countryIsEnabled[_country] = true ;
    enabledCountries.push(_country);
  }

  function getCscArray()
    public
    view
    returns (bytes12[])
  {
    return cscs;
  }
}
