pragma solidity ^0.5.3;

contract IUsers {
  function updateDailySold(bytes2 _countryCode, address _from, address _to, uint _amount) public;
  function getUserTier(address _user) public view returns (uint foundTier);
}