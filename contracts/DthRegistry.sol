pragma solidity ^0.4.18;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import './dth/tokenfoundry/ERC223ReceivingContract.sol';
import './dth/DetherToken.sol';
/// @title Contract that will store the Dth from user
contract DthRegistry is Ownable, ERC223ReceivingContract {

    mapping(address => uint) public registry;
    DetherToken public dth;
    event receiveDthreg(address indexed _from, uint _amount, bytes _bytes);

    function withdraw(address _to) onlyOwner {
      uint tosend = registry[_to];
      registry[_to] = 0;
      dth.transfer(_to, tosend);
    }

    function DthRegistry (address _dth) {
      dth = DetherToken(_dth);
    }

    function getStaked(address _user) public view returns (uint) {
      return registry[_user];
    }

    function addToken(address _from, uint _value) public onlyOwner {
      registry[_from] += _value;
    }


    /// @dev Standard ERC223 function that will handle incoming token transfers.
    /// @param _from  Token sender address.
    /// @param _value Amount of tokens.
    /// @param _data  Transaction metadata.
    function tokenFallback(address _from, uint _value, bytes _data) {

      /* receiveDthreg(_from, _value, _data); */

      /* require(_from == owner);
      address from = bytesToAddress(_data);
      registry[from] += _value; */

      /* tkn variable is analogue of msg variable of Ether transaction
      *  tkn.sender is person who initiated this token transaction   (analogue of msg.sender)
      *  tkn.value the number of tokens that were sent   (analogue of msg.value)
      *  tkn.data is data of token transaction   (analogue of msg.data)
      */
    }
}
