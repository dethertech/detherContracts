const Web3 = require("web3");

const web3 = new Web3();

const toBN = val => web3.utils.toBN(val);
const ethToWei = eth => web3.utils.toWei(eth.toString(), "ether");
const weiToEth = eth => web3.utils.fromWei(eth, "ether");
const asciiToHex = ascii => web3.utils.asciiToHex(ascii);
const remove0x = txt => (txt.startsWith("0x") ? txt.slice(2) : txt); // eslint-disable-line
const str = val => val.toString();

module.exports = {
  toBN,
  ethToWei,
  asciiToHex,
  remove0x,
  str,
  weiToEth
};
