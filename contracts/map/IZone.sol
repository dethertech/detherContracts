pragma solidity ^0.4.24;

contract IZone {
  function init(
    bytes2 _countryCode,
    bytes7 _geohash,
    address _zoneOwner,
    uint _dthAmount,
    address _dth,
    address _geo,
    address _users,
    address _control,
    address _zoneFactory
  ) external;
}