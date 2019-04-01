pragma solidity ^0.5.5;

contract IMedianizer {
  function peek() view public returns (bytes32, bool);
}