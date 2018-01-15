pragma solidity ^0.4.18;
//! Based on:
//! SMS verification contract
//! By Gav Wood, 2016.

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import './Certifier.sol';

contract SmsCertifier is Ownable, Certifier {
	modifier only_certified(address _who) { if (!certs[_who].active) return; _; }
	modifier only_delegate(address _who) { require(delegate[_who].active); _; }

	struct Certification {
		bool active;
		mapping (string => bytes32) meta;
	}

	struct Certifier {
		bool active;
		mapping (string => bytes32) meta;
	}

	function addDelegate(address _delegate, bytes32 _who) onlyOwner {
		delegate[_delegate].active = true;
		delegate[_delegate].meta['who'] = _who;
	}

	function removeDelegate(address _delegate) onlyOwner {
		delegate[_delegate].active = false;
	}

	function certify(address _who) only_delegate(msg.sender) {
		certs[_who].active = true;
		Confirmed(_who);
	}
	function revoke(address _who) only_delegate(msg.sender) only_certified(_who) {
		certs[_who].active = false;
		Revoked(_who);
	}

	function isDelegate(address _who) public view returns (bool) { return delegate[_who].active; }
	function isCertified(address _who) public  view returns (bool) { return certs[_who].active; }
	function get(address _who, string _field) public view returns (bytes32) { return certs[_who].meta[_field]; }
	function getAddress(address _who, string _field) public view returns (address) { return address(certs[_who].meta[_field]); }
	function getUint(address _who, string _field) public view returns (uint) { return uint(certs[_who].meta[_field]); }

	mapping (address => Certification) certs;
	// So that the server posting puzzles doesn't have access to the ETH.
	mapping (address => Certifier) delegate;
}
