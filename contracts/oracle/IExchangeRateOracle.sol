pragma solidity ^0.5.3;

contract IExchangeRateOracle {
  function getWeiPriceOneUsd() public view returns(uint);
}
