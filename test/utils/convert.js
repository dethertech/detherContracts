const Web3 = require('web3');

const web3 = new Web3();

const ethToWei = eth => web3.utils.toWei(eth.toString(), 'ether');
const asciiToHex = ascii => web3.utils.asciiToHex(ascii);
const remove0x = txt => txt.startsWith('0x') ? txt.slice(2) : txt; // eslint-disable-line

module.exports = {
  ethToWei,
  asciiToHex,
  remove0x,
};
