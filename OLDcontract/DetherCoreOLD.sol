pragma solidity ^0.4.18;

import './certifier/SmsCertifier.sol';
import './DthRegistry.sol';
import './DetherSetup.sol';

contract DetherCore is DetherSetup, DthRegistry {
//  using SafeMath for uint256;

  /*
   * EVENT
   */
   event RegisterShop(address shopAddress);
   event DeleteShop(address shopAddress);
   event DeleteShopModerator(address indexed moderator, address shopAddress);
   /* address public newContractAddress; */

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

  function DetherCore() public {
    ceoAddress = msg.sender;
  }

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
      _withdrawShop(msg.sender);
      DeleteShop(msg.sender);
    }

    // gas used 67841
    function deleteShopMods(address _toDelete) public onlyModerator {
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
      _withdrawShop(_toDelete);
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

    /// @dev Standard ERC223 function that will handle incoming token transfers.
    /// @param _from  Token sender address.
    /// @param _value Amount of tokens.
    /// @param _data  Transaction metadata.
    function tokenFallback(address _from, uint _value, bytes _data) isSmsWhitelisted(_from) {

      // require staked greater than licence price
      require(_value >= licenceShop);
      // require is not already shop
      require(!isShop(_from));
      // require zone is open
      require(openedCountryShop[_data.toBytes2(33)]);
      // require than the token fallback is triggered from the dth token contract
      require(msg.sender == address(dth));

      bytes1 _func = _data.toBytes1(0);
      // 1 / 0x31 = shop // 2 / 0x32 = teller
      if (_func == bytes1(0x31)) {
        shop[_from].lat = _data.toBytes16(1);
        shop[_from].lng = _data.toBytes16(17);
        shop[_from].name = _data.toBytes16(67);
        shop[_from].cat = _data.toBytes16(51);
        shop[_from].description = _data.toBytes32(83);
        shop[_from].opening = _data.toBytes16(115);
        shop[_from].countryId = _data.toBytes2(33);
        shop[_from].postalCode = _data.toBytes16(35);
        shop[_from].generalIndex = shopIndex.push(_from) - 1;
        shop[_from].zoneIndex = shopInZone[shop[_from].countryId][shop[_from].postalCode].push(_from) - 1;
        RegisterShop(_from);
        addTokenShop(_from,_value);
      }
    }
}
