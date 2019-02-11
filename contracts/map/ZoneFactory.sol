pragma solidity ^0.5.3;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "../dth/ERC223ReceivingContract.sol";
import "../dth/IDetherToken.sol";
import "../core/IUsers.sol";
import "../core/IControl.sol";
import "./IGeoRegistry.sol";
import "./IZone.sol";
import "./ITeller.sol";

import "../eip1167/CloneFactory.sol";

contract ZoneFactory is ERC223ReceivingContract, Ownable, CloneFactory {

  // ------------------------------------------------
  //
  // Variables Public
  //
  // ------------------------------------------------

  //      geohash   zoneContractAddress or 0x0 if it doesnt exist
  // TODO: now we can use computeCSC() to get CSC, do we need it? not really
  mapping(bytes7 => address) public geohashToZone;
  mapping(address => bytes7) public zoneToGeohash;

  IDetherToken public dth;
  IGeoRegistry public geo;
  IUsers public users;
  IControl public control;

  address public zoneImplementation;
  address public tellerImplementation;

  // ------------------------------------------------
  //
  // Events
  //
  // ------------------------------------------------

  // TODO

  // ------------------------------------------------
  //
  // Constructor
  //
  // ------------------------------------------------

  constructor(address _dth, address _geo, address _users, address _control, address _zoneImplementation, address _tellerImplementation)
    public
  {
    require(_dth != address(0), "dth address cannot be 0x0");
    require(_geo != address(0), "geo address cannot be 0x0");
    require(_users != address(0), "users address cannot be 0x0");
    require(_control != address(0), "control address cannot be 0x0");
    require(_zoneImplementation != address(0), "zoneImplementation address cannot be 0x0");
    require(_tellerImplementation != address(0), "tellerImplementation address cannot be 0x0");

    dth = IDetherToken(_dth);
    geo = IGeoRegistry(_geo);
    users = IUsers(_users);
    control = IControl(_control);

    zoneImplementation = _zoneImplementation;
    tellerImplementation = _tellerImplementation;
  }

  // ------------------------------------------------
  //
  // Functions Private Getters
  //
  // ------------------------------------------------

  function toBytes1(bytes memory _bytes, uint _start)
    private
    pure
    returns (bytes1)
  {
    require(_bytes.length >= (_start + 1), " not long enough");
    bytes1 tempBytes1;

    assembly {
        tempBytes1 := mload(add(add(_bytes, 0x20), _start))
    }

    return tempBytes1;
  }

  function toBytes2(bytes memory _bytes, uint _start)
    private
    pure
    returns (bytes2)
  {
    require(_bytes.length >= (_start + 2), " not long enough");
    bytes2 tempBytes2;

    assembly {
        tempBytes2 := mload(add(add(_bytes, 0x20), _start))
    }

    return tempBytes2;
  }

  function toBytes7(bytes memory _bytes, uint _start)
    private
    pure
    returns (bytes7)
  {
    require(_bytes.length >= (_start + 7), " not long enough");
    bytes7 tempBytes7;

    assembly {
        tempBytes7 := mload(add(add(_bytes, 0x20), _start))
    }

    return tempBytes7;
  }

  function slice(bytes memory _bytes, uint _start, uint _length)
    private
    pure
    returns (bytes memory)
  {
    require(_bytes.length >= (_start + _length));
    bytes memory tempBytes;
    assembly {
        switch iszero(_length)
        case 0 {
            tempBytes := mload(0x40)
            let lengthmod := and(_length, 31)
            let mc := add(add(tempBytes, lengthmod), mul(0x20, iszero(lengthmod)))
            let end := add(mc, _length)
            for {
                let cc := add(add(add(_bytes, lengthmod), mul(0x20, iszero(lengthmod))), _start)
            } lt(mc, end) {
                mc := add(mc, 0x20)
                cc := add(cc, 0x20)
            } {
                mstore(mc, mload(cc))
            }
            mstore(tempBytes, _length)
            mstore(0x40, and(add(mc, 31), not(31)))
        }
        default {
            tempBytes := mload(0x40)
            mstore(0x40, add(tempBytes, 0x20))
        }
    }
    return tempBytes;
  }

  // ------------------------------------------------
  //
  // Functions Public Getters
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
  // Functions Setters Public
  //
  // ------------------------------------------------

  function proxyUpdateUserDailySold(bytes2 _countryCode, address _from, address _to, uint _amount)
    external
  {
    require(zoneToGeohash[msg.sender] != bytes7(0), "can only be called by a registered zone");

    users.updateDailySold(_countryCode, _from, _to, _amount);
  }

  // ERC223 magic
  function tokenFallback(address _from, uint _value, bytes memory _data) // GAS COST +/- 3.763.729
    public
  {
    require(msg.sender == address(dth), "can only be called by dth contract");

    require(control.paused() == false, "contract is paused");
    require(_data.length == 10, "createAndClaim expects 10 bytes as data");

    // we only expect 1 function to be called, createAndClaim, encoded as bytes1(0x40)
    require(toBytes1(_data, 0) == bytes1(0x40), "incorrect first byte in data, expected 0x40");

    address sender = _from;
    uint dthAmount = _value;

    bytes2 country = toBytes2(_data, 1);
    bytes7 geohash = toBytes7(_data, 3);

    require(geo.countryIsEnabled(country), "country is disabled");
    require(geo.zoneInsideCountry(country, bytes4(geohash)), "zone is not inside country");
    require(geohashToZone[geohash] == address(0), "zone already exists");

    // deploy zone + teller contract
    address newZoneAddress = createClone(zoneImplementation);
    address newTellerAddress = createClone(tellerImplementation);

    // init zone + teller contract

    IZone(newZoneAddress).init(
      country, geohash, sender, dthAmount,
      address(dth), address(geo), address(control), address(this)
    );

    ITeller(newTellerAddress).init(address(geo), address(control), newZoneAddress);
    IZone(newZoneAddress).connectToTellerContract(newTellerAddress);

    // store references
    geohashToZone[geohash] = newZoneAddress;
    zoneToGeohash[newZoneAddress] = geohash;

    // send all dth through to the new Zone contract
    dth.transfer(newZoneAddress, dthAmount, hex"40");
  }
}
