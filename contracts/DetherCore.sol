
pragma solidity ^0.4.18;

import './dth/DetherToken.sol';
import './certifier/SmsCertifier.sol';
import './DthRegistry.sol';
import './DetherSetup.sol';

contract DetherCore is DetherSetup, DthRegistry {
//  using SafeMath for uint256;

  /*
   * EVENT
   */
   event RegisterShop(address indexed shopAddress);
   event DeleteShop(address indexed shopAddress);
   address public newContractAddress;

  struct Shop {
    uint lat;
    uint lng;
    bytes2 countryId;
    bytes16 postalCode;
    bytes16 cat;
    bytes16 name;
    bytes32 description; // max length 100 char
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

  /// @dev Used to mark the smart contract as upgraded, in case there is a serious
  ///  breaking bug. This method does nothing but keep track of the new contract and
  ///  emit a message indicating that the new address is set. It's up to clients of this
  ///  contract to update to the new contract address in that case. (This contract will
  ///  be paused indefinitely if such an upgrade takes place.)
  /// @param _v2Address new address
  function setNewAddress(address _v2Address) external onlyCEO whenPaused {
      // See README.md for updgrade plan
      newContractAddress = _v2Address;
      ContractUpgrade(_v2Address);
  }

  // gas used 244000
  function addShop(
    uint lat,
    uint lng,
    bytes2 countryId,
    bytes16 postalCode,
    bytes16 cat,
    bytes16 name,
    bytes32 description,
    bytes16 opening
    )  public isSmsWhitelisted(msg.sender) shopHasStaked(licenceShop) {
      require(!isShop(msg.sender));
      shop[msg.sender].lat = lat;
      shop[msg.sender].lng = lng;
      shop[msg.sender].name = name;
      shop[msg.sender].description = description;
      shop[msg.sender].opening = opening;
      shop[msg.sender].countryId = countryId;
      shop[msg.sender].postalCode = postalCode;
      shop[msg.sender].generalIndex = shopIndex.push(msg.sender) - 1;
      shop[msg.sender].zoneIndex = shopInZone[countryId][postalCode].push(msg.sender) - 1;

      RegisterShop(msg.sender);
  }

  function getShop(address _shop) public view returns (
    uint lat,
    uint lng,
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
      _withdrawShop();
      DeleteShop(msg.sender);
    }

    function getZone(bytes2 _country, bytes16 _postalcode) public view returns (address[]) {
        return shopInZone[_country][_postalcode];
    }

    function isShop(address _shop) public view returns (bool isIndeed){
      return (shop[msg.sender].countryId != bytes2(0x0));
    }
}
