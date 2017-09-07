pragma solidity 0.4.16;

contract DetherStorage {

  struct TellerPosition {
    int256 lat;
    int256 lng;
    uint zoneId;
  }

  struct TellerProfile {
    int8 avatarId;
    int8 currencyId;
    string messagingAddr;
    string name;
    uint nbTrade;
    int16 rate;
    uint volumeTrade;
  }

  struct Teller {
    TellerPosition tellerPosition;
    TellerProfile tellerProfile;
    uint balance;
  }

  mapping(address => Teller) tellers;
  mapping (uint => address[]) public tellerPerZone;

  // Teller Position
  function setTellerPosition(int256 lat, int256 lng, uint zoneId) {
    tellers[msg.sender].tellerPosition = TellerPosition(lat, lng, zoneId);
  }

  function getTellerPosition(address _teller) view returns (
    int256 lat,
    int256 lng,
    uint zoneId) {
    return (
      tellers[_teller].tellerPosition.lat,
      tellers[_teller].tellerPosition.lng,
      tellers[_teller].tellerPosition.zoneId
    );
  }

  // Teller Profile
  function setTellerProfile(
    int8 _avatarId,
    int8 _currencyId,
    string _messagingAddr,
    string _name,
    int16 _rate) {
      tellers[msg.sender].tellerProfile.avatarId = _avatarId;
      tellers[msg.sender].tellerProfile.currencyId = _currencyId;
      tellers[msg.sender].tellerProfile.messagingAddr = _messagingAddr;
      tellers[msg.sender].tellerProfile.name = _name;
      tellers[msg.sender].tellerProfile.rate = _rate;
  }

  function getTellerProfile(address _teller) view returns (
    int8 avatarId,
    int8 currencyId,
    string messagingAddr,
    string name,
    uint nbTrade,
    int16 rate,
    uint volumeTrade) {
      return (
        tellers[_teller].tellerProfile.avatarId,
        tellers[_teller].tellerProfile.currencyId,
        tellers[_teller].tellerProfile.messagingAddr,
        tellers[_teller].tellerProfile.name,
        tellers[_teller].tellerProfile.nbTrade,
        tellers[_teller].tellerProfile.rate,
        tellers[_teller].tellerProfile.volumeTrade
      );
  }

  // Teller Zone
  function setTellerZone(uint _zoneId) {
    if (tellers[msg.sender].tellerPosition.zoneId != _zoneId) {
      tellerPerZone[_zoneId].push(msg.sender);
    }
  }

  function getZone(uint _zone) view returns (address[]) {
    return tellerPerZone[_zone];
  }

  // Teller Balance
  function getTellerBalances(address _address) view returns (uint) {
    return tellers[_address].balance;
  }
}