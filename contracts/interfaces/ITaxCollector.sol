pragma solidity ^0.5.8;

contract ITaxCollector {
    function unchangeableRecipient() external;
    function changeRecipient() external;
    function collect() external;
    function tokenFallback(address _from, uint256 _value, bytes memory _data) public;
}
