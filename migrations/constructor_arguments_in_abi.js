/*
Author: Robert Lie (mobilefish.com)
More information about this file, see:
https://www.mobilefish.com/developer/blockchain/blockchain_quickguide_ethereum_tools.html

More information about ethereumjs-abi
https://www.npmjs.com/package/ethereumjs-abi
https://github.com/ethereumjs/ethereumjs-abi

WARNING:
The library ethereumjs-abi is not fully implemented yet!
For example:
- byte not supported. Use bytes1 instead
  var parameterTypes = ['byte'];
  var parameterValues = [5];

Purpose:
Encode the constructor arguments in ABI hex form.
The output can be used for Contract Verification (For contracts that accept constructor parameters), see:
https://etherscan.io/verifyContract

Prerequisites:
+ Nodejs: https://nodejs.org/en/download/
+ ethereumjs-abi: https://www.npmjs.com/package/ethereumjs-abi
  npm install -g ethereumjs-abi
+ bn.js: https://www.npmjs.com/package/bn.js
  npm install -g bn.js

  Note: Show all installed node modules:
  npm list -g --depth=0

Usage:
- Rename this file to constructor_arguments_in_abi.js
- Specify parameterTypes and parameterValues
  You can see several examples how it is done.
  Examples found in:
  https://github.com/ethereumjs/ethereumjs-abi/blob/master/test/index.js
- Run this script, type: node constructor_arguments_in_abi.js
*/

var abi = require('ethereumjs-abi');
var BN = require('bn.js')

// Example 1
//var parameterTypes = ['address', 'uint256', 'bool'];
//var parameterValues = ['0x1234567812345678', '0x314159268', true];

// Example 2
//var parameterTypes = ['address', 'uint', 'uint'];
//var parameterValues = ['0x829bd824b016326a401d083b33d092293333a830', 4, 177772];

// Example 3
//var parameterTypes = ['bytes', 'bool', 'uint256[]'];
//var parameterValues = ['dave', true, [ 1, 2, 3 ] ];

// Example 4
//var parameterTypes = ['uint', 'uint32[]', 'bytes10', 'bytes'];
//var parameterValues = [0x123, [ 0x456, 0x789 ], '1234567890', 'Hello, world!'];

// Example 5
//var parameterTypes = ['int32', 'int32', int256];
//var parameterValues = [-2, 6, -1];

// Example 6
//var parameterTypes = ['string'];
//var parameterValues = ['hello world'];

// Example 7
//var parameterTypes = ['uint256'];
//var val = new BN("115792089237316195423570985008687907853269984665640564039457584007913129639935", 10);
//var parameterValues = [val];

// Example 8: Largest value for bytes32
//var parameterTypes = ['bytes32'];
//var val = new BN("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF", 16);
//var parameterValues = [val];

// Example 9: Largest negative value for type int256
//var parameterTypes = ['int256'];
//var val = new BN("-57896044618658097711785492504343953926634992332820282019728792003956564819968", 10);
//var parameterValues = [val];

// Example 10: Largest positive value for type int256
//var parameterTypes = ['int256'];
//var val = new BN("57896044618658097711785492504343953926634992332820282019728792003956564819967", 10);
//var parameterValues = [val];

// Example 11: Largest positive value for type uint256
//var parameterTypes = ['uint256'];
//var val = new BN(" 115792089237316195423570985008687907853269984665640564039457584007913129639935", 10);
//var parameterValues = [val];

// Example 12
//parameterTypes = ['uint8[]'];
//var parameterValues = [[1]];

// Example 13:  Chinese 你, Unicode: U-4F60
//parameterTypes = ['string'];
//var parameterValues = "你";


var parameterTypes = ['address'];
// storage address
var parameterValues = ['0xdbf01f25066c2a6c6d311f047917ebed72d8ca42'];

// ===========================================================================
var encoded = abi.rawEncode(parameterTypes, parameterValues);
console.log("Encoded: \n",encoded.toString('hex'));

// returns the decoded array of arguments
var decoded = abi.rawDecode(parameterTypes, encoded);
console.log("Decoded: \n",decoded);
