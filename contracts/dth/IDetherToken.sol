pragma solidity ^0.4.24;

contract IDetherToken {
  function transferFrom(address from, address to, uint256 value) public returns (bool);
  function balanceOf(address who) public view returns (uint256);
  function transfer(address to, uint256 value) public returns (bool);
  function allowance(address owner, address spender) public view returns (uint256);
}