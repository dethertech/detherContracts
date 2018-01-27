pragma solidity ^0.4.18;
pragma experimental ABIEncoderV2;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import './DetherTellerStorage.sol';
import './certifier/SmsCertifier.sol';


// TODO
// NEED DTH TO DEPOSIT AND TRADE
// MINT LOYALTY WHEN TRADE

contract DetherInterface is Ownable {
  using SafeMath for uint256;
  bool public initialised;
  DetherTellerStorage public tellerStorage;
  SmsCertifier public smsCertifier;
  uint public limit = 2 ether;

  event RegisterTeller(address indexed tellerAddress);
  event DeleteTeller(address indexed tellerAddress);
  event UpdateTeller(address indexed tellerAddress);
  event Sent(address indexed _from, address indexed _to, uint amount);

// modifier
  modifier isLockedForInitialMigration() {
    require(!initialised);
    _;
  }

  modifier isNotLockedForInitialMigration() {
    require(initialised);
    _;
  }

  modifier isSmsWhitelisted(address _teller) {
    require(smsCertifier.isCertified(_teller));
    _;
  }

  /* function setInit() public  {
    initialised = true;
  } */

  function DetherInterface(address _tellerStorageAddress, address _smsCertifier) public {
    tellerStorage = DetherTellerStorage(_tellerStorageAddress);
    smsCertifier = SmsCertifier(_smsCertifier);
    initialised = true;
    // initialised = false;
  }

  /* function updateLimit(uint newLimit)  public onlyOwner {
    limit = newLimit;
  } */

  /// @notice Register a teller
  /// @dev gasUsed: 299600
  function registerTeller(
    uint _lat,
    uint _lng,
    string _countryCode,
    int32 _postalcode,
    int8 _avatarId,
    int8 _currencyId,
    string _messagingAddress,
    string _messagingAddress2,
    int16 _rates
    ) public payable isSmsWhitelisted(msg.sender) {
      // Conditions
      require(tellerStorage.isOnline(msg.sender) != true);
      uint bal = tellerStorage.getTellerBalance(msg.sender);
      require(bal.add(msg.value) <= limit);
      tellerStorage.setTellerPosition(msg.sender, _lat, _lng, _countryCode, _postalcode);
      tellerStorage.setTellerProfile(msg.sender, _avatarId, _currencyId, _messagingAddress,_messagingAddress2, _rates);
      tellerStorage.addBalance.value(msg.value)(msg.sender, msg.value); // send money
      //detherStorage.setTellerBalance.value(msg.value)(msg.sender, msg.value)
      RegisterTeller(msg.sender);
  }

  function sendCoin (address _receiver, uint _amount) public isNotLockedForInitialMigration returns (bool) {
    require(_receiver != msg.sender);
    tellerStorage.releaseEth(msg.sender ,_receiver, _amount);
    Sent(msg.sender, _receiver, _amount);
    return true;
  }

  function updateProfile(
    int8 _avatarId,
    int8 _currencyId,
    string _messagingAddr,
    string _messagingAddr2,
    int16 _rates
    ) public payable {
      require(tellerStorage.isTeller(msg.sender) == true);
      tellerStorage.setTellerProfile(msg.sender, _avatarId, _currencyId, _messagingAddr,_messagingAddr2, _rates);
      tellerStorage.addBalance.value(msg.value)(msg.sender, msg.value); // send money
      UpdateTeller(msg.sender);
  }

  // 103495 gas
  function updatePosition(
    uint _lat,
    uint _lng,
    string _countryCode,
    int32 _postalcode
    ) public payable  {
      require(tellerStorage.isTeller(msg.sender) == true);
      tellerStorage.setTellerPosition(msg.sender, _lat, _lng, _countryCode, _postalcode);
      tellerStorage.addBalance.value(msg.value)(msg.sender, msg.value); // send money
      UpdateTeller(msg.sender);
  }

  function addBalance() public payable {
    require(tellerStorage.isOnline(msg.sender) == true);
    tellerStorage.addBalance.value(msg.value)(msg.sender, msg.value); // send money
    UpdateTeller(msg.sender);
  }

  function deleteMyProfile() {
    tellerStorage.deleteTeller(msg.sender);
    // unstack token
    DeleteTeller(msg.sender);
  }

  function switchTellerOffline() public {
    // delete point on map and messagery
    assert(tellerStorage.isOnline(msg.sender));
    tellerStorage.turnOffline(msg.sender);
    DeleteTeller(msg.sender);
  }

  function changeStorageOwnership(address newOwner) public onlyOwner {
    tellerStorage.transferOwnership(newOwner);
  }

    /*function importTellers(
      int256 _lat,
      int256 _lng,
      uint _zoneId,
      int16 _rate,
      int8 _avatarId,
      int8 _currencyId,
      bytes32 _messagingAddress,
      bytes32 _name,
      uint _balance
      ) public onlyOwner isLockedForInitialMigration {
      tellerStorage.setTellerIndex(msg.sender);
      tellerStorage.setTellerZone(msg.sender, _zoneId);
      tellerStorage.setTellerPosition(msg.sender, _lat, _lng, _zoneId);
      tellerStorage.setTellerProfile(msg.sender, _avatarId, _currencyId, _messagingAddress, _name, _rate);
      tellerStorage.setTellerBalance(msg.sender, _balance);
    }*/

}
