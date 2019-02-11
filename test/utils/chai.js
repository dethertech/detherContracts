const chai = require('chai');
const web3 = require('web3');
chai.use(require('chai-bn')(web3.utils.BN));
// chai.use(require('chai-bignumber')());

chai.use(require('chai-as-promised')); // eslint-disable-line
const { expect } = chai;

module.exports = expect;
