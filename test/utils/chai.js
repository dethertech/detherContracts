const chai = require('chai');
chai.use(require('chai-bignumber')());
chai.use(require('chai-as-promised')); // eslint-disable-line
const { expect } = chai;

module.exports = expect;
