pragma solidity ^0.5.3;

contract IMedianizer {
  function peek() view public returns (bytes32, bool);
}