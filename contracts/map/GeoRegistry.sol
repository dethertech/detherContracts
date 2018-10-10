pragma solidity ^0.4.22;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';

contract GeoRegistry is Ownable {
  mapping(bytes1 => bytes4) internal charToBitmask;

  constructor() {
    charToBitmask[bytes1("v")] = hex"80000000"; // 2147483648
    charToBitmask[bytes1("y")] = hex"40000000"; // 1073741824
    charToBitmask[bytes1("z")] = hex"20000000"; // 536870912
    charToBitmask[bytes1("b")] = hex"10000000"; // 268435456
    charToBitmask[bytes1("c")] = hex"08000000"; // 134217728
    charToBitmask[bytes1("f")] = hex"04000000"; // 67108864
    charToBitmask[bytes1("g")] = hex"02000000"; // 33554432
    charToBitmask[bytes1("u")] = hex"01000000"; // 16777216
    charToBitmask[bytes1("t")] = hex"00800000"; // 8388608
    charToBitmask[bytes1("w")] = hex"00400000"; // 4194304
    charToBitmask[bytes1("x")] = hex"00200000"; // 2097152
    charToBitmask[bytes1("8")] = hex"00100000"; // 1048576
    charToBitmask[bytes1("9")] = hex"00080000"; // 524288
    charToBitmask[bytes1("d")] = hex"00040000"; // 262144
    charToBitmask[bytes1("e")] = hex"00020000"; // 131072
    charToBitmask[bytes1("s")] = hex"00010000"; // 65536
    charToBitmask[bytes1("m")] = hex"00008000"; // 32768
    charToBitmask[bytes1("q")] = hex"00004000"; // 16384
    charToBitmask[bytes1("r")] = hex"00002000"; // 8192
    charToBitmask[bytes1("2")] = hex"00001000"; // 4096
    charToBitmask[bytes1("3")] = hex"00000800"; // 2048
    charToBitmask[bytes1("6")] = hex"00000400"; // 1024
    charToBitmask[bytes1("7")] = hex"00000200"; // 512
    charToBitmask[bytes1("k")] = hex"00000100"; // 256
    charToBitmask[bytes1("j")] = hex"00000080"; // 128
    charToBitmask[bytes1("n")] = hex"00000040"; // 64
    charToBitmask[bytes1("p")] = hex"00000020"; // 32
    charToBitmask[bytes1("0")] = hex"00000010"; // 16
    charToBitmask[bytes1("1")] = hex"00000008"; // 8
    charToBitmask[bytes1("4")] = hex"00000004"; // 4
    charToBitmask[bytes1("5")] = hex"00000002"; // 2
    charToBitmask[bytes1("h")] = hex"00000001"; // 1
  }

  mapping(bytes2 => mapping(bytes3 => bytes4)) public level_2;

  function updateLevel2(bytes2 _countryCode, bytes3 _letter, bytes4 _subLetters)
    public
    onlyOwner
  {
    level_2[_countryCode][_letter] = _subLetters;
  }
  function updateLevel2batch(bytes2 _countryCode, bytes3[] _letters, bytes4[] _subLetters)
    public
    onlyOwner
  {
    for (uint i = 0; i < _letters.length; i++) {
      level_2[_countryCode][_letters[i]] = _subLetters[i];
    }
  }

  function zoneInsideCountry(bytes2 _countryCode, bytes7 _zone)
    public
    view
    returns (bool)
  {
    bytes3 level2key = bytes3(_zone);
    bytes4 level3bits = level_2[_countryCode][level2key];

    bytes1 fourthByte = bytes1(_zone[3]);
    bytes4 bitPosMask = charToBitmask[fourthByte];

    if (level3bits & bitPosMask != 0) {
      return true;
    } else {
      return false;
    }
  }
}
