/* eslint-env mocha */
/* global artifacts, contract, web3, assert, expect */
/* eslint-disable max-len */


const DetherToken = artifacts.require('DetherToken.sol');
const GeoRegistry = artifacts.require('GeoRegistry.sol');
const ZoneFactory = artifacts.require('ZoneFactory.sol');
const Dether = artifacts.require('Dether.sol');

const web3 = require('web3');
const { getAccounts } = require('../utils');

const MIN_ZONE_DTH_STAKE = 100;

contract('ZoneFactory', () => {
  let owner;
  let user1;
  let user2;

  let zoneFactory;

  before(async () => {
    ([owner, user1, user2] = await getAccounts());
  });

  beforeEach(async () => {
    zoneFactory = await ZoneFactory.new({ from: owner });
  });

  describe('setters', () => {
    describe('function bidForZone(address _from, bytes7 _geohash, uint _dthStake) external onlyOwner returns (address)', () => {
      it('[error] called by not-the-owner', async () => {
        try {
          await zoneFactory.bidForZone(
            user2,
            web3.utils.asciiToHex('kr4zes8'),
            web3.utils.toWei(MIN_ZONE_DTH_STAKE),
            { from: user1 },
          );
        } catch (err) {
          return;
        }
        throw new Error('expected revert');
      });
      it(`[error] _dthStake less than minimum (${MIN_ZONE_DTH_STAKE} DTH)`, async () => {
        try {
          await zoneFactory.bidForZone(
            user2,
            web3.utils.asciiToHex('kr4zes8'),
            web3.utils.toWei(MIN_ZONE_DTH_STAKE - 1),
            { from: owner },
          );
        } catch (err) {
          return;
        }
        throw new Error('expected revert');
      });
      it(`[success] called from owner and _dthStake == minimum (${MIN_ZONE_DTH_STAKE} DTH)`, async () => {
        await zoneFactory.bidForZone(
          user2,
          web3.utils.asciiToHex('kr4zes8'),
          web3.utils.toWei(MIN_ZONE_DTH_STAKE),
          { from: owner },
        );
      });
      it(`[success] called from owner and _dthStake > minimum (${MIN_ZONE_DTH_STAKE} DTH)`, async () => {
        await zoneFactory.bidForZone(
          user2,
          web3.utils.asciiToHex('kr4zes8'),
          web3.utils.toWei(MIN_ZONE_DTH_STAKE + 1),
          { from: owner },
        );
      });
    });
  });
  describe('getters', () => {
    describe('function zoneExists(bytes7 _geohash) public view returns (bool)', () => {
      it('returns true if zone exists (meaning contract has been deployed for this zone)', async () => {
        // creates a new zone (deploys zone contract)
        await zoneFactory.bidForZone(
          user2,
          web3.utils.asciiToHex('kr4zes8'),
          web3.utils.toWei(MIN_ZONE_DTH_STAKE),
          { from: owner },
        );

        const result = await zoneFactory.zoneExists(web3.utils.asciiToHex('kr4zes8'));

        expect(result).to.equal(true);
      });
      it('returns false if zone does not exist (meaning no contract has yet been deployed for this zone)', async () => {
        const result = await zoneFactory.zoneExists(web3.utils.asciiToHex('kr4zes8'));

        expect(result).to.equal(false);
      });
    });
  });
});
