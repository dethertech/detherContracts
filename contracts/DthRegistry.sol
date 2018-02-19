pragma solidity ^0.4.18;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import './dth/tokenfoundry/ERC223ReceivingContract.sol';
/// @title Contract that will store the Dth from user
contract DthRegistry is Ownable, ERC223ReceivingContract {

    mapping(address => uint) public registry;
    event receiveDthreg(address indexed _from, uint _amount, bytes _bytes);

    modifier hasStaked(uint amount) {
      require(registry[msg.sender] >= amount);
      _;
    }

    /* function withdraw(amount) {

    } */

    function bytesToAddress(bytes _address) public returns (address) {
      uint160 m = 0;
      uint160 b = 0;

      for (uint8 i = 0; i < 20; i++) {
        m *= 256;
        b = uint160(_address[i]);
        m += (b);
      }

      return address(m);
    }

    /// @dev Standard ERC223 function that will handle incoming token transfers.
    /// @param _from  Token sender address.
    /// @param _value Amount of tokens.
    /// @param _data  Transaction metadata.
    function tokenFallback(address _from, uint _value, bytes _data) {
      //TKN memory tkn;
      require(_from == owner);
      /* address from = bytesToAddr(_data); */
      address from = bytesToAddress(_data);
      receiveDthreg(msg.sender, _value, _data);
      registry[from] += _value;
      /* tkn variable is analogue of msg variable of Ether transaction
      *  tkn.sender is person who initiated this token transaction   (analogue of msg.sender)
      *  tkn.value the number of tokens that were sent   (analogue of msg.value)
      *  tkn.data is data of token transaction   (analogue of msg.data)
      */
    }
}
