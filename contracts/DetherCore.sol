pragma solidity ^0.4.18;

import './DetherSetup.sol';
import './DetherBank.sol';
import './dth/tokenfoundry/ERC223ReceivingContract.sol';
import './dth/tokenfoundry/ERC223Basic.sol';
import './DetherAccessControl.sol';
import 'bytes/BytesLib.sol';

contract DetherCore is DetherSetup, ERC223ReceivingContract {
    using BytesLib for bytes;

  /**
   * Event
   */
    event RegisterTeller(address indexed tellerAddress);
    event DeleteTeller(address indexed tellerAddress);
    event UpdateTeller(address indexed tellerAddress);
    event Sent(address indexed _from, address indexed _to, uint amount);
    event RegisterShop(address shopAddress);
    event DeleteShop(address shopAddress);
    event DeleteShopModerator(address indexed moderator, address shopAddress);
    event DeleteTellerModerator(address indexed moderator, address tellerAddress);

    // temp
    event TempLog(string _logs, bytes _data);
  /**
   * Modifier
   */
    modifier tellerHasStaked(uint amount) {
      require(bank.getDthTeller(msg.sender) >= amount);
      _;
    }
    modifier shopHasStaked(uint amount) {
      require(bank.getDthShop(msg.sender) >= amount);
      _;
    }

    /*
     * External contract
     */
  ERC223Basic public dth;
  DetherBank public bank;

// teller
  struct Teller {
    bytes16 lat;
    bytes16 lng;
    bytes2 countryId;
    bytes16 postalCode;

    bytes2 currencyId;
    bytes16 messenger;
    bytes2 avatarId;
    bytes16 rates;

    uint zoneIndex;
    uint generalIndex;
    bool online;

    bytes[] comment;
    mapping (address => bool) rightsTo;
  }

  mapping(address => uint) volumeBuy;
  mapping(address => uint) volumeSell;
  mapping(address => uint) loyaltyPoint;
  mapping(address => bytes32) comment;

  mapping(address => Teller) teller;
  mapping(bytes2 => mapping(bytes16 => address[])) tellerInZone;
  address[] public tellerIndex; // unordered list of teller register on it

// shop
  struct Shop {
    bytes16 lat;
    bytes16 lng;
    bytes2 countryId;
    bytes16 postalCode;
    bytes16 cat;
    bytes16 name;
    bytes32 description;
    bytes16 opening;
    uint zoneIndex;
    uint generalIndex;
  }

  mapping(address => Shop) shop;
  mapping(bytes2 => mapping(bytes16 => address[])) shopInZone;
  address[] public shopIndex; // unordered list of shop register on it

  /*
   * Initialiser
   */


   function DetherCore() {
     ceoAddress = msg.sender;
   }
   /*
     function DetherCore() public {
       ceoAddress = msg.sender;
     } */

   function initContract (address _dth, address _bank) onlyCEO {
     dth = ERC223Basic(_dth);
     bank = DetherBank(_bank);
   }

   /*
    * Core function
    */
  /// @dev Standard ERC223 function that will handle incoming token transfers.
  /// @param _from  Token sender address.
  /// @param _value Amount of tokens.
  /// @param _data  Transaction metadata.
  function tokenFallback(address _from, uint _value, bytes _data) {
    // check if its coming from DTH contract
    require(msg.sender == address(dth));

    bytes1 _func = _data.toBytes1(0);
    // 1 / 0x31 = shop // 2 / 0x32 = teller
    if (_func == bytes1(0x31)) { // shop registration
      // require staked greater than licence price
      require(_value >= licenceShop[_data.toBytes2(33)]);
      // require is not already shop
      require(!isShop(_from));
      // require zone is open
      require(openedCountryShop[_data.toBytes2(33)]);
      // require than the token fallback is triggered from the dth token contract
      shop[_from].lat = _data.toBytes16(1);
      shop[_from].lng = _data.toBytes16(17);
      shop[_from].name = _data.toBytes16(67);
      shop[_from].cat = _data.toBytes16(51);
      shop[_from].description = _data.toBytes32(83);
      shop[_from].opening = _data.toBytes16(115);
      shop[_from].countryId = _data.toBytes2(33);
      shop[_from].postalCode = _data.toBytes16(35);
      shop[_from].generalIndex = shopIndex.push(_from) - 1;
      shop[_from].zoneIndex = shopInZone[_data.toBytes2(33)][_data.toBytes16(35)].push(_from) - 1;
      RegisterShop(_from);
      bank.addTokenShop(_from,_value);
      dth.transfer(address(bank), _value);
    } else if (_func == bytes1(0x32)) { // teller registration
      // teller registration

      // require staked greater than licence price
      require(_value >= licenceTeller[_data.toBytes2(33)]);
      // require is not already a teller
      require(!isTeller(_from));
      // require zone is open
      require(openedCountryTeller[_data.toBytes2(33)]);

      teller[_from].lat = _data.toBytes16(1);
      teller[_from].lng = _data.toBytes16(17);
      teller[_from].countryId = _data.toBytes2(33);
      teller[_from].postalCode = _data.toBytes16(35);
      teller[_from].avatarId = _data.toBytes2(51);
      teller[_from].currencyId = _data.toBytes2(53);
      teller[_from].messenger = _data.toBytes16(55);
      teller[_from].rates = _data.toBytes16(71);
      teller[_from].generalIndex = tellerIndex.push(_from) - 1;
      teller[_from].zoneIndex = tellerInZone[_data.toBytes2(33)][_data.toBytes16(35)].push(_from) - 1;
      RegisterTeller(_from);
      bank.addTokenTeller(_from, _value);
      dth.transfer(address(bank), _value);
    }

  }

  /*
   * Shop ----------------------------------
   */

   function getShop(address _shop) public view returns (
     bytes16 lat,
     bytes16 lng,
     bytes2 countryId,
     bytes16 postalCode,
     bytes16 cat,
     bytes16 name,
     bytes32 description,
     bytes16 opening
     ) {
       Shop storage theShop = shop[_shop];
       lat = theShop.lat;
       lng = theShop.lng;
       countryId = theShop.countryId;
       postalCode = theShop.postalCode;
       cat = theShop.cat;
       name = theShop.name;
       description = theShop.description;
       opening = theShop.opening;
     }

     // gas used 67841
     function deleteShop() public {
       uint rowToDelete1 = shop[msg.sender].zoneIndex;
       address keyToMove1 = shopInZone[shop[msg.sender].countryId][shop[msg.sender].postalCode][shopInZone[shop[msg.sender].countryId][shop[msg.sender].postalCode].length - 1];
       shopInZone[shop[msg.sender].countryId][shop[msg.sender].postalCode][rowToDelete1] = keyToMove1;
       shop[keyToMove1].zoneIndex = rowToDelete1;
       shopInZone[shop[msg.sender].countryId][shop[msg.sender].postalCode].length--;

       uint rowToDelete2 = shop[msg.sender].generalIndex;
       address keyToMove2 = shopIndex[shopIndex.length - 1];
       shopIndex[rowToDelete2] = keyToMove2;
       shop[keyToMove2].generalIndex = rowToDelete2;
       shopIndex.length--;
       delete shop[msg.sender];
       bank.withdrawDthShop(msg.sender);
       DeleteShop(msg.sender);
     }

     // gas used 67841
     function deleteShopMods(address _toDelete) isShopModerator(msg.sender) public {
       uint rowToDelete1 = shop[_toDelete].zoneIndex;
       address keyToMove1 = shopInZone[shop[_toDelete].countryId][shop[_toDelete].postalCode][shopInZone[shop[_toDelete].countryId][shop[_toDelete].postalCode].length - 1];
       shopInZone[shop[_toDelete].countryId][shop[_toDelete].postalCode][rowToDelete1] = keyToMove1;
       shop[keyToMove1].zoneIndex = rowToDelete1;
       shopInZone[shop[_toDelete].countryId][shop[_toDelete].postalCode].length--;

       uint rowToDelete2 = shop[_toDelete].generalIndex;
       address keyToMove2 = shopIndex[shopIndex.length - 1];
       shopIndex[rowToDelete2] = keyToMove2;
       shop[keyToMove2].generalIndex = rowToDelete2;
       shopIndex.length--;
       delete shop[_toDelete];
       bank.withdrawDthShop(_toDelete);
       DeleteShopModerator(msg.sender, _toDelete);
     }

     function getZoneShop(bytes2 _country, bytes16 _postalcode) public view returns (address[]) {
         return shopInZone[_country][_postalcode];
     }

     function getAllShops() public view returns (address[]) {
       return shopIndex;
     }

     function isShop(address _shop) public view returns (bool ){
       return (shop[_shop].countryId != bytes2(0x0));
     }

     function getZoneTeller(bytes2 _country, bytes16 _postalcode) public view returns (address[]) {
         return tellerInZone[_country][_postalcode];
     }

     function getAllTellers() public view returns (address[]) {
       return tellerIndex;
     }


   /*
    * Teller ---------------------------------
    */

  function sellEth(address _to, uint _amount) {
    require(_to != msg.sender);
    bank.withdrawEth(msg.sender, _to, _amount);

    // increase reput

  }


  function addFunds() payable {
    require(isTeller(msg.sender));
    bank.addEthTeller.value(msg.value)(msg.sender, msg.value);

  }

  function getTellerBalance(address _teller) public view returns (uint) {
    return bank.getEthBalTeller(_teller);
  }
/*
function addComment() {

}
*/

  function transferBankOwnership(address _newbankowner) {
    bank.transferOwnership(_newbankowner);
  }
    // gas used 67841
    function deleteTeller() public {
      require(isTeller(msg.sender));
      uint rowToDelete1 = teller[msg.sender].zoneIndex;
      address keyToMove1 = tellerInZone[teller[msg.sender].countryId][teller[msg.sender].postalCode][tellerInZone[teller[msg.sender].countryId][teller[msg.sender].postalCode].length - 1];
      tellerInZone[teller[msg.sender].countryId][teller[msg.sender].postalCode][rowToDelete1] = keyToMove1;
      teller[keyToMove1].zoneIndex = rowToDelete1;
      tellerInZone[teller[msg.sender].countryId][teller[msg.sender].postalCode].length--;

      uint rowToDelete2 = teller[msg.sender].generalIndex;
      address keyToMove2 = tellerIndex[tellerIndex.length - 1];
      tellerIndex[rowToDelete2] = keyToMove2;
      teller[keyToMove2].generalIndex = rowToDelete2;
      tellerIndex.length--;
      delete teller[msg.sender];
      bank.withdrawDthTeller(msg.sender);
      bank.refundEth(msg.sender);
      DeleteTeller(msg.sender);
    }

    // gas used 67841
    function deleteTellerMods(address _toDelete) isTellerModerator(msg.sender) public {
      uint rowToDelete1 = teller[_toDelete].zoneIndex;
      address keyToMove1 = tellerInZone[teller[_toDelete].countryId][teller[_toDelete].postalCode][tellerInZone[teller[_toDelete].countryId][teller[_toDelete].postalCode].length - 1];
      tellerInZone[teller[_toDelete].countryId][teller[_toDelete].postalCode][rowToDelete1] = keyToMove1;
      teller[keyToMove1].zoneIndex = rowToDelete1;
      tellerInZone[teller[_toDelete].countryId][teller[_toDelete].postalCode].length--;

      uint rowToDelete2 = teller[_toDelete].generalIndex;
      address keyToMove2 = tellerIndex[tellerIndex.length - 1];
      tellerIndex[rowToDelete2] = keyToMove2;
      teller[keyToMove2].generalIndex = rowToDelete2;
      tellerIndex.length--;
      delete teller[_toDelete];
      bank.withdrawDthTeller(_toDelete);
      // refund teller ETH
      bank.refundEth(_toDelete);
      DeleteTellerModerator(msg.sender, _toDelete);
    }

     /* function getReput(address _teller) public view returns (
        uint buyVolume,
        uint sellVolume,
        uint loyaltyPoint,
        bytes32[] comment
       ) {

       } */

    function getTeller(address _teller) public view returns (
      bytes16 lat,
      bytes16 lng,
      bytes2 countryId,
      bytes16 postalCode,
      bytes2 currencyId,
      bytes16 messenger,
      bytes2 avatarId,
      bytes16 rates,
      uint balance
      ) {
        Teller storage theTeller = teller[_teller];
        lat = theTeller.lat;
        lng = theTeller.lng;
        countryId = theTeller.countryId;
        postalCode = theTeller.postalCode;
        currencyId = theTeller.currencyId;
        messenger = theTeller.messenger;
        avatarId = theTeller.avatarId;
        rates = theTeller.rates;
        balance = bank.getEthBalTeller(_teller);
      }

    function isTeller(address _teller) public view returns (bool ){
      return (teller[_teller].countryId != bytes2(0x0));
    }

    /*
     * Getter external contract
     */
     function getStakedShop(address _shop) public view returns (uint) {
       return bank.getDthShop(_shop);
     }

     function getStakedTeller(address _teller) public view returns (uint) {
       return bank.getDthTeller(_teller);
     }
}
