pragma solidity ^0.5.3;

contract IZoneFactory {
  // Getters
  function dth() public view returns (address);
  function geo() public view returns (address);
  function users() public view returns (address);
  function control() public view returns (address);
  function geohashToZone(bytes7 _geohash) public view returns (address);
  function zoneToGeohash(address _zone) public view returns (bytes7);
  function zoneExists(bytes7 _geohash) external view returns (bool);
  // Setters
  function proxyUpdateUserDailySold(bytes2 _countryCode, address _from, address _to, uint _amount) external;
  function tokenFallback(address _from, uint _value, bytes memory _data) public;
}
