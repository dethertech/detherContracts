pragma solidity ^0.4.19;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';

contract Dether is Ownable {
  using SafeMath for uint256;
  uint limit = 2 ether;

  struct TellerPosition {
    uint lat;
    uint lng;
    bytes32 countryId;
    int32 postalCode;
  }

  struct TellerReputation {
    uint volumeSell;
    uint volumeBuy;
    uint nbTrade;
    string[] comment;
    address[] rightsTo;
  }

  struct TellerProfile {
    int8 avatarId;
    int8 currencyId;
    bytes32 messagingAddr;
    bytes32 messagingAddr2;
    int16 rate;
  }

  struct Teller {
    TellerPosition tellerPosition;
    TellerProfile tellerProfile;
    TellerReputation tellerRep;
    bool online;
    uint balance;
    uint index;         // the corresponding row number in the index
  }

  mapping(address => Teller) teller;
  mapping(bytes32 => mapping(int32 => address[])) tellerInZone;

  event RegisterTeller(address indexed tellerAddress);
  event DeleteTeller(address indexed tellerAddress);
  event UpdateTeller(address indexed tellerAddress);
  event sendCoin(address indexed _from, address indexed _to, uint amount);

  // Teller Position
  function setTellerPosition(uint lat, uint lng, bytes32 countryid, int32 postalcode) public onlyOwner {
    teller[msg.sender].tellerPosition = TellerPosition(lat, lng, countryid, postalcode);
  }

  // up limit
  function updateLimit(uint newLimit)  public onlyOwner {
    limit = newLimit;
  }

  /*function getTellerPosition(address _teller) public view returns (TellerPosition) {
    return teller[_teller].tellerPosition;
  }*/

  // Teller Profile
  function setTellerProfile(
    int8 _avatarId,
    int8 _currencyId,
    bytes32 _messagingAddr,
    bytes32 _messagingAddr2,
    int16 _rates) public onlyOwner {
      teller[msg.sender].tellerProfile.avatarId = _avatarId;
      teller[msg.sender].tellerProfile.currencyId = _currencyId;
      teller[msg.sender].tellerProfile.messagingAddr = _messagingAddr;
      teller[msg.sender].tellerProfile.messagingAddr2 = _messagingAddr2;
      teller[msg.sender].tellerProfile.rate = _rates;
  }

  /*function getTellerProfile(address _teller) public view returns (TellerProfile) {
    return teller[_teller].tellerProfile;
  }

  function getTellerReputation(address _teller) public view returns (TellerReputation) {
      return teller[_teller].tellerRep;
  }*/

  // Teller Balance
  function addInEscrow() public onlyOwner payable {
    teller[msg.sender].balance += msg.value;
  }

  function getTellerBalance(address _address) public view returns (uint) {
    return teller[_address].balance;
  }

  /*// RegisterTeller
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
    ) public payable {
      // Conditions
      // check if not already teller
      // check if msg.value not too much
        setTellerProfile(_avatarId, _currencyId, _messagingAddress, _messagingAddress2, _rates);
        setTellerPosition(_lat, _lng, _countryCode, _postalcode);
        // add teller in mapping
        // tellerInZone[_countryCode][_postalcode][msg.sender] = teller[msg.sender];
        teller[msg.sender].index = tellerInZone[_countryCode][_postalcode].push(teller[msg.sender]) - 1;
        tellerInZone[_countryCode][_postalcode].push(teller[msg.sender]);
        teller[msg.sender].online = true;
        RegisterTeller(msg.sender);
  }*/

  // RegisterTeller
  /// @notice Register a teller
  /// @dev gasUsed: 262168
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
    ) public payable {
      // Conditions
      // check if not already teller
      require(teller[msg.sender].online == false);
      // check if msg.value not too much
      require(teller[msg.sender].balance.add(msg.value) <= limit);
        teller[msg.sender].tellerProfile.avatarId = _avatarId;
        teller[msg.sender].tellerProfile.currencyId = _currencyId;
        teller[msg.sender].tellerProfile.messagingAddr = _messagingAddress;
        teller[msg.sender].tellerProfile.messagingAddr2 = _messagingAddress2;
        teller[msg.sender].tellerProfile.rate = _rates;
        // setTellerPosition(_lat, _lng, _countryCode, _postalcode);
        teller[msg.sender].tellerPosition = TellerPosition(_lat, _lng, _countryCode, _postalcode);
        // add teller in mapping
        // tellerInZone[_countryCode][_postalcode][msg.sender] = teller[msg.sender];
        teller[msg.sender].index = tellerInZone[_countryCode][_postalcode].push(msg.sender) - 1;
        teller[msg.sender].online = true;
        teller[msg.sender].balance.add(msg.value);
        RegisterTeller(msg.sender);
  }

  /*// Delete teller
  function deleteTeller() public onlyOwner {
    // Conditions
    require(teller[msg.sender].online == true);
    // reorg tabs
    Teller storage tellerToPaste =  tellerInZone[teller[msg.sender].tellerPosition.countryId][teller[msg.sender].tellerPosition.postalCode][tellerInZone[teller[msg.sender].tellerPosition.countryId][teller[msg.sender].tellerPosition.postalCode].length - 1];
    tellerInZone[teller[msg.sender].tellerPosition.countryId][teller[msg.sender].tellerPosition.postalCode][teller[msg.sender].index] = tellerToPaste;
    tellerToPaste.index = teller[msg.sender].index;
    tellerInZone[teller[msg.sender].tellerPosition.countryId][teller[msg.sender].tellerPosition.postalCode].length --;

    // delete info teller
    teller[msg.sender].tellerPosition.lat = 0;
    teller[msg.sender].tellerPosition.lng = 0;
    teller[msg.sender].tellerPosition.countryId = '';
    teller[msg.sender].tellerPosition.postalCode = 0;
    teller[msg.sender].online = false;
    uint toSend = teller[msg.sender].balance;
    msg.sender.transfer(toSend);
    teller[msg.sender].balance = 0;
    DeleteTeller(msg.sender);
  }*/

  // Delete teller
  function deleteTeller() public onlyOwner {
    // Conditions
    require(teller[msg.sender].online == true);
    // reorg tabs
    address addressToPaste =  tellerInZone[teller[msg.sender].tellerPosition.countryId][teller[msg.sender].tellerPosition.postalCode][tellerInZone[teller[msg.sender].tellerPosition.countryId][teller[msg.sender].tellerPosition.postalCode].length - 1];
    tellerInZone[teller[msg.sender].tellerPosition.countryId][teller[msg.sender].tellerPosition.postalCode][teller[msg.sender].index] = addressToPaste;
    teller[addressToPaste].index = teller[msg.sender].index;
    tellerInZone[teller[msg.sender].tellerPosition.countryId][teller[msg.sender].tellerPosition.postalCode].length --;

    // delete info teller
    teller[msg.sender].tellerPosition.lat = 0;
    teller[msg.sender].tellerPosition.lng = 0;
    teller[msg.sender].tellerPosition.countryId = '';
    teller[msg.sender].tellerPosition.postalCode = 0;
    teller[msg.sender].online = false;
    uint toSend = teller[msg.sender].balance;
    msg.sender.transfer(toSend);
    teller[msg.sender].balance = 0;
    DeleteTeller(msg.sender);
  }

  function sendFromEscrow(address _to, uint _amount) public {
    require(_to != msg.sender);
    require(_amount >= teller[msg.sender].balance);
    teller[msg.sender].balance.sub(_amount);
    _to.transfer(_amount);
    teller[msg.sender].tellerRep.nbTrade += 1;
    teller[msg.sender].tellerRep.volumeSell += _amount;
  }

  // function getZone(bytes32 _country, int32 _postalcode) public view returns (Teller[]) {
  function getZone(bytes32 _country, int32 _postalcode) public view returns (address[]) {
      return tellerInZone[_country][_postalcode];
  }
}
