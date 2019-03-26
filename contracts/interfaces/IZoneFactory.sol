pragma solidity ^0.5.3;

contract IZoneFactory {
    function dth() view public returns(address);
    function zoneToGeohash(address) view public returns(bytes6);
    function geohashToZone(bytes6) view public returns(address);
    function renounceOwnership() public;
    function owner() view public returns(address);
    function isOwner() view public returns(bool);
    function zoneImplementation() view public returns(address);
    function tellerImplementation() view public returns(address);
    function control() view public returns(address);
    function geo() view public returns(address);
    function users() view public returns(address);
    function transferOwnership(address newOwner) public;
    function zoneExists(bytes6 _geohash) view external returns(bool);
    function proxyUpdateUserDailySold(bytes2 _countryCode, address _from, address _to, uint256 _amount) external;
    function tokenFallback(address _from, uint256 _value, bytes memory _data) public;
}
