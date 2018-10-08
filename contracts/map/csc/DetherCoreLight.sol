pragma solidity ^0.4.22;
import "./CSCZone.sol";
import "../Lexico.sol";

contract DetherCoreLight {

  mapping(bytes12 => address) public zoneRegistry; // cscId => zoneOwnerAdress
  bytes12[] public cscArray;
  event ZoneAdded(address cscAddress, bytes12 csc, bytes7 geohash, address zoneOwner, address cscContractOwner);
  mapping(bytes2 => bool) public authorizedCountries;
  bytes2[] public authorizedCountriesArray;
  Lexico public countryChecker;

  constructor(address countryCheckerAddress) public {
      countryChecker = Lexico(countryCheckerAddress);
  }

  function addZoneFromCountry(bytes7 _geohash, bytes2 country) public returns (address){


    require(authorizedCountries[country]);
    require(countryChecker.zoneInsideCountry(country, _geohash));
    address cscAddress = new CSCZone(_geohash, msg.sender, address(this));
    CSCZone zone = CSCZone(cscAddress);
    bytes12 csc = zone.csc();
    bytes7 geohash = zone.geohash();
    address cscZoneContractOwner = zone.cscZoneContractOwner();
    address zoneOwner = zone.zoneOwner();
    emit ZoneAdded(cscAddress, csc, geohash, zoneOwner, cscZoneContractOwner);
    zoneRegistry[csc] = zoneOwner;
    cscArray.push(csc);
    return cscAddress;

  }

  function authorizeCountry(bytes2 country) public {
    authorizedCountries[country] = true ;
  }

  function isAuthorized(bytes2 country) public returns (bool) {
  
    if (authorizedCountries[country] == true) {
      return true;
    }
    return false;
  }

  function getZoneOwner(bytes12 cscId) public view returns (address) {
    return zoneRegistry[cscId];
  }

  function getCscArray() public view returns (bytes12[]){
    return cscArray;
  }

}
