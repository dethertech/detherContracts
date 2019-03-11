pragma solidity ^0.5.3;

contract IShops {
    function dth() view public returns(address);
    function withdrawableDth(address) view public returns(uint256);
    function positionToShopAddress(bytes12) view public returns(address);
    function shopsDispute() view public returns(address);
    function zoneToShopAddresses(bytes7, uint256) view public returns(address);
    function control() view public returns(address);
    function geo() view public returns(address);
    function users() view public returns(address);
    function countryLicensePrice(bytes2) view public returns(uint256);
    function setShopsDisputeContract(address _shopsDispute) external;
    function getShopByAddr(address _addr) view public returns(bytes12, bytes16, bytes16, bytes32, bytes16, uint256, bool, uint256);
    function getShopByPos(bytes12 _position) view external returns(bytes12, bytes16, bytes16, bytes32, bytes16, uint256, bool, uint256);
    function getShopAddressesInZone(bytes7 _zoneGeohash) view external returns(address[] memory);
    function shopByAddrExists(address _shopAddress) view external returns(bool);
    function getShopDisputeID(address _shopAddress) view external returns(uint256);
    function hasDispute(address _shopAddress) view external returns(bool);
    function getShopStaked(address _shopAddress) view external returns(uint256);
    function setCountryLicensePrice(bytes2 _countryCode, uint256 _priceDTH) external;
    function tokenFallback(address _from, uint256 _value, bytes memory _data) public;
    function removeShop() external;
    function withdrawDth() external;
    function setDispute(address _shopAddress, uint256 _disputeID) external;
    function unsetDispute(address _shopAddress) external;
    function removeDisputedShop(address _shopAddress, address _challenger) external;
}
