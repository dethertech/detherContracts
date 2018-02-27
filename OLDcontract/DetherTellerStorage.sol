pragma solidity ^0.4.18;
pragma experimental ABIEncoderV2;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';

contract DetherTellerStorage is Ownable {
  using SafeMath for uint;
  struct TellerPosition {
    uint lat;
    uint lng;
    string countryId;
    int32 postalCode;
  }

  struct TellerReputation {
    uint volumeSell;
    uint volumeBuy;
    uint nbTrade;
    bytes[] comment;
    mapping (address => bool) rightsTo;
  }

  struct TellerProfile {
    int8 avatarId;
    int8 currencyId;
    string messagingAddr;
    string messagingAddr2;
    int16 rate;
  }

  struct Teller {
    TellerPosition pos;
    TellerProfile profile;
    TellerReputation rep;
    bool online;
    uint balance;
    uint index;         // the corresponding index in th zone storage
    uint generalIndex;
  }

  mapping(address => Teller) teller;
  mapping(string => mapping(int32 => address[])) tellerInZone;
  address[] public tellerIndex; // unordered list of teller register on it

  /*
   * Position
   */
  function setTellerPosition(
    address _address,
    uint lat,
    uint lng,
    string countryId,
    int32 postalCode) public onlyOwner {
      if(isTeller(_address)) {
        _removeFromZone(_address);
      }
    // if already in zone
      teller[_address].pos = TellerPosition(lat, lng, countryId, postalCode);
      teller[_address].index = tellerInZone[countryId][postalCode].push(_address) - 1;
  }

  function getGeneralIndex(address _teller) public view returns (uint rank){
    return teller[_teller].generalIndex;
  }

  function getTellerPositionRaw(address _teller) public view returns (uint lat, uint lng, string countryId, int32 postalCode) {
    return (teller[_teller].pos.lat, teller[_teller].pos.lng, teller[_teller].pos.countryId, teller[_teller].pos.postalCode);
  }

  /*
   * Profile
   */
  function setTellerProfile(
    address _address,
    int8 _avatarId,
    int8 _currencyId,
    string _messagingAddr,
    string _messagingAddr2,
    int16 _rates) public onlyOwner {
      if (!isTeller(_address)){
        teller[_address].generalIndex = tellerIndex.push(_address) - 1;
      }
      /* Teller storage newteller = teller[_address; */
      teller[_address].profile = TellerProfile(_avatarId, _currencyId, _messagingAddr, _messagingAddr2, _rates);
      teller[_address].online = true;
  }


    function getTellerProfile1(address _teller) public view returns (
      int8 avatarId,
      int8 currencyId,
      string messagingAddr,
      string messagingAddr2
      ) {
        return (
          teller[_teller].profile.avatarId,
          teller[_teller].profile.currencyId,
          teller[_teller].profile.messagingAddr,
          teller[_teller].profile.messagingAddr2
          );
    }

    function getTellerProfile2(address _teller) public view returns (
      int16 rate,
      uint volumeSell,
      uint volumeBuy,
      uint nbTrade,
      uint balance
      ) {
        return (
          teller[_teller].profile.rate,
          teller[_teller].rep.volumeSell,
          teller[_teller].rep.volumeBuy,
          teller[_teller].rep.nbTrade,
          teller[_teller].balance
          );
    }

  /* function getTellerProfileRaw(address _teller) public view returns (
    int8 avatarId,
    int8 currencyId,
    string messagingAddr,
    string messagingAddr2,
    int16 rate
    ) {
    return (teller[_teller].profile.avatarId, teller[_teller].profile.currencyId, teller[_teller].profile.messagingAddr, teller[_teller].profile.messagingAddr2, teller[_teller].profile.rate);
  } */

  /*function getTellerProfile(address _teller) public view returns (TellerProfile) {
    return teller[_teller].profile;
  }*/

  /*
   * Reput
   */
  function _setReput(uint amount, address _sender, address _receiver) private onlyOwner {
    teller[_sender].rep.volumeSell += amount;
    teller[_receiver].rep.volumeBuy += amount;
    teller[_sender].rep.nbTrade++;
    teller[_sender].rep.rightsTo[_receiver] = true;
    teller[_receiver].rep.rightsTo[_sender] = true;
  }

  function addComment(bytes commentHash, address from, address to) public onlyOwner {
    require(teller[from].rep.rightsTo[to] == true);
    teller[to].rep.comment.push(commentHash);
    // add event
  }

  function getTellerReputationRaw(address _teller) public view returns (
    uint volumeSell,
    uint volumeBuy,
    uint nbTrade
    ) {
      return (teller[_teller].rep.volumeSell, teller[_teller].rep.volumeBuy, teller[_teller].rep.nbTrade);
  }

  function getTellerComment(address _teller) public view returns (bytes[]) {
    return teller[_teller].rep.comment;
  }

  function getCommentRight(address _teller) public view returns (bool) {
    return teller[_teller].rep.rightsTo[msg.sender];
  }

  /*
   * Zone
   */
  function getZone(string _country, int32 _postalcode) public view returns (address[]) {
      return tellerInZone[_country][_postalcode];
  }

  /*
   * Finance
   */

   function addBalance(address _address, uint _amount) public payable onlyOwner {
     teller[_address].balance += _amount;
   }

   function getTellerBalance(address _address) public view returns (uint) {
     return teller[_address].balance;
   }

   function releaseEth(address _from ,address _receiver, uint _amount) public onlyOwner returns (bool) {
     require(teller[_from].balance >= _amount);
     teller[_from].balance -= _amount;
     _setReput(_amount, _from, _receiver);
     _receiver.transfer(_amount);
   }

   /*
    * Delete teller
    */
   function turnOffline(address _address) public onlyOwner {
     teller[_address].online = false;
     uint toSend = teller[_address].balance;
     teller[_address].balance = 0;
     _address.transfer(toSend);
     _removeFromZone(_address);
     _clearMessaging(_address);
   }

   function _clearMessaging(address _address) private onlyOwner {
     teller[_address].profile.messagingAddr = '';
     teller[_address].profile.messagingAddr2 = '';
   }

   function _removeFromZone(address _address) private onlyOwner {
     uint rowToDelete = teller[_address].index;
     address keyToMove = tellerInZone[teller[_address].pos.countryId][teller[_address].pos.postalCode][tellerInZone[teller[_address].pos.countryId][teller[_address].pos.postalCode].length - 1];
     tellerInZone[teller[_address].pos.countryId][teller[_address].pos.postalCode][rowToDelete] = keyToMove;
     teller[keyToMove].index = rowToDelete;
     tellerInZone[teller[_address].pos.countryId][teller[_address].pos.postalCode].length--;
   }

   function deleteTeller(address _address) public onlyOwner {
     // Conditions
     if (teller[_address].online){
       turnOffline(_address);
     }
     uint rowToDelete = teller[_address].generalIndex;
     address keyToMove = tellerIndex[tellerIndex.length - 1];
     tellerIndex[rowToDelete] = keyToMove;
     teller[keyToMove].generalIndex = rowToDelete;
     tellerIndex.length--;
   }

  // Misc
  function isTeller(address _teller) public view returns (bool isIndeed){
    if(tellerIndex.length == 0) return false;
    return (tellerIndex[teller[_teller].generalIndex] == _teller);
  }

  function getTellerStatus(address _teller) public view returns (uint balance, bool status) {
    return (teller[_teller].balance, teller[_teller].online);
  }

  function isOnline(address _teller) public view returns (bool) {
    return teller[_teller].online;
  }

  function getTellerCount() public view returns (uint) {
    return tellerIndex.length;
  }

  function getTellerAtIndex(uint _index) public view returns (address ) {
    return tellerIndex[_index];
  }

  function getAllTellers() public view returns (address[]) {
    return tellerIndex;
  }

  // emergency withdraw
  // emergency lock
}
