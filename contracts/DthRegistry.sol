pragma solidity ^0.4.18;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import './dth/tokenfoundry/ERC223ReceivingContract.sol';
import './dth/tokenfoundry/ERC223Basic.sol';
import 'bytes/BytesLib.sol';
/// @title Contract that will store the Dth from user
contract DthRegistry is ERC223ReceivingContract {
    using BytesLib for bytes;
    mapping(address => uint) public registryTeller;
    mapping(address => uint) public registryShop;
    ERC223Basic public dth;
    bool public isInit = false;
    event ReceiveDthShop(address indexed _from, uint _amount, bytes _bytes);
    event ReceiveDthTeller(address indexed _from, uint _amount, bytes _bytes);
    event LogBytes(string logs, bytes data);
    event LogBytes1(string logs, bytes1 data);


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

      bytes memory _lat = _data.slice(0,16);
      bytes memory _lng = _data.slice(16,16);
      bytes memory _countryId = _data.slice(32,2);
      bytes memory _postalCode = _data.slice(34,16);
      bytes memory _cat = _data.slice(50,16);
      bytes memory _name = _data.slice(66,16);
      bytes memory _description = _data.slice(82,32);
      bytes memory _opening = _data.slice(114,16);
      bytes memory _func = _data.slice(130,1);

      LogBytes('lat ', _lat);
      LogBytes('lng ', _lng);
      LogBytes('countryId', _countryId);
      LogBytes('postal', _postalCode);
      LogBytes('cat', _cat);
      LogBytes('name', _name);
      LogBytes('description', _description);
      LogBytes('opening', _opening);
      LogBytes('func ', _func);
      addTokenShop(_from,_value);
      ReceiveDthShop(_from, _value, _data);

      /* tkn variable is analogue of msg variable of Ether transaction
      *  tkn.sender is person who initiated this token transaction   (analogue of msg.sender)
      *  tkn.value the number of tokens that were sent   (analogue of msg.value)
      *  tkn.data is data of token transaction   (analogue of msg.data)
      */
    }
}
