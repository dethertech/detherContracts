pragma solidity ^0.5.3;

contract IZone {
  function country() public view returns (bytes2);
  function geohash() public view returns (bytes7);
  function init(bytes2 _countryCode, bytes7 _geohash, address _zoneOwner, uint _dthAmount, address _dth, address _geo, address _control, address _zoneFactory) external;
  function proxyUpdateUserDailySold(address _to, uint _amount) external;
  function connectToTellerContract(address _teller) external;
  function ownerAddr() external view returns (address);
  function processState() external;
}