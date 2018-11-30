pragma solidity ^0.4.24;

contract IMedianizer {
  function peek() constant public returns (bytes32, bool);
}