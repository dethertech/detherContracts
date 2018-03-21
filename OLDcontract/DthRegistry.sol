pragma solidity ^0.4.18;

import './dth/tokenfoundry/ERC223ReceivingContract.sol';
import './dth/tokenfoundry/ERC223Basic.sol';
import 'bytes/BytesLib.sol';
/// @title Contract that will store the Dth from user
contract DthRegistry is ERC223ReceivingContract {
    using BytesLib for bytes;
    /* mapping(address => uint) public registryTeller; */
    mapping(address => uint) public registryShop;
    ERC223Basic public dth;
    bool public isInit = false;

    /* modifier tellerHasStaked(uint amount) {
      require(getStakedTeller(msg.sender) >= amount);
      _;
    } */

    modifier shopHasStaked(uint amount) {
      require(getStakedShop(msg.sender) >= amount);
      _;
    }

    /* function withdrawTeller() internal {
      require(registryTeller[msg.sender] > 0);
      uint tosend = registryTeller[msg.sender];
      registryTeller[msg.sender] = 0;
      dth.transfer(msg.sender, tosend);
    } */

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

    /* function getStakedTeller(address _user) public view returns (uint) {
      return registryTeller[_user];
    } */

    function getStakedShop(address _user) public view returns (uint) {
      return registryShop[_user];
    }

    /* function addTokenTeller(address _from, uint _value) public {
      registryTeller[_from] += _value;
    } */

    function addTokenShop(address _from, uint _value) public {
      registryShop[_from] += _value;
    }
}
