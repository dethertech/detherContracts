pragma solidity ^0.5.3;

contract ICertifier {
    function certs(address) view public returns(bool active);
    function delegate(address) view public returns(bool active);
    function control() view public returns(address);
    function addDelegate(address _delegate) public;
    function removeDelegate(address _delegate) public;
    function certify(address _who) public;
    function revoke(address _who) public;
    function isDelegate(address _who) view public returns(bool);
    function certified(address _who) view public returns(bool);
    function get(address _who, string memory _field) view public returns(bytes32);
}
