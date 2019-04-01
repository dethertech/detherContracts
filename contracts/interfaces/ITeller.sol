pragma solidity ^0.5.5;

contract ITeller {
    function funds() view public returns(uint256);
    function control() view public returns(address);
    function geo() view public returns(address);
    function withdrawableEth(address) view public returns(uint256);
    function canPlaceCertifiedComment(address, address) view public returns(uint256);
    function zone() view public returns(address);
    function init(address _geo, address _control, address _zone) external;
    function getCertifiedComments() view external returns(bytes32[] memory);
    function getComments() view external returns(bytes32[] memory);
    function calcReferrerFee(uint256 _value) view public returns(uint256 referrerAmount);
    function getTeller() view external returns(address, uint8, bytes16, bytes12, bytes1, int16, int16, uint256, address);
    function hasTeller() view external returns(bool);
    function removeTellerByZone() external;
    function removeTeller() external;
    function addTeller(bytes calldata _position, uint8 _currencyId, bytes16 _messenger, int16 _sellRate, int16 _buyRate, bytes1 _settings, address _referrer) external;
    function addFunds() payable external;
    function sellEth(address _to, uint256 _amount) external;
    function addCertifiedComment(bytes32 _commentHash) external;
    function addComment(bytes32 _commentHash) external;
}
