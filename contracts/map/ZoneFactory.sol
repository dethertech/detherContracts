pragma solidity ^0.4.22;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import 'bytes/BytesLib.sol';

// will be deployed by this factory
import "./Zone.sol";

// import "../dth/IDetherToken.sol";

contract Dth {
  function transfer(address _to, uint _value, bytes _data) public returns (bool);
}

contract ZoneFactory is Ownable {
  using BytesLib for bytes;

  // ------------------------------------------------
  // Variables (Getters)
  // ------------------------------------------------

  //      geohash   zoneContractAddress or 0x0 if it doesnt exist
  // TODO: now we can use computeCSC() to get CSC, do we need it? not really
  mapping(bytes7 => address) public geohashToZone;

  // TOOD:   geohash   cscId
  // mapping(bytes7 => bytes12)

  Dth public dth;

  // ------------------------------------------------
  // Events
  // ------------------------------------------------

  event ZoneFactoryCreatedZone(address indexed zoneAddress, bytes7 indexed zoneGeohash, address indexed zoneOwner, uint dthStake);

  // ------------------------------------------------
  // Constructor
  // ------------------------------------------------
  constructor(address _dth)
    public
  {
    require(_dth != address(0), "dth address cannot be 0x0");
    dth = Dth(_dth);
  }
  // ------------------------------------------------
  // Getters
  // ------------------------------------------------

  function zoneExists(bytes7 _geohash)
    external
    view
    returns (bool)
  {
    return geohashToZone[_geohash] != address(0);
  }

  function toBytes7(bytes _bytes, uint _start)
    internal
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
  // Setters
  // ------------------------------------------------

  // ERC223 magic
  function tokenFallback(address _from, uint _value, bytes _data)
    // createAndClaim
    public
  {
    require(msg.sender == address(dth), "can only be called by dth contract");

    require(_data.length == 8, "createAndClaim expect 8 bytes as _data");

    // we only expect 1 function to be called, createAndClaim, encoded as bytes1(0x40)
    require(_data.toBytes1(0) == bytes1(0x40), "incorrect first byte in data, expected 0x40");

    address sender = _from;
    uint dthAmount = _value;

    bytes7 geohash = toBytes7(_data, 1);

    // TOOD: add check that country is enabled?
    require(geohash != bytes7(0), "geohash cannot be 0x0");
    require(geohashToZone[geohash] == address(0), "cannot create existing zone");

    // create/deploy the new zone
    geohashToZone[geohash] = new Zone(geohash, sender, dthAmount, address(dth));

    // send all dth through to the new Zone contract
    bytes memory data = hex"40";
    dth.transfer(geohashToZone[geohash], dthAmount, data);

    // event
    emit ZoneFactoryCreatedZone(geohashToZone[geohash], geohash, sender, dthAmount);
  }
}
