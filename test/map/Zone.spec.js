/* eslint-env mocha */
/* global artifacts, contract, web3, assert, expect */
/* eslint-disable max-len, no-multi-spaces */

const DetherToken = artifacts.require('DetherToken.sol');
// console.log({ DetherToken });
const ZoneFactory = artifacts.require('ZoneFactory.sol');
const Zone = artifacts.require('Zone.sol');

const Web3 = require('web3');

const { getAccounts } = require('../utils');

const web3 = new Web3('http://localhost:8545');

const BYTES7_ZERO = '00000000000000';
const BYTES32_ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000';
const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';
const ADDRESS_BURN = '0xffffffffffffffffffffffffffffffffffffffff';

const MIN_ZONE_DTH_STAKE = 100;
const VALID_GEOHASH = web3.utils.asciiToHex('kr0ttse');

const forgeErrorMessage = str => `VM Exception while processing transaction: revert ${str}`;
const wei = num => web3.utils.toWei(num.toString(), 'ether');

const evmSend = (method, params = []) => new Promise((resolve, reject) => {
  // NOTE: why is this not yet a promise, we're using web3 v1.0?
  web3.currentProvider.send({ id: '2.0', method, params }, (e, d) => (
    e ? reject(e) : resolve(d)
  ));
});

const ONE_HOUR = 60 * 60;
const ONE_DAY = ONE_HOUR * 24;
const BID_PERIOD = ONE_DAY;
const COOLDOWN_PERIOD = ONE_DAY * 2;

const timeTravel = async (seconds) => {
  await evmSend('evm_increaseTime', [seconds]);
  await evmSend('evm_mine');
};

const saveState = async () => new Promise((resolve, reject) => {
  web3.currentProvider.send({
    jsonrpc: '2.0',
    method: 'evm_snapshot',
    id: 0,
  }, (e, d) => (
    e ? reject(e) : resolve(d)
  ));
});

const revertState = async id => new Promise((resolve, reject) => {
  web3.currentProvider.send({
    jsonrpc: '2.0',
    method: 'evm_revert',
    params: [id],
    id: 0,
  }, (e, d) => (
    e ? reject(e) : resolve(d)
  ));
});

const getLastBlockTimestamp = () => (
  web3.eth.getBlock('latest').then(b => b.timestamp)
);

contract('Zone', () => {
  let owner;
  let user1;
  let user2;
  let user3;


  let ROOT_STATE;
  let ROOT_TIME;

  // let zoneInstance;
  let dthInstance;
  let zoneFactoryInstance;

  before(async () => {
    ROOT_STATE = await saveState();
    ROOT_TIME = await getLastBlockTimestamp();
    ([owner, user1, user2, user3] = await getAccounts());
  });

  beforeEach(async () => {
    await revertState(ROOT_STATE); // to go back to real time
    dthInstance = await DetherToken.new({ from: owner });
    zoneFactoryInstance = await ZoneFactory.new(dthInstance.address, { from: owner });
    // await dthInstance.mint(user1, wei(1000), { from: owner });
  });

  describe('deploying a Zone', () => {
    describe('constructor(bytes7 _geohash, address _zoneOwner, uint _dthAmount, address _dth)', () => {
      it('[error] deploying a zone with geohash 0x0', async () => {
        try {
          await Zone.new(BYTES7_ZERO, user1, wei(MIN_ZONE_DTH_STAKE), dthInstance.address, { from: user1 });
        } catch (err) {
          expect(err.message).to.equal(forgeErrorMessage('geohash cannot be 0x0'));
          return;
        }
        throw new Error('should have thrown');
      });
      it('[error] deploying a zone with zoneOwner 0x0', async () => {
        try {
          await Zone.new(VALID_GEOHASH, ADDRESS_ZERO, wei(MIN_ZONE_DTH_STAKE), dthInstance.address, { from: user1 });
        } catch (err) {
          expect(err.message).to.equal(forgeErrorMessage('zoneOwner cannot be 0x0'));
          return;
        }
        throw new Error('should have thrown');
      });
      it(`[error] deploying a zone with dthAmount minimum - 1 (${MIN_ZONE_DTH_STAKE - 1} DTH)`, async () => {
        try {
          await Zone.new(VALID_GEOHASH, user1, wei(MIN_ZONE_DTH_STAKE - 1), dthInstance.address, { from: user1 });
        } catch (err) {
          expect(err.message).to.equal(forgeErrorMessage('zone dth stake shoulld be at least minimum (100DTH)'));
          return;
        }
        throw new Error('should have thrown');
      });
      it(`[success] deploying a zone with dthAmount minimum (${MIN_ZONE_DTH_STAKE} DTH)`, async () => {
        const newZone = await Zone.new(VALID_GEOHASH, user1, wei(MIN_ZONE_DTH_STAKE), dthInstance.address, { from: user1 });
        expect(newZone);
      });
      it(`[success] deploying a zone with dthAmount minimum + 1 (${MIN_ZONE_DTH_STAKE + 1} DTH)`, async () => {
        const newZone = await Zone.new(VALID_GEOHASH, user1, wei(MIN_ZONE_DTH_STAKE + 1), dthInstance.address, { from: user1 });
        expect(newZone);
      });
    });
    describe('ZoneFactory.createAndClaim(bytes7 _geohash, uint _dthAmount)', () => {
      it('[error] creating a zone with geohash 0x0', async () => {
        await dthInstance.mint(user1, wei(1000), { from: owner });
        await dthInstance.approve(zoneFactoryInstance.address, wei(1000), { from: user1 });
        try {
          await zoneFactoryInstance.createAndClaim(BYTES7_ZERO, wei(MIN_ZONE_DTH_STAKE), { from: user1 });
        } catch (err) {
          expect(err.message).to.equal(forgeErrorMessage('geohash cannot be 0x0'));
          return;
        }
        throw new Error('should have thrown');
      });
      it(`[error] creating a zone with dthAmount minimum - 1 (${MIN_ZONE_DTH_STAKE - 1} DTH)`, async () => {
        await dthInstance.mint(user1, wei(1000), { from: owner });
        await dthInstance.approve(zoneFactoryInstance.address, wei(1000), { from: user1 });
        try {
          await zoneFactoryInstance.createAndClaim(VALID_GEOHASH, wei(MIN_ZONE_DTH_STAKE - 1), { from: user1 });
        } catch (err) {
          expect(err.message).to.equal(forgeErrorMessage('zone dth stake shoulld be at least minimum (100DTH)'));
          return;
        }
        throw new Error('should have thrown');
      });
      it(`[success] deploying a zone with dthAmount minimum (${MIN_ZONE_DTH_STAKE} DTH)`, async () => {
        await dthInstance.mint(user1, wei(1000), { from: owner });
        await dthInstance.approve(zoneFactoryInstance.address, wei(1000), { from: user1 });
        const newZone = await zoneFactoryInstance.createAndClaim(VALID_GEOHASH, wei(MIN_ZONE_DTH_STAKE), { from: user1 });
        expect(newZone);
      });
      it(`[success] deploying a zone with dthAmount minimum + 1 (${MIN_ZONE_DTH_STAKE + 1} DTH)`, async () => {
        await dthInstance.mint(user1, wei(1000), { from: owner });
        await dthInstance.approve(zoneFactoryInstance.address, wei(1000), { from: user1 });
        const newZone = await zoneFactoryInstance.createAndClaim(VALID_GEOHASH, wei(MIN_ZONE_DTH_STAKE + 1), { from: user1 });
        expect(newZone);
      });
      it('[error] creating a zone but no ZoneFactory allowance set', async () => {
        try {
          await zoneFactoryInstance.createAndClaim(VALID_GEOHASH, wei(MIN_ZONE_DTH_STAKE), { from: user1 });
        } catch (err) {
          expect(err.message).to.equal(forgeErrorMessage('zone factory dth allowance not high enough'));
          return;
        }
        throw new Error('should have thrown');
      });
    });
  });

  describe('when Zone exists', () => {
    let zoneInstance;
    let zoneOwner;
    let bidder1;
    let bidder2;

    beforeEach(async () => {
      zoneOwner = user1;
      bidder1 = user2;
      bidder2 = user3;

      // create a zone with a zone owner
      await dthInstance.mint(zoneOwner, wei(1000), { from: owner });
      await dthInstance.approve(zoneFactoryInstance.address, wei(1000), { from: zoneOwner });

      const tx = await zoneFactoryInstance.createAndClaim(VALID_GEOHASH, wei(MIN_ZONE_DTH_STAKE), { from: zoneOwner });
      zoneInstance = await Zone.at(tx.logs[0].args.zoneAddress);

      await dthInstance.mint(bidder1, wei(1000), { from: owner });
      await dthInstance.mint(bidder2, wei(1000), { from: owner });
    });

    describe('getLastAuction() external view returns (uint, uint, uint, uint, address, uint, bool)', () => {
      it('[success]', async () => {
        const auction = await zoneInstance.getLastAuction();
        // console.log({
        //   id: auction[0].toNumber(),
        //   state: auction[1].toNumber(),
        // beginTime: auction[2].toNumber(),
        // endTime: auction[3].toNumber(),
        // currentTime: Math.floor(Date.now() / 1000),
        // xyz: Math.floor(Date.now() / 1000) > auction[3].toNumber(),
        //   highestBidder: auction[4],
        //   totalBids: auction[5].toNumber(),
        //   processed: auction[6],
        // });
        expect(auction[0].toNumber()).to.equal(0);        // id
        expect(auction[1].toNumber()).to.equal(1);        // state
        expect(auction[2].eq(auction[3])).to.equal(true); // startTime endTime
        expect(auction[4]).to.equal(zoneOwner);           // highestBidder
        expect(auction[5].toNumber()).to.equal(0);        // totalBids
        expect(auction[6].toNumber()).to.equal(1);        // numBidders
        expect(auction[7]).to.equal(true);                // processed
      });
    });
    describe('bid(uint _dthAmount)', () => {
      describe('when this is first auction', () => {
        it('[error] zone currently has no owner', async () => {
          // await dthInstance.approve(zoneInstance, wei(1000), { from: bidder1 });
          // TODO: when release() is implemented
          return Promise.resolve();
        });
        it('[error] zone has not enough dth allowance from sender(=bidder1)', async () => {
          await timeTravel(COOLDOWN_PERIOD);
          try {
            await zoneInstance.bid(wei(MIN_ZONE_DTH_STAKE + 10), { from: bidder1 });
          } catch (err) {
            expect(err.message).to.equal(forgeErrorMessage('zone does not have high enough dth balance from sender'));
            return;
          }
          throw new Error('should have thrown because caller already is highest bidder');
        });

        describe('when last auction is still active', () => {
          beforeEach(async () => {
            await timeTravel(COOLDOWN_PERIOD + ONE_HOUR);

            await dthInstance.approve(zoneInstance.address, wei(1000), { from: zoneOwner });
            await dthInstance.approve(zoneInstance.address, wei(1000), { from: bidder1 });

            // place a bid from bidder1 such that a new auction is created
            await zoneInstance.bid(wei(MIN_ZONE_DTH_STAKE + 20), { from: bidder1 }); // 120
          });
          it('[error] highestBidder cannot bid', async () => {
            try {
              await zoneInstance.bid(wei(MIN_ZONE_DTH_STAKE + 30), { from: bidder1 }); // 130
            } catch (err) {
              expect(err.message).to.equal(forgeErrorMessage('caller cannot already be highest bidder'));
              return;
            }
            throw new Error('should have thrown');
          });
          describe('when caller is zoneOwner', () => {
            describe('when this is first counter bid', () => {
              it('[error] bid amount + already staked is less than current highest bid', async () => {
                try {
                  // 100 + 10 = 110, highestBidder = 120
                  await zoneInstance.bid(wei(10), { from: zoneOwner }); // 110
                } catch (err) {
                  expect(err.message).to.equal(forgeErrorMessage('bid + already staked is not higher than current highest'));
                  return;
                }
                throw new Error('should have thrown');
              });
              it('[error] bid amount + already staked is more than current highest bid', async () => {
                // 100 + 30 = 130, highestBidder = 120
                await zoneInstance.bid(wei(30), { from: zoneOwner });
              });
            });
            describe('when this is not the first counter bid', () => {
              beforeEach(async () => {
                await zoneInstance.bid(wei(30), { from: zoneOwner }); // 100 + 30 = 130
                await zoneInstance.bid(wei(20), { from: bidder1 }); // 120 + 20 = 140
              });
              it('[error] bid amount + already staked is less than current highest bid', async () => {
                try {
                  await zoneInstance.bid(wei(5), { from: zoneOwner }); // 135
                } catch (err) {
                  expect(err.message).to.equal(forgeErrorMessage('bid is not higher than current highest'));
                  return;
                }
                throw new Error('should have thrown');
              });
              it('[error] bid amount + already staked is more than current highest bid', async () => {
                await zoneInstance.bid(wei(20), { from: zoneOwner }); // 150
              });
            });
          });
        });
        describe('when last auction has ended', () => {
          beforeEach(async () => {
            await dthInstance.approve(zoneInstance.address, wei(1000), { from: zoneOwner });
            await dthInstance.approve(zoneInstance.address, wei(1000), { from: bidder1 });
          });
          it('[error] cooldown period has not yet ended', async () => {
            try {
              await zoneInstance.bid(wei(MIN_ZONE_DTH_STAKE + 10), { from: bidder1 });
            } catch (err) {
              expect(err.message).to.equal(forgeErrorMessage('cooldown period hasnt ended yet, cannot start new auction'));
              return;
            }
            throw new Error('should have thrown');
          });
          it('[error] zoneOwner cannot start auction', async () => {
            await timeTravel(COOLDOWN_PERIOD + ONE_HOUR);
            try {
              await zoneInstance.bid(wei(10), { from: zoneOwner });
            } catch (err) {
              expect(err.message).to.equal(forgeErrorMessage('zoneowner cannot start an auction'));
              return;
            }
            throw new Error('should have thrown');
          });
          it('[error] bid is less than current zone stake', async () => {
            await timeTravel(COOLDOWN_PERIOD + ONE_HOUR);
            try {
              await zoneInstance.bid(wei(MIN_ZONE_DTH_STAKE - 10), { from: bidder1 });
            } catch (err) {
              expect(err.message).to.equal(forgeErrorMessage('bid needs to be higher than current zoneowner stake'));
              return;
            }
            throw new Error('should have thrown');
          });
        });
      });
      describe('when this is not the first auction', () => {
        it('[error] zone currently has no owner', async () => {
          // await dthInstance.approve(zoneInstance, wei(1000), { from: bidder1 });
          // TODO: when release() is implemented
          return Promise.resolve();
        });
        it('[error] zone has not enough dth allowance from sender(=bidder1)', async () => {
          await timeTravel(COOLDOWN_PERIOD);
          try {
            await zoneInstance.bid(wei(MIN_ZONE_DTH_STAKE + 10), { from: bidder1 });
          } catch (err) {
            expect(err.message).to.equal(forgeErrorMessage('zone does not have high enough dth balance from sender'));
            return;
          }
          throw new Error('should have thrown because caller already is highest bidder');
        });

        describe('when last auction is still active', () => {
          beforeEach(async () => {
            await timeTravel(COOLDOWN_PERIOD + ONE_HOUR);

            await dthInstance.approve(zoneInstance.address, wei(1000), { from: zoneOwner });
            await dthInstance.approve(zoneInstance.address, wei(1000), { from: bidder1 });

            // place a bid from bidder1 such that a new auction is created
            await zoneInstance.bid(wei(MIN_ZONE_DTH_STAKE + 20), { from: bidder1 }); // 120
          });
          it('[error] highestBidder cannot bid', async () => {
            try {
              await zoneInstance.bid(wei(MIN_ZONE_DTH_STAKE + 30), { from: bidder1 }); // 130
            } catch (err) {
              expect(err.message).to.equal(forgeErrorMessage('caller cannot already be highest bidder'));
              return;
            }
            throw new Error('should have thrown');
          });
          describe('when caller is zoneOwner', () => {
            describe('when this is first counter bid', () => {
              it('[error] bid amount + already staked is less than current highest bid', async () => {
                try {
                  // 100 + 10 = 110, highestBidder = 120
                  await zoneInstance.bid(wei(10), { from: zoneOwner }); // 110
                } catch (err) {
                  expect(err.message).to.equal(forgeErrorMessage('bid + already staked is not higher than current highest'));
                  return;
                }
                throw new Error('should have thrown');
              });
              it('[error] bid amount + already staked is more than current highest bid', async () => {
                // 100 + 30 = 130, highestBidder = 120
                await zoneInstance.bid(wei(30), { from: zoneOwner });
              });
            });
            describe('when this is not the first counter bid', () => {
              beforeEach(async () => {
                await zoneInstance.bid(wei(30), { from: zoneOwner }); // 100 + 30 = 130
                await zoneInstance.bid(wei(20), { from: bidder1 }); // 120 + 20 = 140
              });
              it('[error] bid amount + already staked is less than current highest bid', async () => {
                try {
                  await zoneInstance.bid(wei(5), { from: zoneOwner }); // 135
                } catch (err) {
                  expect(err.message).to.equal(forgeErrorMessage('bid is not higher than current highest'));
                  return;
                }
                throw new Error('should have thrown');
              });
              it('[error] bid amount + already staked is more than current highest bid', async () => {
                await zoneInstance.bid(wei(20), { from: zoneOwner }); // 150
              });
            });
          });
        });
        describe('when last auction has ended', () => {
          beforeEach(async () => {
            await dthInstance.approve(zoneInstance.address, wei(1000), { from: zoneOwner });
            await dthInstance.approve(zoneInstance.address, wei(1000), { from: bidder1 });
          });
          it('[error] cooldown period has not yet ended', async () => {
            try {
              await zoneInstance.bid(wei(MIN_ZONE_DTH_STAKE + 10), { from: bidder1 });
            } catch (err) {
              expect(err.message).to.equal(forgeErrorMessage('cooldown period hasnt ended yet, cannot start new auction'));
              return;
            }
            throw new Error('should have thrown');
          });
          it('[error] zoneOwner cannot start auction', async () => {
            await timeTravel(COOLDOWN_PERIOD + ONE_HOUR);
            try {
              await zoneInstance.bid(wei(10), { from: zoneOwner });
            } catch (err) {
              expect(err.message).to.equal(forgeErrorMessage('zoneowner cannot start an auction'));
              return;
            }
            throw new Error('should have thrown');
          });
          it('[error] bid is less than current zone stake', async () => {
            await timeTravel(COOLDOWN_PERIOD + ONE_HOUR);
            try {
              await zoneInstance.bid(wei(MIN_ZONE_DTH_STAKE - 10), { from: bidder1 });
            } catch (err) {
              expect(err.message).to.equal(forgeErrorMessage('bid needs to be higher than current zoneowner stake'));
              return;
            }
            throw new Error('should have thrown');
          });
        });
      });
    });
  });
});