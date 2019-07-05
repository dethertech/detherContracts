pragma solidity ^0.5.10;

import "../dappsys/DSMathWdiv.sol";

import "../interfaces/IMedianizer.sol";

contract ExchangeRateOracle is DSMathWdiv {

  IMedianizer public mkrPriceFeed;

  constructor(address mkrPriceFeed_)
    public
  {
    mkrPriceFeed = IMedianizer(mkrPriceFeed_);
  }

  /**
   * @dev Return wei price of 1 USD
   */
  function getWeiPriceOneUsd() public view returns(uint) {
    // get usd price of 1 eth from maker contract
    bytes32 priceRaw;
    bool success;
    (priceRaw, success) = mkrPriceFeed.peek();

    // convert "1 eth = X usd" to "X eth = 1 usd"
    uint256 weiPriceOneUsd = wdiv(WAD, uint(priceRaw));

    return weiPriceOneUsd;
  }
}
