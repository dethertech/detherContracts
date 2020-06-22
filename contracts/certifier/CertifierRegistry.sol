pragma solidity ^0.5.10;
pragma experimental ABIEncoderV2;

// TO DO
// add gas cost

contract CertifierRegistry {
	// ------------------------------------------------
	//
	// Structs
	//
	// ------------------------------------------------

	struct Certification {
		address certifier;
		int8 ref;
    	uint timestamp;
	}

	struct Certifier {
		address owner;
		string url; 	// need a website url to prove the certifier ID
		mapping (address => bool) delegate;
		mapping (int8 => string) certificationType;
	}

	// ------------------------------------------------
	//
	// Variables Public
	//
	// ------------------------------------------------

	mapping (address => Certification[]) public certs;
	mapping (address => Certifier) public certifier;
	
	// ------------------------------------------------
	//
	// Events
	//
	// ------------------------------------------------

	event Certified(address indexed certifier, address certified, int8 certification);
	event AddDelegate(address indexed certifierID, address _delegate);
	event RemoveDelegate(address indexed certifierID, address _delegate);

	// ------------------------------------------------
	//
	// Modifiers
	//
	// ------------------------------------------------
	modifier only_certification_owner(address _certifierId, address _who) {
		require(certifier[_certifierId].owner == _who, "caller must be certification owner");
		_;
	}
	modifier only_delegate(address _certifierId, address _who) {
		require(certifier[_certifierId].delegate[_who], "caller must be delegate"); 
		_;
	}


	// ------------------------------------------------
	//
	// Functions Certifier management
	//
	// ------------------------------------------------

	function createCertifier(string memory _url) public returns (address certifiedId) {
		certifiedId = msg.sender;
		certifier[certifiedId].owner = msg.sender;
		certifier[certifiedId].url = _url;
	}
	function modifyUrl(address _certifierId, string memory _newUrl) public only_certification_owner(_certifierId, msg.sender) {
			certifier[msg.sender].url = _newUrl;
	}
	function addCertificationType(address _certifierId, int8 ref, string memory description) public only_certification_owner(_certifierId, msg.sender) {
			certifier[msg.sender].certificationType[ref] = description;
	}
	function addDelegate(address _certifierId, address _delegate) public only_certification_owner(_certifierId, msg.sender)
	{
		certifier[_certifierId].delegate[_delegate] = true;
		emit AddDelegate(_certifierId, _delegate);
	}
	function removeDelegate(address _certifierId, address _delegate) public only_certification_owner(_certifierId, msg.sender)
	{
		certifier[_certifierId].delegate[_delegate] = false;
		emit RemoveDelegate(_certifierId, _delegate);
  	}

    // ------------------------------------------------
	//
	// Functions Certifier
	//
	// ------------------------------------------------

	function certify(address _certifierId, address _who, int8 _type)
		public
		only_delegate(_certifierId, msg.sender)
	{
		certs[_who].push(Certification({certifier: _certifierId, ref: _type, timestamp: now}));
		emit Certified(_certifierId, _who, _type);
	}

	// ------------------------------------------------
	//
	// Functions Getters Public
	//
	// ------------------------------------------------

	function isDelegate(address _certifierId, address _who) public view returns(bool) { return certifier[_certifierId].delegate[_who]; }

	function getCertificationType(address _certifierId, int8 _number) public view returns( string memory) {
		return certifier[_certifierId].certificationType[_number];
	}

	function getCerts( address _who) public view returns(Certification[] memory) {
		return certs[_who];
	}
}
