pragma solidity 0.4.16;

import './DetherStorage.sol';
import './base/SafeMath.sol';

contract DetherInterface is SafeMath {
  DetherStorage detherStorage;
  event Transfer (address indexed _from, address indexed _to, uint256 _value);

  function DetherInterface(address _detherStorageAddress) {
    detherStorage = DetherStorage(_detherStorageAddress);
  }

  function registerPoint(
    int256 _lat,
    int256 _lng,
    uint _zoneId,
    int16 _rate,
    int8 _avatarId,
    int8 _currencyId,
    bytes32 _messagingAddress,
    bytes32 _name
    ) payable {
      // Conditions
      require(msg.value > 10 finney);
      require(msg.value < 5 ether);
      //
      detherStorage.setTellerPosition(msg.sender, _lat, _lng, _zoneId);
      detherStorage.setTellerZone(msg.sender, _zoneId);
      detherStorage.setTellerProfile(msg.sender, _avatarId, _currencyId, _messagingAddress, _name, _rate);
      detherStorage.setTellerBalance(msg.sender, msg.value);
  }

  function getTellerPos(address _teller) view returns (
    int256 lat,
    int256 lng,
    uint zoneId,
    uint balance) {
      balance = detherStorage.getTellerBalance(_teller);
      require(balance > 10 finney);
      (lat, lng, zoneId) = detherStorage.getTellerPosition(_teller);
      return (lat, lng, zoneId, balance);
  }

  function getTellerProfile(address _teller) view returns (
    int16 rates,
    uint volumeTrade,
    uint nbTrade,
    bytes32 name,
    int8 currency,
    int8 avatar,
    bytes32 telAddr) {
      uint balance = detherStorage.getTellerBalance(_teller);
      require(balance > 10 finney);
      return detherStorage.getTellerProfile(_teller);
  }

  /// @notice Sendcoin allow seller to send ether they put in escrow in the smart contract
  function sendCoin (address _receiver, uint _amount) returns (bool) {
    uint tellerBalance = detherStorage.getTellerBalance(msg.sender);
    require(tellerBalance >= _amount);
    detherStorage.setTellerBalance(msg.sender, sub(tellerBalance, _amount));

    var (nbTrade, volumeTrade) = detherStorage.getTellerReputation(msg.sender);
    detherStorage.setTellerReputation(msg.sender, ++nbTrade, add(volumeTrade, _amount));

    _receiver.transfer(_amount);
    Transfer(msg.sender, _receiver, _amount);
    return true;
  }


  /// @notice Seller can withdraw the fund he puts in escrow in the smart contract
  function withdrawAll() returns (bool) {
    uint toSend = detherStorage.getTellerBalance(msg.sender);
    detherStorage.setTellerBalance(msg.sender, 0);
    msg.sender.transfer(toSend);
    detherStorage.clearMessagingAddress(msg.sender);
    return true;
  }

  /// @notice Return an address array with all the teller located in this zone
  function getZone(uint _zone) view returns (address[5]) {
      // todo can't return array
      return detherStorage.getZone(_zone);
  }


  /// @notice Getter to retrieve balance
  function getTellerBalances(address _address) view returns (uint) {
    return detherStorage.getTellerBalance(_address);
  }
}