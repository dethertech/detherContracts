pragma solidity ^0.5.10;

contract IMedianizer {
  function peek() view public returns (bytes32, bool);
}