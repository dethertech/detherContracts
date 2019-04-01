pragma solidity ^0.5.5;

contract IExchangeRateOracle {
    function WAD() view external returns(uint256);
    function mkrPriceFeed() view external returns(address);
    function getWeiPriceOneUsd() view external returns(uint256);
}
