pragma solidity 0.4.16;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import './DetherStorage.sol';

contract DetherInterface is Ownable {
  using SafeMath for uint256;
  DetherStorage detherStorage;
  event Transfer (address indexed _from, address indexed _to, uint256 _value);
  event RegisterPoint(int256 lat, int256 lng, int16 rate, address addr);
  event SendCoin(address indexed _from, address indexed _to, uint256 _value, int256 lat, int256 lng);
  event Withdraw(int256 lat, int256 lng, address addr);

  function DetherInterface(address _detherStorageAddress) {
    detherStorage = DetherStorage(_detherStorageAddress);
  }

  /// @notice Register a teller
  /// @dev gasUsed: 292273
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
      require(!detherStorage.isTeller(msg.sender));
      require(msg.value >= 10 finney);
      require(msg.value < 5 ether);
      //
      detherStorage.setTellerIndex(msg.sender);
      detherStorage.setTellerZone(msg.sender, _zoneId);
      detherStorage.setTellerPosition(msg.sender, _lat, _lng, _zoneId);
      detherStorage.setTellerProfile(msg.sender, _avatarId, _currencyId, _messagingAddress, _name, _rate);
      detherStorage.setTellerBalance(msg.sender, msg.value);
      RegisterPoint(_lat, _lng, _rate, msg.sender);
  }

  function importTellers(
    int256 _lat,
    int256 _lng,
    uint _zoneId,
    int16 _rate,
    int8 _avatarId,
    int8 _currencyId,
    bytes32 _messagingAddress,
    bytes32 _name,
    uint _balance
    ) onlyOwner {
    detherStorage.setTellerIndex(msg.sender);
    detherStorage.setTellerZone(msg.sender, _zoneId);
    detherStorage.setTellerPosition(msg.sender, _lat, _lng, _zoneId);
    detherStorage.setTellerProfile(msg.sender, _avatarId, _currencyId, _messagingAddress, _name, _rate);
    detherStorage.setTellerBalance(msg.sender, _balance);
  }

  function changeStorageOwnership(address newOwner) onlyOwner {
    detherStorage.transferOwnership(newOwner);
  }

  function getTellerPos(address _teller) view returns (
    int256 lat,
    int256 lng,
    uint zoneId,
    uint balance) {
      balance = detherStorage.getTellerBalance(_teller);
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
      // Conditions
      uint balance = detherStorage.getTellerBalance(_teller);
      //
      return detherStorage.getTellerProfile(_teller);
  }

  /// @notice Sendcoin allow seller to send ether they put in escrow in the smart contract
  /// @dev gasUsed: 96681
  function sendCoin (address _receiver, uint _amount) returns (bool) {
    require(_receiver != msg.sender);
    uint tellerBalance = detherStorage.getTellerBalance(msg.sender);
    require(tellerBalance >= _amount);
    detherStorage.setTellerBalance(msg.sender, tellerBalance.sub(_amount));

    var (nbTrade, volumeTrade) = detherStorage.getTellerReputation(msg.sender);
    detherStorage.setTellerReputation(msg.sender, ++nbTrade, volumeTrade.add(_amount));

    _receiver.transfer(_amount);
    Transfer(msg.sender, _receiver, _amount);
    var (lat, lng,) = detherStorage.getTellerPosition(msg.sender);
    SendCoin(msg.sender, _receiver, _amount, lat, lng);
    return true;
  }

  /// @notice Seller can withdraw the fund he puts in escrow in the smart contract
  /// @dev gasUsed: 26497
  function withdrawAll() returns (bool) {
    uint toSend = detherStorage.getTellerBalance(msg.sender);
    detherStorage.setTellerBalance(msg.sender, 0);
    msg.sender.transfer(toSend);
    detherStorage.clearMessagingAddress(msg.sender);
    var (lat, lng,) = detherStorage.getTellerPosition(msg.sender);
    Withdraw(lat, lng, msg.sender);
    return true;
  }

  /// @notice Getter to retrieve balance
  function getTellerBalances(address _address) view returns (uint) {
    return detherStorage.getTellerBalance(_address);
  }
}
