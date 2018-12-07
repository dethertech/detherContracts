pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "../dth/IDetherToken.sol";
import "../core/IUsers.sol";
import "../core/IControl.sol";
import "./IGeoRegistry.sol";

// https://github.com/kleros/kleros-interaction/blob/master/contracts/standard/arbitration/CentralizedArbitrator.sol
// https://github.com/ethereum/EIPs/issues/1497 
// emit
contract Shops {

  // ------------------------------------------------
  //
  // Variables Public
  //
  // ------------------------------------------------

  //      geohash   shopOwnerAddresss
  mapping(bytes12 => address) public positionToAddress;
  mapping(bytes7 => address[]) public zoneToShopAddresses;
  mapping(bytes2 => uint) public licensePrice;

  IDetherToken public dth;
  IGeoRegistry public geo;
  IUsers public users;
  IControl public control;

  // ------------------------------------------------
  //
  // Variables Private
  //
  // ------------------------------------------------

  mapping(address => Shop) private addressToShop;

  // ------------------------------------------------
  //
  // Structs
  //
  // ------------------------------------------------

  struct Shop {
    bytes12 position;  // 10 char geohash for location of teller
    bytes16 category;
    bytes16 name;
    bytes32 description;
    bytes16 opening;
  }

  // ------------------------------------------------
  //
  // Events
  //
  // ------------------------------------------------

  // ------------------------------------------------
  //
  // Constructor
  //
  // ------------------------------------------------

  constructor(address _dth, address _geo, address _users, address _control)
    public
  {
    require(_dth != address(0), "dth address cannot be 0x0");
    require(_geo != address(0), "geo address cannot be 0x0");
    require(_users != address(0), "users address cannot be 0x0");
    require(_control != address(0), "control address cannot be 0x0");

    dth = IDetherToken(_dth);
    geo = IGeoRegistry(_geo);
    users = IUsers(_users);
    control = IControl(_control);
  }

  // ------------------------------------------------
  //
  // Functions Getters
  //
  // ------------------------------------------------


  function getShopByAddr(address _addr)
    public
    view
    returns (bytes12, bytes16, bytes16, bytes32, bytes16)
  {
    Shop memory shop = addressToShop[_addr];

    return (
      shop.position,
      shop.category,
      shop.name,
      shop.description,
      shop.opening
    );
  }

  function getShopByPosition(bytes12 _position)
    external
    view
    returns (bytes12, bytes16, bytes16, bytes32, bytes16)
  {
    address shopAddr = positionToAddress[_position];
    return getShopByAddr(shopAddr);
  }

  function getShopsInZone(bytes7 _zoneGeohash)
    external
    view
    returns (address[] memory)
  {
    return zoneToShopAddresses[_zoneGeohash];
  }

  // ------------------------------------------------
  //
  // Functions Getters Private
  //
  // ------------------------------------------------

  function toBytes1(bytes _bytes, uint _start)
    private
    pure
    returns (bytes1) {
      require(_bytes.length >= (_start + 1), " not long enough");
      bytes1 tempBytes1;

      assembly {
          tempBytes1 := mload(add(add(_bytes, 0x20), _start))
      }

      return tempBytes1;
  }
  function toBytes2(bytes _bytes, uint _start)
    private
    pure
    returns (bytes2) {
      require(_bytes.length >= (_start + 2), " not long enough");
      bytes2 tempBytes2;

      assembly {
          tempBytes2 := mload(add(add(_bytes, 0x20), _start))
      }

      return tempBytes2;
  }
  function toBytes4(bytes _bytes, uint _start)
    private
    pure
    returns (bytes4) {
      require(_bytes.length >= (_start + 4), " not long enough");
      bytes4 tempBytes4;

      assembly {
          tempBytes4 := mload(add(add(_bytes, 0x20), _start))
      }

      return tempBytes4;
  }
  function toBytes7(bytes _bytes, uint _start)
    private
    pure
    returns (bytes7) {
      require(_bytes.length >= (_start + 7), " not long enough");
      bytes7 tempBytes7;

      assembly {
          tempBytes7 := mload(add(add(_bytes, 0x20), _start))
      }

      return tempBytes7;
  }
  function toBytes12(bytes _bytes, uint _start)
    private
    pure
    returns (bytes12) {
      require(_bytes.length >= (_start + 12), " not long enough");
      bytes12 tempBytes12;

      assembly {
          tempBytes12 := mload(add(add(_bytes, 0x20), _start))
      }

      return tempBytes12;
  }
  function toBytes16(bytes _bytes, uint _start)
    private
    pure
    returns (bytes16) {
      require(_bytes.length >= (_start + 16), " not long enough");
      bytes16 tempBytes16;

      assembly {
          tempBytes16 := mload(add(add(_bytes, 0x20), _start))
      }

      return tempBytes16;
  }
  function toBytes32(bytes _bytes, uint _start)
    private
    pure
    returns (bytes32) {
      require(_bytes.length >= (_start + 32), " not long enough");
      bytes32 tempBytes32;

      assembly {
          tempBytes32 := mload(add(add(_bytes, 0x20), _start))
      }

      return tempBytes32;
  }

  // ------------------------------------------------
  //
  // Functions Setters Public
  //
  // ------------------------------------------------

  function setLicensePrice(bytes2 _countryCode, uint _priceDth)
    external
  {
    require(control.isCEO(msg.sender), "can only be called by CEO");
    licensePrice[_countryCode] = _priceDth;
  }

  function addShop(bytes2 _countryCode, bytes _position, bytes16 _category, bytes16 _name, bytes32 _description, bytes16 _opening)
    external
  {
    require(control.paused() == false, "contract is paused");
    require(geo.countryIsEnabled(_countryCode), "country is disabled");
    require(users.getUserTier(msg.sender) > 0, "user not certified");

    // TODO: can one address own multiple shops? for now we say NO it cannot
    require(addressToShop[msg.sender].position == bytes12(0), "caller already has shop");

    require(_position.length == 12, "expected position to be 10 bytes");
    require(positionToAddress[toBytes12(_position, 0)] == address(0), "shop already exists at position");

    require(geo.validGeohashChars(_position), "invalid geohash characters in position");
    require(geo.zoneInsideCountry(_countryCode, toBytes4(_position, 0)), "zone is not inside country");

    bytes7 zoneGeohash = toBytes7(_position, 0);
    bytes12 tellerGeoHash = toBytes12(_position, 0);

    Shop storage shop = addressToShop[msg.sender];
    shop.position = tellerGeoHash;
    shop.category = _category;
    shop.name = _name;
    shop.description = _description;
    shop.opening = _opening;

    positionToAddress[tellerGeoHash] = msg.sender;
    zoneToShopAddresses[zoneGeohash].push(msg.sender);
    // emit ShopCreated(msg.sender);
  }
  function tokenFallback(address _from, uint _value, bytes _data)
    public
  {
    require(msg.sender == address(dth), "can only be called by dth contract");

    require(control.paused() == false, "contract is paused");

    require(_data.length == 95, "addShop expects 96 bytes as data");

    address sender = _from;
    uint dthAmount = _value;

    bytes1 fn = toBytes1(_data, 0);
    bytes2 country = toBytes2(_data, 1);
    bytes12 position = toBytes12(_data, 3);
    bytes16 category = toBytes16(_data, 15);
    bytes16 name = toBytes16(_data, 31);
    bytes32 description = toBytes32(_data, 47);
    bytes16 opening = toBytes16(_data, 79);

    require(fn == bytes1(0x30), "incorrect first byte in data, expected 0x30");
    require(geo.countryIsEnabled(country), "country is disabled");
    require(users.getUserTier(sender) > 0, "user not certified");
    require(addressToShop[sender].position == bytes12(0), "caller already has shop");
    require(positionToAddress[position] == address(0), "shop already exists at position");
    require(geo.validGeohashChars12(position), "invalid geohash characters in position");
    require(geo.zoneInsideCountry(country, bytes4(position)), "zone is not inside country");

    require(_value >= licensePrice[country], "send dth is less than shop license price");

    bytes7 zoneGeohash = bytes7(position);

    Shop storage shop = addressToShop[msg.sender];
    shop.position = position;
    shop.category = category;
    shop.name = name;
    shop.description = description;
    shop.opening = opening;

    positionToAddress[position] = msg.sender;
    zoneToShopAddresses[zoneGeohash].push(msg.sender);
  }
  function removeShop(bytes12 _position)
    external
  {
    require(_position != bytes12(0), "position cannot be bytes12(0)");
    require(addressToShop[msg.sender].position == _position, "caller does not own shop at position");

    delete addressToShop[msg.sender];

    positionToAddress[_position] = address(0);

    address[] storage zoneShopAddresses = zoneToShopAddresses[bytes7(_position)];

    // it's safe to do a loop, the numberof geohash12 in any geohash7 is less than the max uint value
    for (uint i = 0; i < zoneShopAddresses.length; i += 1) {
      address zoneShopAddress = zoneShopAddresses[i];
      if (zoneShopAddress == msg.sender) {
        address lastShopAddress = zoneShopAddresses[zoneShopAddresses.length - 1];
        zoneShopAddresses[i] = lastShopAddress;
        zoneShopAddresses.length--;
        break; // done
      }
    }
  }
}
