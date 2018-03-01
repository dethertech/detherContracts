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
   event RegisterShop(address shopAddress);
   event DeleteShop(address shopAddress);
   event DeleteShopModerator(address indexed moderator, address shopAddress);
   event LogTemp(string str, address _addr);
   address public newContractAddress;

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

  // gas used 227000
  /* function addShop(
    bytes16 lat,
    bytes16 lng,
    bytes2 countryId,
    bytes16 postalCode,
    bytes16 cat,
    bytes16 name,
    bytes32 description,
    bytes16 opening
    )  public isSmsWhitelisted(msg.sender) shopHasStaked(licenceShop) isZoneShopOpen(countryId) {
      require(!isShop(msg.sender));

      Shop memory theShop;
      theShop.lat = lat;
      theShop.lng = lng;
      theShop.name = name;
      theShop.description = description;
      theShop.opening = opening;
      theShop.countryId = countryId;
      theShop.postalCode = postalCode;
      theShop.generalIndex = shopIndex.push(msg.sender) - 1;
      theShop.zoneIndex = shopInZone[countryId][postalCode].push(msg.sender) - 1;
      shop[msg.sender] = theShop;
      RegisterShop(msg.sender);
  } */

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

    function getZone(bytes2 _country, bytes16 _postalcode) public view returns (address[]) {
        return shopInZone[_country][_postalcode];
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
      require(openedCountryShop[_data.toBytes2(32)]);
      // require than the token fallback is triggered from the dth token contract
      require(msg.sender == address(dth));

      /* bytes16 _lat = _data.toBytes16(0);
      bytes16 _lng = _data.toBytes16(16);
      bytes2 _countryId = _data.toBytes2(32);
      bytes16 _postalCode = _data.toBytes16(34);
      bytes16 _cat = _data.toBytes16(50);
      bytes16 _name = _data.toBytes16(66);
      bytes32 _description = _data.toBytes32(82);
      bytes16 _opening = _data.toBytes16(114); */
      bytes1 _func = _data.toBytes1(130);

      /* LogBytes16('lat ', _lat);
      LogBytes16('lng ', _lng);
      LogBytes2('countryId', _countryId);
      LogBytes16('postal', _postalCode);
      LogBytes16('cat', _cat);
      LogBytes16('name', _name);
      LogBytes32('description', _description);
      LogBytes16('opening', _opening); */

      /* LogTemp('pre reg', shopInZone[_data.toBytes2(32)][_data.toBytes16(34)][0]); */
      LogTemp('register addr', _from);
      // 1 / 0x31 = shop // 2 / 0x32 = teller
      if (_func == bytes1(0x31)) {
        /* Shop memory theShop = shop[_from];
        theShop.lat = _data.toBytes16(0);
        theShop.lng = _data.toBytes16(16);
        theShop.name = _data.toBytes16(66);
        theShop.description = _data.toBytes32(82);
        theShop.opening = _data.toBytes16(114);
        theShop.countryId = _data.toBytes2(32);
        theShop.postalCode = _data.toBytes16(34);
        theShop.generalIndex = shopIndex.push(_from) - 1;
        theShop.zoneIndex = shopInZone[theShop.countryId][theShop.postalCode].push(_from) - 1; */
        shop[_from].lat = _data.toBytes16(0);
        shop[_from].lng = _data.toBytes16(16);
        shop[_from].name = _data.toBytes16(66);
        shop[_from].cat = _data.toBytes16(50);
        shop[_from].description = _data.toBytes32(82);
        shop[_from].opening = _data.toBytes16(114);
        shop[_from].countryId = _data.toBytes2(32);
        shop[_from].postalCode = _data.toBytes16(34);
        LogBytes2('id', shop[_from].countryId);
        LogBytes16('postalcode', shop[_from].postalCode);
        shop[_from].generalIndex = shopIndex.push(_from) - 1;
        shop[_from].zoneIndex = shopInZone[shop[_from].countryId][shop[_from].postalCode].push(_from) - 1;
        RegisterShop(_from);
        addTokenShop(_from,_value);
        /* ReceiveDthShop(_from, _value, _data); */
      }
    }

}
