pragma solidity ^0.5.3;

contract IUsers {
    function zoneFactoryAddress() view public returns(address);
    function kycCertifier() view public returns(address);
    function priceOracle() view public returns(address);
    function smsCertifier() view public returns(address);
    function getHour(uint256 timestamp) pure public returns(uint8);
    function volumeSell(address) view public returns(uint256);
    function nbTrade(address) view public returns(uint256);
    function getWeekday(uint256 timestamp) pure public returns(uint8);
    function toTimestamp(uint16 year, uint8 month, uint8 day, uint8 hour, uint8 minute) pure public returns(uint256 timestamp);
    function getDay(uint256 timestamp) pure public returns(uint8);
    function toTimestamp(uint16 year, uint8 month, uint8 day, uint8 hour) pure public returns(uint256 timestamp);
    function getSecond(uint256 timestamp) pure public returns(uint8);
    function toTimestamp(uint16 year, uint8 month, uint8 day) pure public returns(uint256 timestamp);
    function toTimestamp(uint16 year, uint8 month, uint8 day, uint8 hour, uint8 minute, uint8 second) pure public returns(uint256 timestamp);
    function getYear(uint256 timestamp) pure public returns(uint16);
    function getMonth(uint256 timestamp) pure public returns(uint8);
    function isLeapYear(uint16 year) pure public returns(bool);
    function leapYearsBefore(uint256 year) pure public returns(uint256);
    function getDaysInMonth(uint8 month, uint16 year) pure public returns(uint8);
    function control() view public returns(address);
    function geo() view public returns(address);
    function volumeBuy(address) view public returns(uint256);
    function getMinute(uint256 timestamp) pure public returns(uint8);
    function setZoneFactory(address _zoneFactory) external;
    function updateDailySold(bytes2 _countryCode, address _from, address _to, uint256 _amount) external;
    function getUserTier(address _who) view public returns(uint256 foundTier);
    function getDateInfo(uint256 timestamp) pure external returns(uint16, uint16, uint16);
    function setUserTier(address _who, int8 _num) external;
    function modifyUserTier(int8 _num) public;
}
