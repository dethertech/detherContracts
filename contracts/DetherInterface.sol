pragma solidity ^0.4.18;
pragma experimental ABIEncoderV2;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import './DetherTellerStorage.sol';

// TODO
// NEED DTH TO DEPOSIT AND TRADE
// MINT LOYALTY WHEN TRADE

contract DetherInterface is Ownable {
  using SafeMath for uint256;
  bool public initialised;
  DetherTellerStorage public tellerStorage;
  uint public limit = 2 ether;

  event RegisterTeller(address indexed tellerAddress);
  event DeleteTeller(address indexed tellerAddress);
  event UpdateTeller(address indexed tellerAddress);
  event Send(address indexed _from, address indexed _to, uint amount);

// modifier
  modifier isLockedForInitialMigration() {
    require(!initialised);
    _;
  }

  modifier isNotLockedForInitialMigration() {
    require(initialised);
    _;
  }

  function setInit() public  {
    initialised = true;
  }

  function DetherInterface(address _tellerStorageAddress) public {
    tellerStorage = DetherTellerStorage(_tellerStorageAddress);
    initialised = true;
    // initialised = false;
  }
  function updateLimit(uint newLimit)  public onlyOwner {
    limit = newLimit;
  }

  /// @notice Register a teller
  /// @dev gasUsed: 299600
  function registerTeller(
    uint _lat,
    uint _lng,
    bytes32 _countryCode,
    int32 _postalcode,
    int8 _avatarId,
    int8 _currencyId,
    bytes32 _messagingAddress,
    bytes32 _messagingAddress2,
    int16 _rates
    ) public payable  {
      // Conditions
      require(tellerStorage.isOnline(msg.sender) != true);
      uint bal = tellerStorage.getTellerBalance(msg.sender);
      require(bal.add(msg.value) <= limit);
      tellerStorage.setTellerPosition(msg.sender, _lat, _lng, _countryCode, _postalcode);
      tellerStorage.setTellerProfile(msg.sender, _avatarId, _currencyId, _messagingAddress,_messagingAddress2, _rates);
      tellerStorage.addBalance(msg.sender, msg.value); // send money

      RegisterTeller(msg.sender);
  }

  function switchTellerOffline() public {
    // delete point on map and messagery
    assert(isTellerOnline(msg.sender));
    tellerStorage.turnOffline(msg.sender);
    // withdraw fund
    // unstack token
    DeleteTeller(msg.sender);
  }

  function updateProfile(
    int8 _avatarId,
    int8 _currencyId,
    bytes32 _messagingAddr,
    bytes32 _messagingAddr2,
    int16 _rates
    ) public {
      require(tellerStorage.isOnline(msg.sender) == true);
      tellerStorage.setTellerProfile(msg.sender, _avatarId, _currencyId, _messagingAddr,_messagingAddr2, _rates);
      UpdateTeller(msg.sender);
    }

    function updateProfilePayable(
      int8 _avatarId,
      int8 _currencyId,
      bytes32 _messagingAddr,
      bytes32 _messagingAddr2,
      int16 _rates
      ) public payable{
        require(tellerStorage.isOnline(msg.sender) == true);
        tellerStorage.setTellerProfile(msg.sender, _avatarId, _currencyId, _messagingAddr,_messagingAddr2, _rates);
        tellerStorage.addBalance(msg.sender, msg.value); // send money
        UpdateTeller(msg.sender);
      }

    function updatePosition(
      uint _lat,
      uint _lng,
      bytes32 _countryCode,
      int32 _postalcode
      ) public {
        require(tellerStorage.isOnline(msg.sender) == true);
        tellerStorage.setTellerPosition(msg.sender, _lat, _lng, _countryCode, _postalcode);
        UpdateTeller(msg.sender);
      }

    function updatePositionPayable(
      uint _lat,
      uint _lng,
      bytes32 _countryCode,
      int32 _postalcode
      ) public payable{
        require(tellerStorage.isOnline(msg.sender) == true);
        tellerStorage.setTellerPosition(msg.sender, _lat, _lng, _countryCode, _postalcode);
        tellerStorage.addBalance(msg.sender, msg.value); // send money
        UpdateTeller(msg.sender);
      }

    function addBalance() public payable {
      require(tellerStorage.isOnline(msg.sender) == true);
      tellerStorage.addBalance(msg.sender, msg.value); // send money
      UpdateTeller(msg.sender);
    }

  function isRegistered(address _teller) public view returns (bool status){
    status = tellerStorage.isTeller(_teller);
    return status;
  }

  function deleteMyProfile() {
    // delete all info
    // keep loyalty
    tellerStorage.deleteTeller(msg.sender);
    DeleteTeller(msg.sender);
    // withdraw
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

  function changeStorageOwnership(address newOwner) public onlyOwner {
    tellerStorage.transferOwnership(newOwner);
  }

  function getTellerPos(address _teller) public view returns (uint _lat, uint _lng, bytes32 _countryId, int32 postalCode) {
    return tellerStorage.getTellerPositionRaw(_teller);
}

  /*function getTeller(address _teller) public view returns (Teller) {
    return tellerStorage.getTeller(_teller);
  }*/

  function getTellerProfile(address _teller) public view returns (
    int8 avatarId,
    int8 currencyId,
    bytes32 messagingAddr,
    bytes32 messagingAddr2,
    int16 rate,
    uint volumeSell,
    uint volumeBuy,
    uint nbTrade,
    uint balance
    ) {
      (avatarId, currencyId, messagingAddr, messagingAddr2, rate) = tellerStorage.getTellerProfileRaw(_teller);
      (volumeSell,volumeBuy,nbTrade) = tellerStorage.getTellerReputationRaw(_teller);
      balance = tellerStorage.getTellerBalance(_teller);
      return (avatarId, currencyId, messagingAddr, messagingAddr2, rate, volumeSell,volumeBuy,nbTrade, balance);
  }

  function getTellerStatus(address _teller) public view returns (uint balance, bool status) {
    return tellerStorage.getTellerStatus(_teller);
  }

  function isTellerOnline(address _teller) public view returns (bool) {
    return tellerStorage.isOnline(_teller);
  }
  /// @notice Sendcoin allow seller to send ether they put in escrow in the smart contract
  /// @dev gasUsed: 96681
  /*function sendCoin (address _receiver, uint _amount) public isNotLockedForInitialMigration returns (bool) {
    require(_receiver != msg.sender);
    uint tellerBalance = tellerStorage.getTellerBalance(msg.sender);
    require(tellerBalance >= _amount);
    tellerStorage.setTellerBalance(msg.sender, tellerBalance.sub(_amount));

    var (nbTrade, volumeTrade) = tellerStorage.getTellerReputation(msg.sender);
    tellerStorage.setTellerReputation(msg.sender, ++nbTrade, volumeTrade.add(_amount));

    tellerStorage.releaseEth(_receiver, _amount);
    var (lat, lng,) = tellerStorage.getTellerPosition(msg.sender);
    Send(msg.sender, _receiver, _amount, lat, lng);
    return true;
  }*/



  /// @notice Getter to retrieve balance
  function getTellerBalance(address _address) public view returns (uint) {
    return tellerStorage.getTellerBalance(_address);
  }
}
