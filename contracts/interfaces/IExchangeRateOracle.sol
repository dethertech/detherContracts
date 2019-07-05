pragma solidity ^0.5.10;

contract IExchangeRateOracle {
    function WAD() view external returns(uint256);
    function mkrPriceFeed() view external returns(address);
    function getWeiPriceOneUsd() view external returns(uint256);
}
