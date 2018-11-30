pragma solidity ^0.4.24;

contract IUsers {
  function updateDailySold(bytes2 _countryCode, address _from, address _to, uint _amount) public;
  function getUserTier(address _user) public view returns (uint foundTier);
}