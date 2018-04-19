/* global web3, assert */

exports.expectThrow = async (promise) => {
  try {
    await promise;
  } catch (error) {
    const invalidJump = error.message.search('invalid JUMP') >= 0;
    const invalidOpcode = error.message.search('invalid opcode') >= 0;
    const outOfGas = error.message.search('out of gas') >= 0;
    const revert = error.message.search('revert') >= 0;
    assert(invalidJump || invalidOpcode || outOfGas || revert, `Expected throw, got '${error}' instead`);
    return;
  }
  assert.fail('Expected throw not received');
};

exports.waitForMined = tx => new Promise((resolve, reject) => {
  const setIntervalId = setInterval(() => {
    web3.eth.getTransactionReceipt(tx, (err, receipt) => {
      if (err) return reject(err.message);
      if (receipt) {
        clearInterval(setIntervalId);
        return resolve(receipt);
      }
      return null;
    });
  }, 1000);
});

exports.hexEncode = (str) => {
  let result = '';
  for (let i = 0; i < str.length; i += 1) {
    const hex = str.charCodeAt(i).toString(16);
    result += `${hex}`.slice(-4);
  }
  return `0x${result}`;
};

exports.toNBytes = (str, n) => {
  let buffer = '';
  for (let i = 0; i < n; i += 1) {
    buffer += str[i] ? str[i].charCodeAt(0).toString(16) : '00';
  }
  return buffer;
};

const convertBaseFn = (baseFrom, baseTo) => num => (
  parseInt(num, baseFrom).toString(baseTo)
);

const convertBase = {
  bin2dec: convertBaseFn(2, 10),
  bin2hex: convertBaseFn(2, 16),
  dec2bin: convertBaseFn(10, 2),
  dec2hex: convertBaseFn(10, 16),
  hex2bin: convertBaseFn(16, 2),
  hex2dec: convertBaseFn(16, 10),
};

exports.intTo5bytes = (intVal) => {
  const isNegative = intVal < 0;

  if (isNegative) intVal *= -1; // eslint-disable-line no-param-reassign

  const hexVal = convertBase.dec2hex(intVal);

  let result = hexVal;

  for (let i = 0; i + hexVal.length < 8; i += 1) {
    result = `0${result}`;
  }

  // if negative prepend with 01
  // if positive prepend with 00
  return isNegative ? `01${result}` : `00${result}`;
};

exports.intTo2bytes = (intVal) => {
  const hexVal = convertBase.dec2hex(intVal);

  let result = hexVal;

  for (let i = 0; i + hexVal.length < 4; i += 1) {
    result = `0${result}`;
  }

  return result;
};

exports.intTobytes = (intVal) => {
  const hexVal = convertBase.dec2hex(intVal);

  let result = hexVal;

  for (let i = 0; i + hexVal.length < 2; i += 1) {
    result = `0${result}`;
  }

  return result;
};

exports.toAsciiStripZero = str => (
  web3.toAscii(str).replace(/\0/g, '')
);

exports.weiToEth = bnNum => (
  web3.fromWei(bnNum, 'ether')
);

exports.ethToWei = num => (
  web3.toWei(num, 'ether')
);
