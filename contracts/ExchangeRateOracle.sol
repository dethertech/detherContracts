pragma solidity ^0.4.21;

contract DSMath {
  function add(uint x, uint y) internal pure returns (uint z) {
    require((z = x + y) >= x);
  }
  function mul(uint x, uint y) internal pure returns (uint z) {
    require(y == 0 || (z = x * y) / y == x);
  }

  uint constant WAD = 10 ** 18;

  function wdiv(uint x, uint y) internal pure returns (uint z) {
    z = add(mul(x, WAD), y / 2) / y;
  }
}

contract Medianizer {
  function peek() constant public returns (bytes32, bool);
}

contract ExchangeRateOracle is DSMath {

  Medianizer public mkrPriceFeed;

  function ExchangeRateOracle(address mkrPriceFeed_) public {
    mkrPriceFeed = Medianizer(mkrPriceFeed_);
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
    uint256 weiPriceOneUsd = DSMath.wdiv(WAD, uint(priceRaw));

    return weiPriceOneUsd;
  }
}
