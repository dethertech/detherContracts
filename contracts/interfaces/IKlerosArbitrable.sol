pragma solidity ^0.5.3;

contract IKlerosArbitrable {
  enum DisputeStatus {Waiting, Appealable, Solved} // copied from IArbitrable.sol
  function createDispute(uint _choices, bytes memory _extraData) public payable returns(uint disputeID);
  function arbitrationCost(bytes memory _extraData) public view returns(uint fee);
  function appeal(uint _disputeID, bytes memory _extraData) public payable;
  function appealCost(uint _disputeID, bytes memory _extraData) public view returns(uint fee);
  function appealPeriod(uint _disputeID) public view returns(uint start, uint end) {}
  function disputeStatus(uint _disputeID) public view returns(DisputeStatus status);
  function currentRuling(uint _disputeID) public view returns(uint ruling);
}
