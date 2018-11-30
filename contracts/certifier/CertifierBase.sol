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
//
// NOTE: added parent ICertifier to SmsCertifier contract
//

pragma solidity ^0.4.24;

import "../core/IControl.sol";
import "./ICertifier.sol";

contract CertifierBase is ICertifier {
	// ------------------------------------------------
	//
	// Structs
	//
	// ------------------------------------------------

	struct Certification {
		bool active;
		mapping (string => bytes32) meta;
	}

	struct Certifier {
		bool active;
		mapping (string => bytes32) meta;
	}

	// ------------------------------------------------
  //
  // Variables Public
  //
  // ------------------------------------------------

	IControl public control;
	mapping (address => Certification) public certs;
	mapping (address => Certifier) public delegate;

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

	modifier only_certified(address _who) { require(certs[_who].active); _; }
	modifier only_delegate(address _who) { require(delegate[_who].active); _; }

	// ------------------------------------------------
  //
  // Constructor
  //
  // ------------------------------------------------

  constructor(address _control)
    public
  {
		control = IControl(_control);
	}

	// ------------------------------------------------
	//
	// Functions Setters Public
	//
	// ------------------------------------------------

	function addDelegate(address _delegate)
		public
	{
		require(control.isCEO(msg.sender), "caller needs to be CEO");
		delegate[_delegate].active = true;
	}

	function removeDelegate(address _delegate)
		public
	{
		require(control.isCEO(msg.sender), "caller needs to be CEO");
		delegate[_delegate].active = false;
	}

	function certify(address _who)
		public
		only_delegate(msg.sender)
	{
		certs[_who].active = true;
		emit CertifierConfirmed(_who);
	}
	function revoke(address _who)
		public
		only_delegate(msg.sender)
		only_certified(_who)
	{
		certs[_who].active = false;
		emit CertifierRevoked(_who);
	}

	// ------------------------------------------------
	//
	// Functions Getters Public
	//
	// ------------------------------------------------

	function isDelegate(address _who) public view returns (bool) { return delegate[_who].active; }
	function certified(address _who) public  view returns (bool) { return certs[_who].active; }
	function get(address _who, string _field) public view returns (bytes32) { return certs[_who].meta[_field]; }
	function getAddress(address _who, string _field) public view returns (address) { return address(certs[_who].meta[_field]); }
	function getUint(address _who, string _field) public view returns (uint) { return uint(certs[_who].meta[_field]); }
}
