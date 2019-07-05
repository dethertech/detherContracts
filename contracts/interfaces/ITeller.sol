pragma solidity ^0.5.10;

contract ITeller {
    function funds() view public returns(uint256);
    function geo() view public returns(address);
    function withdrawableEth(address) view public returns(uint256);
    function canPlaceCertifiedComment(address, address) view public returns(uint256);
    function zone() view public returns(address);
    function init(address _geo, address _zone) external;
    function getComments() view external returns(bytes32[] memory);
    function calcReferrerFee(uint256 _value) view public returns(uint256 referrerAmount);
    function getTeller() view external returns(address, uint8, bytes16, bytes12, bytes1, int16, int16, uint256, address);
    function getReferrer() view external returns(address, uint);
    function hasTeller() view external returns(bool);
    function removeTellerByZone() external;
    function removeTeller() external;
    function addTeller(bytes calldata _position, uint8 _currencyId, bytes16 _messenger, int16 _sellRate, int16 _buyRate, bytes1 _settings, address _referrer, bytes32 _description) external;
    function addComment(bytes32 _commentHash) external;
}
