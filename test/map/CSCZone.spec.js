/* eslint-env mocha */
/* global artifacts, contract, web3, assert */
/* eslint-disable max-len */

const { getAccounts } = require('../utils');

const CSCZone = artifacts.require('CSCZone.sol');

contract('CSCZone', () => {
  let owner;
  let user1;

  before(async () => {
    ([owner, user1] = await getAccounts());
  });

  it('correctly initializes CSC contract', async () => {
    const geohash = web3.fromAscii('kr4zes8'); // zone in Congo Brazzaville
    // cscZoneContractOwner should be the auction contract, but owner for the moment
    // user1 is the zoneOwner and this CSC contract reprensent where he can operate
    // and contains some conditions (and could be extended )
    // A CSCZone simply an identifier which represent a zone + the contract of the zone
    const cscZoneContract = await CSCZone.new(geohash, user1, owner, { from: owner });

    const onchainGeohash = await cscZoneContract.geohash();
    assert.equal(onchainGeohash, geohash, 'stored geohash does not match expected');

    const onchainCsc = await cscZoneContract.csc();
    const computedCsc = await cscZoneContract.computeCSC(geohash, cscZoneContract.address);
    assert.equal(onchainCsc, computedCsc, 'stored csc does not match computed csc');

    const onchainDelegated = await cscZoneContract.delegated();
    assert.equal(onchainDelegated, false, 'delegated should be false');

    const onchainZoneOwner = await cscZoneContract.zoneOwner();
    assert.equal(onchainZoneOwner, user1, 'zone owner should be address(user1)');

    const onchainCscZoneContractOwner = await cscZoneContract.cscZoneContractOwner();
    assert.equal(onchainCscZoneContractOwner, owner, 'csc zone contract owner should be set to address(owner)');
  });
});
