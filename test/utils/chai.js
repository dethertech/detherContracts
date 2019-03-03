const chai = require('chai');
const Web3 = require('web3');

const web3 = new Web3(Web3.givenProvider);

chai.use(require('chai-bn')(web3.utils.BN));
chai.use(require('chai-as-promised'));

const { expect } = chai;

module.exports = expect;
