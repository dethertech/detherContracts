pragma solidity ^0.4.18;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import './dth/tokenfoundry/ERC223ReceivingContract.sol';
import './dth/tokenfoundry/ERC223Basic.sol';
import 'bytes/BytesLib.sol';
/// @title Contract that will store the Dth from user
contract DetherBank is ERC223ReceivingContract, Ownable {
    using BytesLib for bytes;
    using SafeMath for uint256;


    /*
     * Event
     */
    event receiveDth(address _from, uint amount);
    event receiveEth(address _from, uint amount);
    event sendDth(address _from, uint amount);
    event sendEth(address _from, uint amount);

    event TempLog(address _from, uint amount1, uint amount2);

    mapping(address => uint) public dthShopBalance;
    mapping(address => uint) public dthTellerBalance;
    mapping(address => uint) public ethShopBalance;
    mapping(address => uint) public ethTellerBalance;

    ERC223Basic public dth;
    bool public isInit = false;


    function setDth (address _dth) {
      require(!isInit);
      dth = ERC223Basic(_dth);
      isInit = true;
    }
    function withdrawDthTeller(address _receiver) onlyOwner {
      require(dthTellerBalance[_receiver] > 0);
      uint tosend = dthTellerBalance[_receiver];
      dthTellerBalance[_receiver] = 0;
      dth.transfer(_receiver, tosend);
    }
    function withdrawDthShop(address _receiver) onlyOwner  {
      require(dthShopBalance[_receiver] > 0);
      uint tosend = dthShopBalance[_receiver];
      dthShopBalance[_receiver] = 0;
      dth.transfer(_receiver, tosend);
    }

    function addTokenShop(address _from, uint _value) public onlyOwner {
      dthShopBalance[_from] += _value;
    }
    function addTokenTeller(address _from, uint _value) public onlyOwner{
      dthTellerBalance[_from] += _value;
    }

    function addEthTeller(address _from, uint _value) public payable onlyOwner {
      TempLog(_from, _value, msg.value);
      ethTellerBalance[_from] += _value;
    }
    function withdrawEth(address _from, address _to, uint _amount) public onlyOwner {
      require(ethTellerBalance[_from] >= _amount);
      ethTellerBalance[_from] -= _amount;
      _to.transfer(_amount);
    }

    function refundEth(address _from) public onlyOwner {
      uint toSend = ethTellerBalance[_from];
      if (toSend > 0) {
        ethTellerBalance[_from] = 0;
        _from.transfer(toSend);
      }
    }

    function getDthTeller(address _user) public view returns (uint) {
      return dthTellerBalance[_user];
    }
    function getDthShop(address _user) public view returns (uint) {
      return dthShopBalance[_user];
    }

    function getEthBalTeller(address _user) public view returns (uint) {
      return ethTellerBalance[_user];
    }
    /// @dev Standard ERC223 function that will handle incoming token transfers.
    /// @param _from  Token sender address.
    /// @param _value Amount of tokens.
    /// @param _data  Transaction metadata.
    function tokenFallback(address _from, uint _value, bytes _data) {

    }

}
