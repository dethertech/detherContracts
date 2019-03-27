pragma solidity ^0.5.3;
pragma experimental ABIEncoderV2;

contract ICertifierRegistry {
    struct Certification {
		address certifier;
		int8 ref;
        uint timestamp;
	}
    function createCertifier(string memory _url) public returns (address );
    function modifyUrl(address _certifierId, string memory _newUrl) public;
    function addCertificationType(address _certifierId, int8 ref, string memory description) public;
    function addDelegate(address _certifierId, address _delegate) public;
	function removeDelegate(address _certifierId, address _delegate) public;
	function certify(address _certifierId, address _who, int8 _type) public;
    function revoke(address _certifierId, address _who) public;
    function isDelegate(address _certifierId, address _who) public view returns(bool);
    function getCerts( address _who) public view returns(Certification[] memory);
}
