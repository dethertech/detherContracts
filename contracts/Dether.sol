pragma solidity ^0.4.11;

import './import/Ownable.sol';
import './import/SafeMath.sol';


contract Dether is Ownable, SafeMath {

  // state variables

  struct Teller {
    int8 rate;                // commission rate teller is going to take 3 digit with 1 decimal
    uint balance;             // balance credited in escrow
    uint volumeTrade;         // volume realised
    uint nbTrade;             // number of trade realised
    uint lat;
    uint lng;
    uint zoneId;
    string name;
    int8 currencyId;            // 1 = dollar , 2 = eur, 3 = CNY, 4 = KRW
    int8 avatarId;              // avatar
    string messengerAddr;       // telegram account
  }


  address[] public listAdressesTellers;
  mapping(address => Teller) tellers;

  // will be modified with a circular listed chain to be able to delete
  mapping (uint => address[]) public tellerPerZone;
  event Transfer (address indexed _from, address indexed _to, uint256 _value);

  // public functions

  function registerPoint(
    uint _lat,
    uint _lng,
    uint _zone,
    int8 _rate,
    int8 _avatar,
    int8 _currency,
    string _address,
    string _name
    ) payable {
      require(msg.value > 1 finney);
      require(msg.value + tellers[msg.sender].balance < 10 ether);
      tellers[msg.sender].rate = _rate;
      tellers[msg.sender].currencyId = _currency;
      tellers[msg.sender].avatarId = _avatar;
      tellers[msg.sender].balance = add(tellers[msg.sender].balance,msg.value);
      tellers[msg.sender].lat = _lat;
      tellers[msg.sender].lng = _lng;
      tellers[msg.sender].name = _name;
      tellers[msg.sender].messengerAddr = _address;
      tellerPerZone[_zone].push(msg.sender);
      tellers[msg.sender].zoneId = _zone;
  }

  function getTellerPos(address _teller) constant returns (
    uint lat,
    uint lng,
    uint zone) {
    return (
      tellers[_teller].lat,
      tellers[_teller].lng,
      tellers[_teller].zoneId
    );
  }

  // add require > 100 finney
  function getTellerProfile(address _teller) constant returns (int8 rates,
    uint volumeTrade,
    uint nbTrade,
    string name,
    int8 currency,
    int8 avatar,
    string telAddr) {
      require(tellers[_teller].balance > 100 finney);
      return (tellers[_teller].rate
      , tellers[_teller].volumeTrade
      , tellers[_teller].nbTrade
      , tellers[_teller].name
      , tellers[_teller].currencyId
      , tellers[_teller].avatarId
      , tellers[_teller].messengerAddr);
  }

  function updatePoint(
    uint _lat,
    uint _lng,
    uint _zone,
    int8 _rate,
    string _address
  ) {
      tellers[msg.sender].rate = _rate;
      tellers[msg.sender].lat = _lat;
      tellers[msg.sender].lng = _lng;
      tellers[msg.sender].zoneId = _zone;
      tellers[msg.sender].messengerAddr = _address;
  }

  function updatePointAddFund(
    uint _lat,
    uint _lng,
    uint _zone,
    int8 _rate,
    string _address
  ) payable {
      require(tellers[msg.sender].balance > 1 finney);
      tellers[msg.sender].balance = add(tellers[msg.sender].balance,msg.value);
      tellers[msg.sender].rate = _rate;
      tellers[msg.sender].lat = _lat;
      tellers[msg.sender].lng = _lng;
      tellers[msg.sender].zoneId = _zone;
      tellers[msg.sender].messengerAddr = _address;
  }

  function sendCoin (address _receiver, uint _amount) returns (bool) {
    require(tellers[msg.sender].balance > _amount);
    _receiver.transfer(_amount);
    tellers[msg.sender].balance = sub(tellers[msg.sender].balance, _amount);
    tellers[msg.sender].volumeTrade = add(tellers[msg.sender].volumeTrade, _amount);
    ++tellers[msg.sender].nbTrade;
    Transfer(msg.sender, _receiver, _amount);
    return true;
  }


  function getZone(uint _zone) constant returns (address[]) {
      return tellerPerZone[_zone];
  }

  /// withdraw the total bablance
  function withdrawAll() {
    msg.sender.transfer(tellers[msg.sender].balance);
    tellers[msg.sender].balance = 0;
  }

  function getTellerBalances(address _address) constant returns (uint) {
    return tellers[_address].balance;
  }

}
