pragma solidity ^0.4.11;

import './import/Ownable.sol';
import './import/SafeMath.sol';


contract Dether is Ownable, SafeMath {
  // using SafeMath for uint;

  struct Teller {
    int8 rates;               // commission rates teller is going to take 3 digit with 1 decimal
    uint balance;             // balance credited in escrow
    uint volumeTrade;         // volume realised
    uint nbTrade;             // number of trade realised
    uint  lat;
    uint  lng;
    uint zoneId;
    string name;
    int8 currencyId;            // 1 = dollar , 2 = eur, 3 = CNY, 4 = KRW
    int8 avatarId;              // avatar
    string messengerAddr;           // telegram account
  }


  address[] public listAdressesTellers;
  mapping(address => Teller) tellers;

  mapping (uint => address[]) public tellerPerZone;
  event Transfer (address indexed _from, address indexed _to, uint256 _value);

  function registerPoint(uint lat, uint lng, uint zone, int8 rates, int8 avatar, int8 currency, string _address, string _name) payable {
      require(msg.value > 1 finney);
      require(msg.value + tellers[msg.sender].balance < 10 ether);
      tellers[msg.sender].rates = rates;
      tellers[msg.sender].currencyId = currency;
      tellers[msg.sender].avatarId = avatar;
      tellers[msg.sender].balance = add(tellers[msg.sender].balance,msg.value);
      tellers[msg.sender].lat = lat;
      tellers[msg.sender].lng = lng;
      tellers[msg.sender].name = _name;
      tellers[msg.sender].messengerAddr = _address;
      tellerPerZone[zone].push(msg.sender);
      tellers[msg.sender].zoneId = zone;
  }

  function getTellerPos( address _teller ) constant returns (
    uint lat,
    uint lng,
    uint zone) {
        return (tellers[_teller].lat
        , tellers[_teller].lng
        , tellers[_teller].zoneId);
  }

  function getTellerProfile(address _teller) constant returns (int8 rates,
    uint volumeTrade,
    uint nbTrade,
    string name,
    int8 currency,
    int8 avatar,
    string telAddr) {
        return (tellers[_teller].rates
        , tellers[_teller].volumeTrade
        , tellers[_teller].nbTrade
        , tellers[_teller].name
        , tellers[_teller].currencyId
        , tellers[_teller].avatarId
        , tellers[_teller].messengerAddr);
  }

  function updatePoint(uint lat, uint lng, uint zone, int8 rates, string _address) {
      tellers[msg.sender].rates = rates;
      tellers[msg.sender].lat = lat;
      tellers[msg.sender].lng = lng;
      tellers[msg.sender].zoneId = zone;
      tellers[msg.sender].messengerAddr = _address;
  }

  function updatePointAddFund(uint lat, uint lng, uint zone, int8 rates, string _address) payable {
      require(tellers[msg.sender].balance > 1 finney);
      tellers[msg.sender].balance = add(tellers[msg.sender].balance,msg.value);
      tellers[msg.sender].rates = rates;
      tellers[msg.sender].lat = lat;
      tellers[msg.sender].lng = lng;
      tellers[msg.sender].zoneId = zone;
      tellers[msg.sender].messengerAddr = _address;
  }

  function sendCoin (address receiver, uint amount) returns (bool) {
    require(tellers[msg.sender].balance > amount);
    receiver.transfer(amount);
    tellers[msg.sender].balance = sub(tellers[msg.sender].balance, amount);
    tellers[msg.sender].volumeTrade = add(tellers[msg.sender].volumeTrade,amount);
    ++tellers[msg.sender].nbTrade;
    Transfer(msg.sender, receiver, amount);
    return true;
  }


  function getZone(uint zone) constant returns (address[]) {
      return tellerPerZone[zone];
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
