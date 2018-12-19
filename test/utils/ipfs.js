const Web3 = require('web3');
const web3 = new Web3();

const getRandomBytes32 = () => (
  web3.utils.randomHex(32)
);

module.exports = {
  getRandomBytes32,
};
