pragma solidity ^0.5.3;

contract ITeller {
  function withdrawableEth(address _who) public view returns (uint);

  function funds() public view returns (uint);
  function canPlaceCertifiedComment(address _teller, address _poster) public view returns (uint);
  function getComments() public view returns (bytes32[] memory);
  function getCertifiedComments() public view returns (bytes32[] memory);

  function init(address _geo, address _control, address _zone) external;
  function calcReferrerFee(uint _value) public view returns (uint referrerAmount);
  function getTeller() external view returns (address, uint8, bytes16, bytes12, bytes1, int16, int16, uint, address);
  function hasTeller() external view returns (bool);

  function removeComments() external;
  function removeTeller() external;
  function removeTellerByZone() external;
  function addTeller(address _zoneOwner, bytes calldata _position, uint8 _currencyId, bytes16 _messenger, int16 _sellRate, int16 _buyRate, bytes1 _settings, address _referrer) external;
  function addFunds(address _teller) external payable;
  function sellEth(address _to, uint _amount) external;
  function addCertifiedComment(address _poster, bytes32 _commentHash) external;
  function addComment(bytes32 _commentHash) external;
}
