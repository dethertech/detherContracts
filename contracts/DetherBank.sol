pragma solidity ^0.4.18;

import './dth/tokenfoundry/ERC223ReceivingContract.sol';
import './dth/tokenfoundry/ERC223Basic.sol';
import 'bytes/BytesLib.sol';
/// @title Contract that will store the Dth from user
contract DetherBank is ERC223ReceivingContract {
    using BytesLib for bytes;

    /*
     * Event
     */
    event receiveDth(address _from, uint amount);
    event receiveEth(address _from, uint amount);
    event sendDth(address _from, uint amount);
    event sendEth(address _from, uint amount);

    mapping(address => uint) public dthShopBalance;
    mapping(address => uint) public dthTellerBalance;
    mapping(address => uint) public ethShopBalance;
    mapping(address => uint) public ethTellerBalance;

    ERC223Basic public dth;
    bool public isInit = false;

    /* modifier tellerHasStaked(uint amount) {
      require(getStakedTeller(msg.sender) >= amount);
      _;
    } */

    /* modifier shopHasStaked(uint amount) {
      require(getDthShop(msg.sender) >= amount);
      _;
    }
    modifier tellerHasStaked(uint amount) {
      require(getDthTeller(msg.sender) >= amount);
      _;
    } */


    function setDth (address _dth) {
      require(!isInit);
      dth = ERC223Basic(_dth);
      isInit = true;
    }
    function withdrawDthTeller(address _receiver) {
      require(dthTellerBalance[_receiver] > 0);
      uint tosend = dthTellerBalance[_receiver];
      dthTellerBalance[_receiver] = 0;
      dth.transfer(_receiver, tosend);
    }
    function withdrawDthShop(address _receiver)  {
      require(dthShopBalance[_receiver] > 0);
      uint tosend = dthShopBalance[_receiver];
      dthShopBalance[_receiver] = 0;
      dth.transfer(_receiver, tosend);
    }

    function addTokenShop(address _from, uint _value) public {
      dthShopBalance[_from] += _value;
    }
    function addTokenTeller(address _from, uint _value) public {
      dthTellerBalance[_from] += _value;
    }

    function addEthShop(address _from, uint _value) public {
      ethShopBalance[_from] += _value;
    }
    function addEthTeller(address _from, uint _value) public {
      ethTellerBalance[_from] += _value;
    }
    function withdrawEth(address _to) public {
      uint toSend = ethTellerBalance[_to];
      ethTellerBalance[_to] = 0;

      /* _to.transfer(_to, _value); */
    }

    function getDthTeller(address _user) public view returns (uint) {
      return dthTellerBalance[_user];
    }
    function getDthShop(address _user) public view returns (uint) {
      return dthShopBalance[_user];
    }


    /// @dev Standard ERC223 function that will handle incoming token transfers.
    /// @param _from  Token sender address.
    /// @param _value Amount of tokens.
    /// @param _data  Transaction metadata.
    function tokenFallback(address _from, uint _value, bytes _data) {

    }

}
