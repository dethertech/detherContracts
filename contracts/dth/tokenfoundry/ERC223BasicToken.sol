pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/token/ERC20/BasicToken.sol";

import './ERC223Basic.sol';
import './ERC223ReceivingContract.sol';


/**
 * @title ERC223 standard token implementation.
 */
contract ERC223BasicToken is ERC223Basic, BasicToken {

    /**
      * @dev Transfer the specified amount of tokens to the specified address.
      *      Invokes the `tokenFallback` function if the recipient is a contract.
      *      The token transfer fails if the recipient is a contract
      *      but does not implement the `tokenFallback` function
      *      or the fallback function to receive funds.
      *
      * @param _to    Receiver address.
      * @param _value Amount of tokens that will be transferred.
      * @param _data  Transaction metadata.
      */
    function transfer(address _to, uint _value, bytes _data) public returns (bool) {
        // Standard function transfer similar to ERC20 transfer with no _data .
        // Added due to backwards compatibility reasons .
        uint codeLength;

        assembly {
            // Retrieve the size of the code on target address, this needs assembly .
            codeLength := extcodesize(_to)
        }

        require(super.transfer(_to, _value));

        if(codeLength>0) {
            ERC223ReceivingContract receiver = ERC223ReceivingContract(_to);
            receiver.tokenFallback(msg.sender, _value, _data);
        }
        Transfer(msg.sender, _to, _value, _data);
        return true;
    }

      /**
      * @dev Transfer the specified amount of tokens to the specified address.
      *      Invokes the `tokenFallback` function if the recipient is a contract.
      *      The token transfer fails if the recipient is a contract
      *      but does not implement the `tokenFallback` function
      *      or the fallback function to receive funds.
      *
      * @param _to    Receiver address.
      * @param _value Amount of tokens that will be transferred.
      */
    function transfer(address _to, uint256 _value) public returns (bool) {
        bytes memory empty;
        require(transfer(_to, _value, empty));
        return true;
    }

}
