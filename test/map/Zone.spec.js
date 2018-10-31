/* eslint-env mocha */
/* global artifacts, contract, web3, assert, expect */
/* eslint-disable max-len */

const Zone = artifacts.require('Zone.sol');

const web3 = require('web3');
const { getAccounts } = require('../utils');

const MIN_ZONE_DTH_STAKE = 100;

contract('Zone', () => {
  let owner;
  let user1;
  let user2;

  let zone;

  before(async () => {
    ([owner, user1, user2] = await getAccounts());
  });

  beforeEach(async () => {
    zone = await Zone.new({ from: owner });
  });

  describe('zone does not yet exist', () => {

  });

  describe('zone already exists', () => {
    describe('zone currently has no zone owner', () => {

    });
    describe('zone currently has a zone owner', () => {
      describe('zone is not in auction modus currently', () => {

      });
      describe('zone is currently in auction modus', () => {

      });
    });
  });
});
