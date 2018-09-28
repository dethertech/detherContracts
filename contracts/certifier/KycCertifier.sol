//! The SMS-verification contract
//!
//! Copyright 2017 Gavin Wood, Parity Technologies Ltd.
//!
//! Licensed under the Apache License, Version 2.0 (the "License");
//! you may not use this file except in compliance with the License.
//! You may obtain a copy of the License at
//!
//!     http://www.apache.org/licenses/LICENSE-2.0
//!
//! Unless required by applicable law or agreed to in writing, software
//! distributed under the License is distributed on an "AS IS" BASIS,
//! WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//! See the License for the specific language governing permissions and
//! limitations under the License.

pragma solidity ^0.4.18;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';

contract KycCertifier is Ownable {
	event Confirmed(address indexed who);
	event Revoked(address indexed who);
	modifier only_certified(address _who) { require(certs[_who].active); _; }
	modifier only_delegate(address _who) { require(delegate[_who].active); _; }

	mapping (address => Certification) certs;
	mapping (address => Certifier) delegate;

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
	function certified(address _who) public  view returns (bool) { return certs[_who].active; }
	function get(address _who, string _field) public view returns (bytes32) { return certs[_who].meta[_field]; }
	function getAddress(address _who, string _field) public view returns (address) { return address(certs[_who].meta[_field]); }
	function getUint(address _who, string _field) public view returns (uint) { return uint(certs[_who].meta[_field]); }

}
