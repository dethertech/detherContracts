
pragma solidity ^0.5.5;
pragma experimental ABIEncoderV2;

// TO DO
// add gas cost
// add remove certs
// add transferOwnership of certifier
// get specific certs (is dether certs?)

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
	// mapping (address => mapping(address => int8)) public certs;

	mapping (address => Certifier) public certifier;
	
	// ------------------------------------------------
  //
  // Events
  //
  // ------------------------------------------------

	event CertifierConfirmed(address indexed who);
	event CertifierRevoked(address indexed who);

	// ------------------------------------------------
  //
  // Modifiers
  //
  // ------------------------------------------------
	modifier only_certification_owner(address _certifierId, address _who) { require(certifier[_certifierId].owner == _who); _; }
	// modifier only_certified(address _who) { require(certs[_who].active); _; }
	modifier only_delegate(address _certifierId, address _who) { require(certifier[_certifierId].delegate[_who]); _; }

	// ------------------------------------------------
  //
  // Constructor
  //
  // ------------------------------------------------


	// ------------------------------------------------
	//
	// Functions Certifier management
	//
	// ------------------------------------------------

    function createCertifier(string memory _url) public returns (address certifiedId) {
			// create new certifier and register it
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
		// require(control.isCEO(msg.sender), "caller needs to be CEO");
		certifier[_certifierId].delegate[_delegate] = true;
	}

	function removeDelegate(address _certifierId, address _delegate) public only_certification_owner(_certifierId, msg.sender)
	{
		// require(control.isCEO(msg.sender), "caller needs to be CEO");
		certifier[_certifierId].delegate[_delegate] = false;
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
		// certs[_who].active = true; // add certification
		certs[_who].push(Certification({certifier: _certifierId, ref: _type, timestamp: now}));

	}

	function revoke(address _certifierId, address _who)
		public
		only_delegate(_certifierId, msg.sender)
		// only_certified(_who)
	{
		// certs[_who].active = false;
		emit CertifierRevoked(_who);
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

	// function isCert(address _certifierId, address _who) public view returns(bool) {

	// }
}
