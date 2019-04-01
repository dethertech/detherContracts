pragma solidity ^0.5.5;

contract IGeoRegistry {
    function countryIsEnabled(bytes2) view public returns(bool);
    function enabledCountries(uint256) view public returns(bytes2);
    function level_2(bytes2, bytes3) view public returns(bytes4);
    function shopLicensePrice(bytes2) view public returns(uint256);
    function control() view public returns(address);
    function countryTierDailyLimit(bytes2, uint256) view public returns(uint256);
    function validGeohashChars(bytes memory _bytes) public returns(bool);
    function validGeohashChars12(bytes12 _bytes) public returns(bool);
    function zoneInsideCountry(bytes2 _countryCode, bytes4 _zone) view public returns(bool);
    function setCountryTierDailyLimit(bytes2 _countryCode, uint256 _tier, uint256 _limitUsd) public;
    function updateLevel2(bytes2 _countryCode, bytes3 _letter, bytes4 _subLetters) public;
    function updateLevel2batch(bytes2 _countryCode, bytes3[] memory _letters, bytes4[] memory _subLetters) public;
    function enableCountry(bytes2 _country) external;
    function disableCountry(bytes2 _country) external;
}
