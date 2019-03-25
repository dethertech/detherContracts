pragma solidity ^0.5.3;

contract IShopsDispute {
    function arbitratorExtraData() view public returns(bytes memory);
    function AMOUNT_OF_CHOICES() view public returns(uint8);
    function RULING_OPTIONS() view public returns(string memory);
    function arbitrator() view public returns(address);
    function disputeTypes(uint256) view public returns(string memory);
    function shops() view public returns(address);
    function control() view public returns(address);
    function users() view public returns(address);
    function getDisputeCreateCost() view public returns(uint256);
    function getDisputeAppealCost(address _shopAddress) view external returns(uint256);
    function getDispute(address _shopAddress) view public returns(uint256, address, address, uint256, uint256, uint256);
    function addDisputeType(string calldata _disputeTypeLink) external;
    function createDispute(address _shopAddress, uint256 _metaEvidenceId, string memory _evidenceLink) payable public;
    function appealDispute(address _shopAddress, string calldata _evidenceLink) payable external;
    function rule(uint256 _disputeID, uint256 _ruling) public;
}
