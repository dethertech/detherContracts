pragma solidity ^0.5.5;

contract DSMathWdiv {
  function add(uint x, uint y) internal pure returns (uint z) {
    require((z = x + y) >= x);
  }
  function mul(uint x, uint y) internal pure returns (uint z) {
    require(y == 0 || (z = x * y) / y == x);
  }

  uint public constant WAD = 10 ** 18;

  function wdiv(uint x, uint y) internal pure returns (uint z) {
    z = add(mul(x, WAD), y / 2) / y;
  }
}