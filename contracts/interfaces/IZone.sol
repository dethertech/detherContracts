pragma solidity ^0.5.3;

contract IZone {
    function dth() view public returns(address);
    function geohash() view public returns(bytes7);
    function currentAuctionId() view public returns(uint256);
    function auctionBids(uint256, address) view public returns(uint256);
    function withdrawableDth(address) view public returns(uint256);
    function teller() view public returns(address);
    function zoneFactory() view public returns(address);
    function MIN_STAKE() view public returns(uint256);
    function country() view public returns(bytes2);
    function control() view public returns(address);
    function geo() view public returns(address);
    function withdrawableEth(address) view public returns(uint256);
    function init(bytes2 _countryCode, bytes7 _geohash, address _zoneOwner, uint256 _dthAmount, address _dth, address _geo, address _control, address _zoneFactory) external;
    function connectToTellerContract(address _teller) external;
    function ownerAddr() view external returns(address);
    function computeCSC(bytes7 _geohash, address _addr) pure public returns(bytes12);
    function calcHarbergerTax(uint256 _startTime, uint256 _endTime, uint256 _dthAmount) view public returns(uint256 taxAmount, uint256 keepAmount);
    function calcEntryFee(uint256 _value) view public returns(uint256 burnAmount, uint256 bidAmount);
    function auctionExists(uint256 _auctionId) view external returns(bool);
    function getZoneOwner() view external returns(address, uint256, uint256, uint256, uint256, uint256);
    function getAuction(uint256 _auctionId) view public returns(uint256, uint256, uint256, uint256, address, uint256);
    function getLastAuction() view external returns(uint256, uint256, uint256, uint256, address, uint256);
    function processState() external;
    function tokenFallback(address _from, uint256 _value, bytes memory _data) public;
    function release() external;
    function withdrawFromAuction(uint256 _auctionId) external;
    function withdrawFromAuctions(uint256[] calldata _auctionIds) external;
    function withdrawDth() external;
    function withdrawEth() external;
    function proxyUpdateUserDailySold(address _to, uint256 _amount) external;
}
