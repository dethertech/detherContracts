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

const expectRevert = async (fn, errMsg) => {
  try {
    await fn;
  } catch (err) {
    expect(err.message).to.equal(forgeErrorMessage(errMsg));
    return;
  }
  throw new Error('should have thrown');
};

contract.only('ZoneFactory + Zone', () => {
  let owner;
  let user1;
  let user2;
  let user3;


  let ROOT_STATE;
  // let ROOT_TIME;

  // let zoneInstance;
  let dthInstance;
  let zoneFactoryInstance;

  before(async () => {
    ROOT_STATE = await saveState();
    // ROOT_TIME = await getLastBlockTimestamp();
    ([owner, user1, user2, user3] = await getAccounts());
  });

  beforeEach(async () => {
    await revertState(ROOT_STATE); // to go back to real time
    dthInstance = await DetherToken.new({ from: owner });
    zoneFactoryInstance = await ZoneFactory.new(dthInstance.address, { from: owner });
    // await dthInstance.mint(user1, wei(1000), { from: owner });
  });

  describe('deploying a Zone', () => {
    describe('Zone.constructor(bytes7 _geohash, address _user1, uint _dthAmount, address _dth)', () => {
      it('[error] deploying a zone with geohash 0x0', async () => {
        await expectRevert(
          Zone.new(BYTES7_ZERO, user1, wei(MIN_ZONE_DTH_STAKE), dthInstance.address, { from: user1 }),
          'geohash cannot be 0x0',
        );
      });
      it('[error] deploying a zone with user1 0x0', async () => {
        await expectRevert(
          Zone.new(VALID_GEOHASH, ADDRESS_ZERO, wei(MIN_ZONE_DTH_STAKE), dthInstance.address, { from: user1 }),
          'zoneOwner cannot be 0x0',
        );
      });
      it(`[error] deploying a zone with dthAmount minimum - 1 (${MIN_ZONE_DTH_STAKE - 1} DTH)`, async () => {
        await expectRevert(
          Zone.new(VALID_GEOHASH, user1, wei(MIN_ZONE_DTH_STAKE - 1), dthInstance.address, { from: user1 }),
          'zone dth stake shoulld be at least minimum (100DTH)',
        );
      });
      describe(`when success deploying a zone with dthAmount minimum (${MIN_ZONE_DTH_STAKE} DTH)`, () => {
        let newZone;
        beforeEach(async () => {
          newZone = await Zone.new(VALID_GEOHASH, user1, wei(MIN_ZONE_DTH_STAKE), dthInstance.address, { from: user1 });
        });
        it('newZone.dth() equal DetherToken contract address', async () => {
          expect(await newZone.dth()).to.equal(dthInstance.address);
        });

        it('newZone.contract.geohash() equals the input geohash', async () => {
          expect(await newZone.geohash()).to.equal(VALID_GEOHASH);
        });

        it('newZone.currentAuction() equals zero', async () => {
          expect((await newZone.currentAuctionId()).toNumber()).to.equal(0);
        });

        it('newZone.getZoneOwner() returns correct @user1 data as zone owner', async () => {
          const zoneOwner = await newZone.getZoneOwner();
          expect(zoneOwner[0], 'zoneOwner.address does not equal @user1').to.equal(user1);
          expect(zoneOwner[2].toString(), 'zoneOwner.staked does not equal input dthAmount (without entry fee deduction) as staked dth amount').to.equal(wei(MIN_ZONE_DTH_STAKE));
        });

        it('newZone.auctionExists(0) should be true', async () => {
          const auctionExists = await newZone.auctionExists(0);
          expect(auctionExists, 'there should be an auction at id = 0').to.equal(true);
        });
        it('newZone.auctionExists(1) should be false', async () => {
          const auctionExists = await newZone.auctionExists(1);
          expect(auctionExists, 'there should be no auction at id = 1').to.equal(false);
        });

        it('newZone.getLastAuction() returns the correct "Sentinel" Auction created on deployment of Zone contract', async () => {
          const lastAuction = await newZone.getLastAuction();
          expect(lastAuction[0].toNumber(), 'lastAuction.id should be zero').to.equal(0);
          expect(lastAuction[1].toNumber(), 'lastAuction.state should equal Ended(=1)').to.equal(1);
          expect(lastAuction[2].toNumber(), 'lastAuction.endTime should be greater than 0').to.not.equal(0);
          expect(lastAuction[2].toNumber(), 'lastAuction.endTime should equal auction.startTime').to.equal(lastAuction[3].toNumber());
          expect(lastAuction[4], 'lastAuction.highestBidder should equal @user1').to.equal(user1);
          expect(lastAuction[5].toString(), 'lastAuction.totalBids sohuld equal input dth amount (without entry fee deduction)').to.equal(wei(MIN_ZONE_DTH_STAKE));
          expect(lastAuction[6].toNumber(), 'lastAuction.numBids should equal 1').to.equal(1);
          expect(lastAuction[7], 'lastAuction.processed should be true').to.equal(true);
        });

        it('newZone.getAuction(0) returns the correct "Sentinel" Auction created on deployment of Zone contract', async () => {
          const auction = await newZone.getAuction(0);
          expect(auction[0].toNumber(), 'auction.id should be zero').to.equal(0);
          expect(auction[1].toNumber(), 'auction.state should equal Ended(=1)').to.equal(1);
          expect(auction[2].toNumber(), 'auction.startTime should be greater than 0').to.not.equal(0);
          expect(auction[2].toNumber(), 'auction.endTime should be greater than 0').to.not.equal(0);
          expect(auction[2].toNumber(), 'auction.endTime should equal auction.startTime').to.equal(auction[3].toNumber());
          expect(auction[4], 'auction.highestBidder should equal @user1').to.equal(user1);
          expect(auction[5].toString(), 'auction.totalBids should equal input dth amount (without entry fee deduction)').to.equal(wei(MIN_ZONE_DTH_STAKE));
          expect(auction[6].toNumber(), 'auction.numBids should equal 1').to.equal(1);
          expect(auction[7], 'auction.processed should be true').to.equal(true);
        });

        // TODO: zoneowner[1] startTime
      });

      describe(`when success deploying a zone with dthAmount minimum + 1 (${MIN_ZONE_DTH_STAKE} DTH)`, () => {
        let newZone;
        beforeEach(async () => {
          newZone = await Zone.new(VALID_GEOHASH, user1, wei(MIN_ZONE_DTH_STAKE + 1), dthInstance.address, { from: user1 });
        });
        it('newZone.dth() equal DetherToken contract address', async () => {
          expect(await newZone.dth()).to.equal(dthInstance.address);
        });

        it('newZone.contract.geohash() equals the input geohash', async () => {
          expect(await newZone.geohash()).to.equal(VALID_GEOHASH);
        });

        it('newZone.currentAuction() equals zero', async () => {
          expect((await newZone.currentAuctionId()).toNumber()).to.equal(0);
        });

        it('newZone.getZoneOwner() returns correct @user1 data as zone owner', async () => {
          const zoneOwner = await newZone.getZoneOwner();
          expect(zoneOwner[0], 'zoneOwner.address does not equal @user1').to.equal(user1);
          expect(zoneOwner[2].toString(), 'zoneOwner.staked does not equal input dthAmount (without entry fee deduction) as staked dth amount').to.equal(wei(MIN_ZONE_DTH_STAKE + 1));
        });

        it('newZone.auctionExists(0) should be true', async () => {
          const auctionExists = await newZone.auctionExists(0);
          expect(auctionExists, 'there should be an auction at id = 0').to.equal(true);
        });
        it('newZone.auctionExists(1) should be false', async () => {
          const auctionExists = await newZone.auctionExists(1);
          expect(auctionExists, 'there should be no auction at id = 1').to.equal(false);
        });

        it('newZone.getLastAuction() returns the correct "Sentinel" Auction created on deployment of Zone contract', async () => {
          const lastAuction = await newZone.getLastAuction();
          expect(lastAuction[0].toNumber(), 'lastAuction.id should be zero').to.equal(0);
          expect(lastAuction[1].toNumber(), 'lastAuction.state should equal Ended(=1)').to.equal(1);
          expect(lastAuction[2].toNumber(), 'lastAuction.endTime should be greater than 0').to.not.equal(0);
          expect(lastAuction[2].toNumber(), 'lastAuction.endTime should equal auction.startTime').to.equal(lastAuction[3].toNumber());
          expect(lastAuction[4], 'lastAuction.highestBidder should equal @user1').to.equal(user1);
          expect(lastAuction[5].toString(), 'lastAuction.totalBids sohuld equal input dth amount (without entry fee deduction)').to.equal(wei(MIN_ZONE_DTH_STAKE + 1));
          expect(lastAuction[6].toNumber(), 'lastAuction.numBids should equal 1').to.equal(1);
          expect(lastAuction[7], 'lastAuction.processed should be true').to.equal(true);
        });

        it('newZone.getAuction(0) returns the correct "Sentinel" Auction created on deployment of Zone contract', async () => {
          const auction = await newZone.getAuction(0);
          expect(auction[0].toNumber(), 'auction.id should be zero').to.equal(0);
          expect(auction[1].toNumber(), 'auction.state should equal Ended(=1)').to.equal(1);
          expect(auction[2].toNumber(), 'auction.startTime should be greater than 0').to.not.equal(0);
          expect(auction[2].toNumber(), 'auction.endTime should be greater than 0').to.not.equal(0);
          expect(auction[2].toNumber(), 'auction.endTime should equal auction.startTime').to.equal(auction[3].toNumber());
          expect(auction[4], 'auction.highestBidder should equal @user1').to.equal(user1);
          expect(auction[5].toString(), 'auction.totalBids should equal input dth amount (without entry fee deduction)').to.equal(wei(MIN_ZONE_DTH_STAKE + 1));
          expect(auction[6].toNumber(), 'auction.numBids should equal 1').to.equal(1);
          expect(auction[7], 'auction.processed should be true').to.equal(true);
        });

        // TODO: zoneowner[1] startTime
      });
    });
    describe('ZoneFactory.createAndClaim(bytes7 _geohash, uint _dthAmount)', () => {
      it('[error] creating a zone with geohash 0x0', async () => {
        await dthInstance.mint(user1, wei(1000), { from: owner });
        await dthInstance.approve(zoneFactoryInstance.address, wei(1000), { from: user1 });
        await expectRevert(
          zoneFactoryInstance.createAndClaim(BYTES7_ZERO, wei(MIN_ZONE_DTH_STAKE), { from: user1 }),
          'geohash cannot be 0x0',
        );
      });
      it(`[error] creating a zone with dthAmount minimum - 1 (${MIN_ZONE_DTH_STAKE - 1} DTH)`, async () => {
        await dthInstance.mint(user1, wei(1000), { from: owner });
        await dthInstance.approve(zoneFactoryInstance.address, wei(1000), { from: user1 });
        await expectRevert(
          zoneFactoryInstance.createAndClaim(VALID_GEOHASH, wei(MIN_ZONE_DTH_STAKE - 1), { from: user1 }),
          'zone dth stake shoulld be at least minimum (100DTH)',
        );
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
        await expectRevert(
          zoneFactoryInstance.createAndClaim(VALID_GEOHASH, wei(MIN_ZONE_DTH_STAKE), { from: user1 }),
          'zone factory dth allowance not high enough',
        );
      });
    });
  });

  describe('<<< Setters >>>', () => {
    describe('Zone.bid(uint _dthAmount)', () => {
      describe('when Zone just got created (owned by @user1)', () => {
        let zoneInstance;

        beforeEach(async () => {
          // create a zone with a zone owner
          const bid = MIN_ZONE_DTH_STAKE;
          await dthInstance.mint(user1, wei(bid), { from: owner });
          await dthInstance.approve(zoneFactoryInstance.address, wei(bid), { from: user1 });

          const tx = await zoneFactoryInstance.createAndClaim(VALID_GEOHASH, wei(bid), { from: user1 });
          zoneInstance = await Zone.at(tx.logs[0].args.zoneAddress);
        });
        // it('[error] zone currently has no owner', async () => {
        //   // await dthInstance.approve(zoneInstance, wei(1000), { from: user2 });
        //   // TODO: when release() is implemented
        //   return Promise.resolve();
        // });
        it('@user2 (challenger1) -- [error] zone does not have enough dth allowance from sender', async () => {
          const bid = MIN_ZONE_DTH_STAKE + 10;
          await dthInstance.mint(user2, wei(bid), { from: owner });
          await dthInstance.approve(zoneInstance.address, wei(bid - 10), { from: user2 });
          await expectRevert(
            zoneInstance.bid(wei(bid), { from: user2 }),
            'zone does not have high enough dth allowance from sender',
          );
        });
        it('@user2 (challenger1) -- [error] sender has not enough dth', async () => {
          const bid = MIN_ZONE_DTH_STAKE + 10;
          await dthInstance.mint(user2, wei(bid - 10), { from: owner });
          await dthInstance.approve(zoneInstance.address, wei(bid), { from: user2 });
          await expectRevert(
            zoneInstance.bid(wei(bid), { from: user2 }),
            'sender does not have enough dth',
          );
        });
        it('@user1 (current zone owner) -- [error] zone owner cannot start auction', async () => {
          const bid = MIN_ZONE_DTH_STAKE + 10;
          await dthInstance.mint(user1, wei(bid), { from: owner });
          await dthInstance.approve(zoneInstance.address, wei(bid), { from: user1 });
          await expectRevert(
            zoneInstance.bid(wei(bid), { from: user1 }),
            'zoneowner cannot start an auction',
          );
        });
        it('@user2 (challenger1) -- [error] bid amount is less than current zone stake', async () => {
          const bid = MIN_ZONE_DTH_STAKE - 10;
          await dthInstance.mint(user2, wei(bid), { from: owner });
          await dthInstance.approve(zoneInstance.address, wei(bid), { from: user2 });
          await expectRevert(
            zoneInstance.bid(wei(bid), { from: user2 }),
            'bid needs to be higher than current zoneowner stake',
          );
        });
        it('@user2 (challenger1) -- [error] cooldown period has not yet ended', async () => {
          const bid = MIN_ZONE_DTH_STAKE + 10;
          await dthInstance.mint(user2, wei(bid), { from: owner });
          await dthInstance.approve(zoneInstance.address, wei(bid), { from: user2 });
          await expectRevert(
            zoneInstance.bid(wei(bid), { from: user2 }),
            'cooldown period hasnt ended yet, cannot start new auction',
          );
        });
        describe('when Zone cooldown period ended', () => {
          beforeEach(async () => {
            await timeTravel(COOLDOWN_PERIOD + ONE_HOUR);
          });
          it('@user2 (challenger1) -- [error] zone does not have enough dth allowance from sender', async () => {
            const bid = MIN_ZONE_DTH_STAKE + 10;
            await dthInstance.mint(user2, wei(bid), { from: owner });
            await dthInstance.approve(zoneInstance.address, wei(bid - 10), { from: user2 });
            await expectRevert(
              zoneInstance.bid(wei(bid), { from: user2 }),
              'zone does not have high enough dth allowance from sender',
            );
          });
          it('@user2 (challenger1) -- [error] sender has not enough dth', async () => {
            const bid = MIN_ZONE_DTH_STAKE + 10;
            await dthInstance.mint(user2, wei(bid - 10), { from: owner });
            await dthInstance.approve(zoneInstance.address, wei(bid), { from: user2 });
            await expectRevert(
              zoneInstance.bid(wei(bid), { from: user2 }),
              'sender does not have enough dth',
            );
          });
          it('@user1 (current zone owner) -- [error] current zone owner cannot start auction', async () => {
            const bid = 10;
            await dthInstance.mint(user1, wei(bid), { from: owner });
            await dthInstance.approve(zoneInstance.address, wei(bid), { from: user1 });
            await expectRevert(
              zoneInstance.bid(wei(bid), { from: user1 }),
              'zoneowner cannot start an auction',
            );
          });
          it('@user2 (challenger1) -- [error] bid amount is less than current zone stake', async () => {
            const bid = MIN_ZONE_DTH_STAKE - 10;
            await dthInstance.mint(user2, wei(bid), { from: owner });
            await dthInstance.approve(zoneInstance.address, wei(bid), { from: user2 });
            await expectRevert(
              zoneInstance.bid(wei(bid), { from: user2 }),
              'bid needs to be higher than current zoneowner stake',
            );
          });
          it('@user2 (challenger1) -- [success]', async () => {
            const bid = MIN_ZONE_DTH_STAKE + 10;
            await dthInstance.mint(user2, wei(bid), { from: owner });
            await dthInstance.approve(zoneInstance.address, wei(bid), { from: user2 });
            await zoneInstance.bid(wei(bid), { from: user2 });
          });
          describe('when @user2 (challenger1) started an Auction for this Zone', () => {
            beforeEach(async () => {
              const bid = MIN_ZONE_DTH_STAKE + 10;
              await dthInstance.mint(user2, wei(bid), { from: owner });
              await dthInstance.approve(zoneInstance.address, wei(bid), { from: user2 });
              await zoneInstance.bid(wei(bid), { from: user2 });
            });
            it('@user1 (current zone owner) -- [error] zone does not have enough dth allowance from bidder', async () => {
              const bid = 20;
              await dthInstance.mint(user1, wei(bid), { from: owner });
              await dthInstance.approve(zoneInstance.address, wei(bid - 10), { from: user1 });
              await expectRevert(
                zoneInstance.bid(wei(bid), { from: user1 }),
                'zone does not have high enough dth allowance from sender',
              );
            });
            it('@user2 (challenger1) -- [error] zone does not have enough dth allowance from bidder', async () => {
              const bid = MIN_ZONE_DTH_STAKE + 20;
              await dthInstance.mint(user2, wei(bid), { from: owner });
              await dthInstance.approve(zoneInstance.address, wei(bid - 10), { from: user2 });
              await expectRevert(
                zoneInstance.bid(wei(bid), { from: user2 }),
                'zone does not have high enough dth allowance from sender',
              );
            });
            it('@user3 (challenger2) -- [error] zone does not have enough dth allowance from bidder', async () => {
              const bid = MIN_ZONE_DTH_STAKE + 20;
              await dthInstance.mint(user3, wei(bid), { from: owner });
              await dthInstance.approve(zoneInstance.address, wei(bid - 10), { from: user3 });
              await expectRevert(
                zoneInstance.bid(wei(bid), { from: user3 }),
                'zone does not have high enough dth allowance from sender',
              );
            });
            it('@user1 (current zone owner) -- [error] bidder has not enough dth', async () => {
              const bid = 20;
              await dthInstance.mint(user1, wei(bid - 10), { from: owner });
              await dthInstance.approve(zoneInstance.address, wei(bid), { from: user1 });
              await expectRevert(
                zoneInstance.bid(wei(bid), { from: user1 }),
                'sender does not have enough dth',
              );
            });
            it('@user2 (challenger1) -- [error] bidder has not enough dth', async () => {
              const bid = MIN_ZONE_DTH_STAKE + 20;
              await dthInstance.mint(user2, wei(bid - 10), { from: owner });
              await dthInstance.approve(zoneInstance.address, wei(bid), { from: user2 });
              await expectRevert(
                zoneInstance.bid(wei(bid), { from: user2 }),
                'sender does not have enough dth',
              );
            });
            it('@user3 (challeneger2) -- [error] bidder has not enough dth', async () => {
              const bid = MIN_ZONE_DTH_STAKE + 20;
              await dthInstance.mint(user3, wei(bid - 10), { from: owner });
              await dthInstance.approve(zoneInstance.address, wei(bid), { from: user3 });
              await expectRevert(
                zoneInstance.bid(wei(bid), { from: user3 }),
                'sender does not have enough dth',
              );
            });
            it('@user2 (challenger1) -- [error] current highestBidder cannot bid', async () => {
              const bid = 10;
              await dthInstance.mint(user2, wei(bid), { from: owner });
              await dthInstance.approve(zoneInstance.address, wei(bid), { from: user2 });
              await expectRevert(
                zoneInstance.bid(wei(bid), { from: user2 }),
                'highest bidder cannot bid',
              );
            });
            it('@user1 (current zone owner) -- [error] bid amount is less than current highest bid', async () => {
              const bid = 5;
              await dthInstance.mint(user1, wei(bid), { from: owner });
              await dthInstance.approve(zoneInstance.address, wei(bid), { from: user1 });
              await expectRevert(
                zoneInstance.bid(wei(bid), { from: user1 }),
                'bid + already staked is not higher than current highest',
              );
            });
            it('@user3 (challenger2) -- [error] bid amount is less than current highest bid', async () => {
              const bid = MIN_ZONE_DTH_STAKE + 5;
              await dthInstance.mint(user3, wei(bid), { from: owner });
              await dthInstance.approve(zoneInstance.address, wei(bid), { from: user3 });
              await expectRevert(
                zoneInstance.bid(wei(bid), { from: user3 }),
                'bid is not higher than current highest',
              );
            });
            it('@user1 (current zone owner) -- [success] current zone owner can overbid challenger1', async () => {
              const bid = 20;
              await dthInstance.mint(user1, wei(bid), { from: owner });
              await dthInstance.approve(zoneInstance.address, wei(bid), { from: user1 });
              await zoneInstance.bid(wei(bid), { from: user1 });
            });
            it('@user3 (challenger2) -- [success] second challenger can overbid challenger1', async () => {
              const bid = MIN_ZONE_DTH_STAKE + 20;
              await dthInstance.mint(user3, wei(bid), { from: owner });
              await dthInstance.approve(zoneInstance.address, wei(bid), { from: user3 });
              await zoneInstance.bid(wei(bid), { from: user3 });
            });
          });
        });
      });
    });
  });

  describe('<<< Getters >>>', () => {
    describe('%%% pure %%%', () => {
      let zoneInstance;

      beforeEach(async () => {
        // create a zone with a zone owner
        const bid = MIN_ZONE_DTH_STAKE;
        await dthInstance.mint(user1, wei(bid), { from: owner });
        await dthInstance.approve(zoneFactoryInstance.address, wei(bid), { from: user1 });

        const tx = await zoneFactoryInstance.createAndClaim(VALID_GEOHASH, wei(bid), { from: user1 });
        zoneInstance = await Zone.at(tx.logs[0].args.zoneAddress);
      });
      describe('Zone.calcBidMinusEntryFee(uint _bid)', () => {
        it('returns correct result for 100 dth', async () => {
          const res = await zoneInstance.calcBidMinusEntryFee(wei(100));
          expect(res.toString()).to.equal(wei(99));
        });
        it('returns correct result for 101 dth', async () => {
          const res = await zoneInstance.calcBidMinusEntryFee(wei(101));
          expect(res.toString()).to.equal(wei(99.99));
        });
      });
    });
    describe('&&& view &&&', () => {
      describe('Zone.getLastAuction()', () => {
        describe('when Zone just got created (owned by @user1)', () => {
          let zoneInstance;

          beforeEach(async () => {
            // create a zone with a zone owner
            const bid = MIN_ZONE_DTH_STAKE;
            await dthInstance.mint(user1, wei(bid), { from: owner });
            await dthInstance.approve(zoneFactoryInstance.address, wei(bid), { from: user1 });

            const tx = await zoneFactoryInstance.createAndClaim(VALID_GEOHASH, wei(bid), { from: user1 });
            zoneInstance = await Zone.at(tx.logs[0].args.zoneAddress);
          });
          it('auction.id === 0', async () => {
            const res = await zoneInstance.getLastAuction();
            expect(res[0].toNumber()).to.equal(0);
          });
          it('auction.state === Ended(=1)', async () => {
            const res = await zoneInstance.getLastAuction();
            expect(res[1].toNumber()).to.equal(1);
          });
          it('auction.startTime === auction.endTime', async () => {
            const res = await zoneInstance.getLastAuction();
            expect(res[2].toNumber()).to.equal(res[3].toNumber());
          });
          it('auction.highestBidder === address(zoneOwner)', async () => {
            const res = await zoneInstance.getLastAuction();
            expect(res[4]).to.equal(user1);
          });
          it('auction.totalBids === first zone owner dth stake amount (no entry fee deducted) ', async () => {
            const res = await zoneInstance.getLastAuction();
            expect(res[5].toString()).to.equal(wei(MIN_ZONE_DTH_STAKE));
          });
          it('auction.numBidders === 1', async () => {
            const res = await zoneInstance.getLastAuction();
            expect(res[6].toNumber()).to.equal(1);
          });
          it('auction.processed === true', async () => {
            const res = await zoneInstance.getLastAuction();
            expect(res[7]).to.equal(true);
          });
          describe('when Zone cooldown period ended', () => {
            beforeEach(async () => {
              await timeTravel(COOLDOWN_PERIOD + ONE_HOUR);
            });
            it('returns correct Auction 0 Sentinel values', async () => {
              const lastAuction = await zoneInstance.getLastAuction();
              expect(lastAuction[0].toNumber(), 'lastAuction.id should be zero').to.equal(0);
              expect(lastAuction[1].toNumber(), 'lastAuction.state should equal Ended(=1)').to.equal(1);
              expect(lastAuction[2].toNumber(), 'lastAuction.endTime should be greater than 0').to.not.equal(0);
              expect(lastAuction[2].toNumber(), 'lastAuction.endTime should equal auction.startTime').to.equal(lastAuction[3].toNumber());
              expect(lastAuction[4], 'lastAuction.highestBidder should equal @user1').to.equal(user1);
              expect(lastAuction[5].toString(), 'lastAuction.totalBids sohuld equal input dth amount (without entry fee deduction)').to.equal(wei(MIN_ZONE_DTH_STAKE));
              expect(lastAuction[6].toNumber(), 'lastAuction.numBids should equal 1').to.equal(1);
              expect(lastAuction[7], 'lastAuction.processed should be true').to.equal(true);
            });
            describe('when @user2 (challenger1) started an Auction for this Zone', () => {
              beforeEach(async () => {
                const bid = MIN_ZONE_DTH_STAKE + 10;
                await dthInstance.mint(user2, wei(bid), { from: owner });
                await dthInstance.approve(zoneInstance.address, wei(bid), { from: user2 });
                await zoneInstance.bid(wei(bid), { from: user2 });
              });
              it('returns correct newly created Auction 1 values', async () => {
                const expectedDthMinusEntryFee = await zoneInstance.calcBidMinusEntryFee(wei(MIN_ZONE_DTH_STAKE + 10));
                const lastAuction = await zoneInstance.getLastAuction();
                expect(lastAuction[0].toNumber(), 'lastAuction.id should be 1').to.equal(1);
                expect(lastAuction[1].toNumber(), 'lastAuction.state should equal Started(=0)').to.equal(0);
                expect(lastAuction[2].toNumber(), 'lastAuction.endTime should be greater than 0').to.not.equal(0);
                expect(lastAuction[3].gt(lastAuction[2]), 'lastAuction.endTime should be bigger than auction.startTime').to.equal(true);
                expect(lastAuction[4], 'lastAuction.highestBidder should equal @user2').to.equal(user2);
                expect(lastAuction[5].toString(), 'lastAuction.totalBids should equal input dth amount with entry fee deducted').to.equal(expectedDthMinusEntryFee.toString());
                expect(lastAuction[6].toNumber(), 'lastAuction.numBids should equal 1').to.equal(1);
                expect(lastAuction[7], 'lastAuction.processed should be false').to.equal(false);
              });
              describe('when Auction endTime has passed (winner and new zone owner will be @user2)', () => {
                beforeEach(async () => {
                  await timeTravel(COOLDOWN_PERIOD + ONE_HOUR);
                });
                describe('when nobody has yet called a contract function to claim', () => {
                  it('returns correct Auction 1 state', async () => {
                    const expectedDthMinusEntryFee = await zoneInstance.calcBidMinusEntryFee(wei(MIN_ZONE_DTH_STAKE + 10));
                    const lastAuction = await zoneInstance.getLastAuction();
                    expect(lastAuction[0].toNumber(), 'lastAuction.id should be 1').to.equal(1);
                    expect(lastAuction[1].toNumber(), 'lastAuction.state should equal Started(=0)').to.equal(0);
                    expect(lastAuction[2].toNumber(), 'lastAuction.endTime should be greater than 0').to.not.equal(0);
                    expect(lastAuction[3].gt(lastAuction[2]), 'lastAuction.endTime should be bigger than auction.startTime').to.equal(true);
                    expect(lastAuction[4], 'lastAuction.highestBidder should equal @user2').to.equal(user2);
                    expect(lastAuction[5].toString(), 'lastAuction.totalBids should equal input dth amount with entry fee deducted').to.equal(expectedDthMinusEntryFee.toString());
                    expect(lastAuction[6].toNumber(), 'lastAuction.numBids should equal 1').to.equal(1);
                    expect(lastAuction[7], 'lastAuction.processed should be false').to.equal(false);
                  });
                });
                describe.skip('when auction win has been claimed', () => {

                  // TODO

                  beforeEach(async () => {
                    await zoneInstance.claim();
                  });
                  it('returns correct Auction 1 state', async () => {
                    const expectedDthMinusEntryFee = await zoneInstance.calcBidMinusEntryFee(wei(MIN_ZONE_DTH_STAKE + 10));
                    const lastAuction = await zoneInstance.getLastAuction();
                    expect(lastAuction[0].toNumber(), 'lastAuction.id should be 1').to.equal(1);
                    expect(lastAuction[1].toNumber(), 'lastAuction.state should equal Started(=0)').to.equal(0);
                    expect(lastAuction[2].toNumber(), 'lastAuction.endTime should be greater than 0').to.not.equal(0);
                    expect(lastAuction[2].gt(lastAuction[3]), 'lastAuction.endTime should be bigger than auction.startTime').to.equal(true);
                    expect(lastAuction[4], 'lastAuction.highestBidder should equal @user2').to.equal(user2);
                    expect(lastAuction[5].toString(), 'lastAuction.totalBids should equal input dth amount with entry fee deducted').to.equal(expectedDthMinusEntryFee.toNumber());
                    expect(lastAuction[6].toNumber(), 'lastAuction.numBids should equal 1').to.equal(1);
                    expect(lastAuction[7], 'lastAuction.processed should be false').to.equal(false);
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});
