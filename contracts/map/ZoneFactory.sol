pragma solidity ^0.4.22;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";

import "../dth/IDetherToken.sol";
import "../core/IUsers.sol";
import "../core/IControl.sol";
import "./IGeoRegistry.sol";

// will be deployed by this factory so we need the entire contract
import "./Zone.sol";

contract ZoneFactory is Ownable {

  // ------------------------------------------------
  //
  // Variables Public
  //
  // ------------------------------------------------

  //      geohash   zoneContractAddress or 0x0 if it doesnt exist
  // TODO: now we can use computeCSC() to get CSC, do we need it? not really
  mapping(bytes7 => address) public geohashToZone;

  IDetherToken public dth;
  IGeoRegistry public geo;
  IUsers public users;
  IControl public control;

  // ------------------------------------------------
  //
  // Events
  //
  // ------------------------------------------------

  event ZoneFactoryCreatedZone(address indexed zoneAddress, bytes7 indexed zoneGeohash, address indexed zoneOwner, uint dthStake);

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


  function zoneExists(bytes7 _geohash)
    external
    view
    returns (bool)
  {
    return geohashToZone[_geohash] != address(0);
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

  // ------------------------------------------------
  //
  // Functions Setters Public
  //
  // ------------------------------------------------

  // ERC223 magic
  function tokenFallback(address _from, uint _value, bytes _data) // GAS COST 2.072.132
    public
  {
    require(control.paused() == false, "contract is paused");
    require(msg.sender == address(dth), "can only be called by dth contract");

    require(_data.length == 10, "createAndClaim expect 10 bytes as _data");

    // we only expect 1 function to be called, createAndClaim, encoded as bytes1(0x40)
    require(toBytes1(_data, 0) == bytes1(0x40), "incorrect first byte in data, expected 0x40");

    address sender = _from;
    uint dthAmount = _value;

    bytes2 country = toBytes2(_data, 1);
    bytes7 geohash = toBytes7(_data, 3);

    require(geo.countryIsEnabled(country), "country is disabled");
    require(geohash != bytes7(0), "geohash cannot be 0x0");
    require(geo.zoneInsideCountry(country, geohash), "zone is not inside country");
    require(geohashToZone[geohash] == address(0), "zone already exists");
    require(users.getUserTier(sender) > 0, "user not certified");

    // create/deploy the new zone
    geohashToZone[geohash] = new Zone(
      country, geohash, sender, dthAmount,
      address(dth), address(geo), address(users), address(control)
    );

    // send all dth through to the new Zone contract
    dth.transfer(geohashToZone[geohash], dthAmount, hex"40");

    emit ZoneFactoryCreatedZone(geohashToZone[geohash], geohash, sender, dthAmount);
  }
}
