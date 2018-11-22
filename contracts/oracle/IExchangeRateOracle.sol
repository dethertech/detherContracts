pragma solidity ^0.4.24;

contract IExchangeRateOracle {
  function getWeiPriceOneUsd() public view returns(uint);
}
