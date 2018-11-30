pragma solidity ^0.4.24;

import "../dappsys/DSMathWdiv.sol";
import "./IExchangeRateOracle.sol";
import "./IMedianizer.sol";

contract FakeExchangeRateOracle is DSMathWdiv, IExchangeRateOracle {
  /**
   * @dev Return wei price of 1 USD
   */
  function getWeiPriceOneUsd() public view returns(uint) {
    // we fake it here so we can test it, the value represents:
    // 513 dollar and 4975 cents
    uint256 weiPriceOneUsd = wdiv(WAD, 513497500000000000000);

    return weiPriceOneUsd;
  }
}
