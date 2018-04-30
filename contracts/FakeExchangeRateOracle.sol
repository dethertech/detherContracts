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

contract FakeExchangeRateOracle is DSMath {
  /**
   * @dev Return wei price of 1 USD
   */
  function getWeiPriceOneUsd() public view returns(uint) {
    // we fake it here so we can test it, the value represents:
    // 513 dollar and 4975 cents
    uint256 weiPriceOneUsd = DSMath.wdiv(WAD, 513497500000000000000);

    return weiPriceOneUsd;
  }
}
