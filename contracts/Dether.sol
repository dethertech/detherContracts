pragma solidity 0.4.16;
// pragma experimental ABIEncoderV2;
import './base/Ownable.sol';
import './base/SafeMath.sol';

// TO DO
// Storage contract
// avoid auto selling
// Whitelist modifier or seller
// construct object for return array of teller (need 0.4.17)


contract Dether is Ownable, SafeMath {

  // state variables

  struct Teller {
    int16 rate;                // commission rate teller is going to take 3 digit with 1 decimal
    uint balance;             // balance credited in escrow
    uint volumeTrade;         // volume realised
    uint nbTrade;             // number of trade realised
    int256 lat;
    int256 lng;
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
    int256 _lat,
    int256 _lng,
    uint _zone,
    int16 _rate,
    int8 _avatar,
    int8 _currency,
    string _address,
    string _name
    ) payable {
      require(msg.value > 10 finney);
      require(msg.value + tellers[msg.sender].balance < 5 ether);
      tellers[msg.sender].rate = _rate;
      tellers[msg.sender].currencyId = _currency;
      tellers[msg.sender].avatarId = _avatar;
      tellers[msg.sender].balance = add(tellers[msg.sender].balance,msg.value);
      tellers[msg.sender].lat = _lat;
      tellers[msg.sender].lng = _lng;
      tellers[msg.sender].name = _name;
      tellers[msg.sender].messengerAddr = _address;
      if (tellers[msg.sender].zoneId != _zone)
        tellerPerZone[_zone].push(msg.sender);
      tellers[msg.sender].zoneId = _zone;
  }

  /*
   * These 2 getter fonction allow to retrieve teller info, its cut in 2 part
   * because of the limitations of return argument in solidity
   */

  function getTellerPos(address _teller) view returns (
    int256 lat,
    int256 lng,
    uint zone,
    uint balance) {
    require(tellers[_teller].balance > 10 finney);
    return (
      tellers[_teller].lat,
      tellers[_teller].lng,
      tellers[_teller].zoneId,
      tellers[_teller].balance
    );
  }

  function getTellerProfile(address _teller) view returns (
    int16 rates,
    uint volumeTrade,
    uint nbTrade,
    string name,
    int8 currency,
    int8 avatar,
    string telAddr) {
      require(tellers[_teller].balance > 10 finney);
      return (tellers[_teller].rate
      , tellers[_teller].volumeTrade
      , tellers[_teller].nbTrade
      , tellers[_teller].name
      , tellers[_teller].currencyId
      , tellers[_teller].avatarId
      , tellers[_teller].messengerAddr);
  }

  /*
   * Sendcoin allow seller to send ether they put in escrow in the smart contract
   */
  function sendCoin (address _receiver, uint _amount) returns (bool) {
    require(tellers[msg.sender].balance >= _amount);
    _receiver.transfer(_amount);
    tellers[msg.sender].balance = sub(tellers[msg.sender].balance, _amount);
    tellers[msg.sender].volumeTrade = add(tellers[msg.sender].volumeTrade, _amount);
    ++tellers[msg.sender].nbTrade;
    Transfer(msg.sender, _receiver, _amount);
    return true;
  }

  /*
   * the seller can withdraw the fund he puts in escrow in the smart contract
   */
  function withdrawAll() {
    uint toSend = tellers[msg.sender].balance;
    tellers[msg.sender].balance = 0;
    msg.sender.transfer(toSend);
    tellers[msg.sender].messengerAddr = "";
  }

  /*
   * return an address array with all the teller located in this zone
   */
  function getZone(uint _zone) view returns (address[]) {
      return tellerPerZone[_zone];
  }

  /*
   * simple getter to retrieve balance
   */
  function getTellerBalances(address _address) view returns (uint) {
    return tellers[_address].balance;
  }
}
