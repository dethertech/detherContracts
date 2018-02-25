pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol";

/**
 * @title ERC223 standard token interface.
 */

contract ERC223Basic is ERC20Basic {

    /**
      * @dev Transfer the specified amount of tokens to the specified address.
      *      Now with a new parameter _data.
      *
      * @param _to    Receiver address.
      * @param _value Amount of tokens that will be transferred.
      * @param _data  Transaction metadata.
      */
    function transfer(address _to, uint _value, bytes _data) public returns (bool);

    /**
      * @dev triggered when transfer is successfully called.
      *
      * @param _from  Sender address.
      * @param _to    Receiver address.
      * @param _value Amount of tokens that will be transferred.
      * @param _data  Transaction metadata.
      */
    event Transfer(address indexed _from, address indexed _to, uint256 indexed _value, bytes _data);
}
