pragma solidity ^0.5.10;

contract IDetherToken {
    function mintingFinished() view public returns(bool);
    function name() view public returns(string memory);
    function approve(address _spender, uint256 _value) public returns(bool);
    function totalSupply() view public returns(uint256);
    function transferFrom(address _from, address _to, uint256 _value) public returns(bool);
    function decimals() view public returns(uint8);
    function mint(address _to, uint256 _amount) public returns(bool);
    function decreaseApproval(address _spender, uint256 _subtractedValue) public returns(bool);
    function balanceOf(address _owner) view public returns(uint256 balance);
    function finishMinting() public returns(bool);
    function owner() view public returns(address);
    function symbol() view public returns(string memory);
    function transfer(address _to, uint256 _value) public returns(bool);
    function transfer(address _to, uint256 _value, bytes memory _data) public returns(bool);
    function increaseApproval(address _spender, uint256 _addedValue) public returns(bool);
    function allowance(address _owner, address _spender) view public returns(uint256);
    function transferOwnership(address newOwner) public;
}
