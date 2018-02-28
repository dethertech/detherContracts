pragma solidity ^0.4.18;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import './dth/tokenfoundry/ERC223ReceivingContract.sol';
import './dth/tokenfoundry/ERC223Basic.sol';
/// @title Contract that will store the Dth from user
contract DthRegistry is ERC223ReceivingContract {

    mapping(address => uint) public registryTeller;
    mapping(address => uint) public registryShop;
    ERC223Basic public dth;
    bool public isInit = false;
    event ReceiveDthShop(address indexed _from, uint _amount, bytes _bytes);
    event ReceiveDthTeller(address indexed _from, uint _amount, bytes _bytes);

    modifier tellerHasStaked(uint amount) {
      require(getStakedTeller(msg.sender) >= amount);
      _;
    }

    modifier shopHasStaked(uint amount) {
      require(getStakedShop(msg.sender) >= amount);
      _;
    }

    function withdrawTeller() internal {
      require(registryTeller[msg.sender] > 0);
      uint tosend = registryTeller[msg.sender];
      registryTeller[msg.sender] = 0;
      dth.transfer(msg.sender, tosend);
    }

    function _withdrawShop(address _receiver) internal {
      require(registryShop[_receiver] > 0);
      uint tosend = registryShop[_receiver];
      registryShop[_receiver] = 0;
      dth.transfer(_receiver, tosend);
    }

    function setDth (address _dth) {
      require(!isInit);
      dth = ERC223Basic(_dth);
      isInit = true;
    }

    function getStakedTeller(address _user) public view returns (uint) {
      return registryTeller[_user];
    }

    function getStakedShop(address _user) public view returns (uint) {
      return registryShop[_user];
    }

    function addTokenTeller(address _from, uint _value) public {
      registryTeller[_from] += _value;
    }

    function addTokenShop(address _from, uint _value) public {
      registryShop[_from] += _value;
    }

    /// @dev Standard ERC223 function that will handle incoming token transfers.
    /// @param _from  Token sender address.
    /// @param _value Amount of tokens.
    /// @param _data  Transaction metadata.
    function tokenFallback(address _from, uint _value, bytes _data) {

      addTokenShop(_from,_value);
      ReceiveDthShop(_from, _value, _data);

      /* tkn variable is analogue of msg variable of Ether transaction
      *  tkn.sender is person who initiated this token transaction   (analogue of msg.sender)
      *  tkn.value the number of tokens that were sent   (analogue of msg.value)
      *  tkn.data is data of token transaction   (analogue of msg.data)
      */
    }
}
