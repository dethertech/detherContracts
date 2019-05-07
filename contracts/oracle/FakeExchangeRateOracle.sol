pragma solidity ^0.5.8;

import "../dappsys/DSMathWdiv.sol";

import "../interfaces/IMedianizer.sol";

contract FakeExchangeRateOracle is DSMathWdiv {
  /**
   * @dev Return wei price of 1 USD
   */
  function getWeiPriceOneUsd() public view returns(uint) {
    // we fake it here so we can test it, the value represents:
    // 150 dollar and 4975 cents
    uint256 weiPriceOneUsd = wdiv(WAD, 150497500000000000000);

    return weiPriceOneUsd;
  }
}
