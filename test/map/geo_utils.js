/* eslint-disable max-len, no-await-in-loop, guard-for-in, no-restricted-syntax, object-curly-newline */
const path = require('path');
const ethUtil = require('ethereumjs-util');
const bignum = require('bignum');

const toBitMap = (chars) => {
  let res = bignum('0');
  chars.forEach((char) => {
    switch (char) {
      case 'v': res = res.or('2147483648'); break;
      case 'y': res = res.or('1073741824'); break;
      case 'z': res = res.or('536870912'); break;
      case 'b': res = res.or('268435456'); break;
      case 'c': res = res.or('134217728'); break;
      case 'f': res = res.or('67108864'); break;
      case 'g': res = res.or('33554432'); break;
      case 'u': res = res.or('16777216'); break;
      case 't': res = res.or('8388608'); break;
      case 'w': res = res.or('4194304'); break;
      case 'x': res = res.or('2097152'); break;
      case '8': res = res.or('1048576'); break;
      case '9': res = res.or('524288'); break;
      case 'd': res = res.or('262144'); break;
      case 'e': res = res.or('131072'); break;
      case 's': res = res.or('65536'); break;
      case 'm': res = res.or('32768'); break;
      case 'q': res = res.or('16384'); break;
      case 'r': res = res.or('8192'); break;
      case '2': res = res.or('4096'); break;
      case '3': res = res.or('2048'); break;
      case '6': res = res.or('1024'); break;
      case '7': res = res.or('512'); break;
      case 'k': res = res.or('256'); break;
      case 'j': res = res.or('128'); break;
      case 'n': res = res.or('64'); break;
      case 'p': res = res.or('32'); break;
      case '0': res = res.or('16'); break;
      case '1': res = res.or('8'); break;
      case '4': res = res.or('4'); break;
      case '5': res = res.or('2'); break;
      case 'h': res = res.or('1'); break;
      default: throw new Error(`unknown geohash char ${char}`);
    }
  });
  return ethUtil.bufferToHex(ethUtil.setLengthLeft(res.toNumber(), 4));
};

const addCountry = async (from, web3, geoRegistryContract, countryCode, batchSize) => {
  const countryFile = require(path.join(__dirname, '..', '..', 'data', 'trees_countries', countryCode)); // eslint-disable-line
  const countryMap = Object.keys(countryFile).reduce((memo, level0char) => {
    Object.keys(countryFile[level0char]).forEach((level1char) => {
      Object.keys(countryFile[level0char][level1char]).forEach((level2char) => {
        const level4chars = Object.keys(countryFile[level0char][level1char][level2char]);
        memo[`${level0char}${level1char}${level2char}`] = toBitMap(level4chars); // eslint-disable-line
      });
    });
    return memo;
  }, {});

  const keys = Object.keys(countryMap);

  let countryGasCost = 0;
  let txCount = 0;
  let mostExpensiveTrxGasCost = 0;

  for (let batchStartIdx = 0; batchStartIdx < keys.length; batchStartIdx += batchSize) {
    const keysBatch = keys.slice(batchStartIdx, batchStartIdx + batchSize);
    const valuesBatch = keysBatch.map(key => countryMap[key]);
    const receipt = await geoRegistryContract.updateLevel2batch(web3.utils.asciiToHex(countryCode), keysBatch.map(web3.utils.asciiToHex), valuesBatch, { from });
    const gasCost = receipt.receipt.gasUsed;
    if (gasCost > mostExpensiveTrxGasCost) {
      mostExpensiveTrxGasCost = gasCost;
    }
    countryGasCost += gasCost;
    txCount += 1;
  }

  return { countryGasCost, mostExpensiveTrxGasCost, txCount, countryMap };
};

module.exports = {
  addCountry,
};
