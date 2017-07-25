pragma solidity ^0.4.11;

import './import/Ownable.sol';
import './import/SafeMath.sol';

contract Dether is Ownable, SafeMath {
  // using SafeMath for uint;
  struct Pos {
    uint lat;
    uint lng;
  }
  enum Currency {
      USD,
      EUR,
      KRW,
      CNY
  }
  // add event
  struct Teller {
    int8 rates;               // commission rates teller is going to take 3 digit with 1 decimal
    uint balance;             // balance credited in escrow
    uint volumeTrade;         // volume realised
    uint nbTrade;             // number of trade realised
    uint lat;
    uint lng;
    uint zone;
    string name;
    Currency currency;            // 1 = dollar , 2 = eur, 3 = CNY, 4 = KRW
    int8 avatar;              // avatar
    string telAddr;           // telegram account
  }

  address[] public listAdressesTellers;
  address public rewardFund;
  mapping(address => Teller) public tellers;

  mapping (uint => address[]) public tellerPerZone;

  event Transfer (address indexed _from, address indexed _to, uint256 _value);
  event Debug(string str, uint number);

    // should take an address and put it on a zone
  function registerPoint(uint lat, uint lng, uint zone, int8 rates, int8 avatar, Currency currency, string _address, string _name) payable {
      require(msg.value > 1 finney);
      tellers[msg.sender].rates = rates;
      tellers[msg.sender].currency = currency;
      tellers[msg.sender].avatar = avatar;
      tellers[msg.sender].balance = add(tellers[msg.sender].balance,msg.value);
      tellers[msg.sender].lat = lat;
      tellers[msg.sender].lng = lng;
      tellers[msg.sender].zone = zone;
      tellers[msg.sender].name = _name;
      tellers[msg.sender].telAddr = _address;
      tellerPerZone[zone].push(msg.sender);
  }

  function updatePoint(uint lat, uint lng, uint zone, int8 rates, string _address) {
      require(tellers[msg.sender].balance > 0);
      tellers[msg.sender].rates = rates;
      tellers[msg.sender].lat = lat;
      tellers[msg.sender].lng = lng;
      tellers[msg.sender].zone = zone;
      tellers[msg.sender].telAddr = _address;
  }

  function updatePointWithFund(uint lat, uint lng, uint zone, int8 rates, string _address) payable {
      require(msg.value > 10 finney);
      tellers[msg.sender].rates = rates;
      tellers[msg.sender].balance = add(tellers[msg.sender].balance,msg.value);
      tellers[msg.sender].lat = lat;
      tellers[msg.sender].lng = lng;
      tellers[msg.sender].zone = zone;
      tellers[msg.sender].telAddr = _address;
  }

    /*
     * Simple sendcoin with proof of burn (no commission)
     */
  function sendCoin (address receiver, uint amount) returns (bool) {
    require(tellers[msg.sender].balance > amount);
    uint toSendReceiver = sub(amount,(amount * 5/1000));
    uint toSendFund = sub(amount,toSendReceiver);
    receiver.transfer(toSendReceiver);
    rewardFund.transfer(toSendFund);
    tellers[msg.sender].balance = sub(tellers[msg.sender].balance, amount);
    tellers[msg.sender].volumeTrade = add(tellers[msg.sender].volumeTrade,amount);
    ++tellers[msg.sender].nbTrade;
    Transfer(msg.sender, receiver, toSendReceiver);
    Transfer(msg.sender, rewardFund, toSendFund);
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
