pragma solidity ^0.5.3;

contract IDetherToken {
  function transfer(address to, uint256 value) public returns (bool);
  function transfer(address _to, uint _value, bytes memory _data) public returns (bool);
}