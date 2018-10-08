pragma solidity ^0.4.22;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';

contract Lexico is Ownable {
  // countrycode
  mapping(bytes2 => mapping(bytes1 => bytes1[])) public level_0;
  mapping(bytes2 => mapping(bytes2 => bytes1[])) public level_1;
  mapping(bytes2 => mapping(bytes3 => bytes1[])) public level_2;

  function getLevel0subArray(bytes2 countrycode, bytes1 letter)
    public
    view
    returns (bytes1[])
  {
    return level_0[countrycode][letter];
  }

  function getLevel1subArray(bytes2 countrycode, bytes2 letter)
    public
    view
    returns (bytes1[])
  {
    return level_1[countrycode][letter];
  }

  function getLevel2subArray(bytes2 countrycode, bytes3 letter)
    public
    view
    returns (bytes1[])
  {
    return level_2[countrycode][letter];
  }

  function updateLevel0(bytes2 countrycode, bytes1 letter, bytes1[] subLetters)
    public
    onlyOwner
  {
    level_0[countrycode][letter] = subLetters;
  }

  function updateLevel1(bytes2 countrycode, bytes2 letter, bytes1[] subLetters)
    public
    onlyOwner
  {
    level_1[countrycode][letter] = subLetters;
  }

  function updateLevel2(bytes2 countrycode, bytes3 letter, bytes1[] subLetters)
    public
    onlyOwner
  {
    level_2[countrycode][letter] = subLetters;
  }

  function byteInsideArray(bytes1 b, bytes1[] array)
    public
    pure
    returns (bool)
  {
    uint256 len = array.length;

    if (len == 0) {
      return false;
    }

    for (uint256 i = 0 ; i < len ; i++) {
      if (array[i] == b) {
        return true;
      }
    }
    return false;
  }

  function toBytes3(bytes7 _bytes7)
    public
    pure
    returns (bytes3)
  {
    return bytes3(_bytes7);
  }

  function get4thByte(bytes7 _bytes7)
    public
    pure
    returns (bytes1)
  {
    return bytes1(_bytes7[3]);
  }

  function zoneInsideCountry(bytes2 countrycode, bytes7 zone)
    public
    view
    returns (bool)
  {
    bytes3 index = toBytes3(zone);
    bytes1 b = get4thByte(zone);

    var array = level_2[countrycode][index];
    if (byteInsideArray(b, array) == true) {
      return true;
    } else {
      return false;
    }
  }
}
