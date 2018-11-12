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
const forgeErrorMessage2 = str => `Returned error: VM Exception while processing transaction: revert ${str}`;

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

const expectRevert2 = async (fn, errMsg) => {
  try {
    await fn;
  } catch (err) {
    expect(err.message).to.equal(forgeErrorMessage2(errMsg));
    return;
  }
  throw new Error('should have thrown');
};

const createDthZoneBidData = (zoneAddr, bid) => {
  const fnSig = web3.eth.abi.encodeFunctionSignature('transfer(address,uint256,bytes)');
  const params = web3.eth.abi.encodeParameters(
    ['address', 'uint256', 'bytes'],
    [zoneAddr, wei(bid), '0x42'],
  );
  return [fnSig, params.slice(2)].join('');
};
const createDthZoneCreateData = (zoneFactoryAddr, bid, geohash) => {
  const fnSig = web3.eth.abi.encodeFunctionSignature('transfer(address,uint256,bytes)');
  const params = web3.eth.abi.encodeParameters(
    ['address', 'uint256', 'bytes'],
    [zoneFactoryAddr, wei(bid), `0x40${geohash.slice(2)}`],
  );
  return [fnSig, params.slice(2)].join('');
};

contract('ZoneFactory + Zone', () => {
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
    describe('ZoneFactory.createAndClaim(bytes7 _geohash, uint _dthAmount)', () => {
      it('[error] -- creating a zone with geohash 0x0', async () => {
        await dthInstance.mint(user1, wei(MIN_ZONE_DTH_STAKE), { from: owner });
        await expectRevert2(
          web3.eth.sendTransaction({
            from: user1,
            to: dthInstance.address,
            data: createDthZoneCreateData(zoneFactoryInstance.address, MIN_ZONE_DTH_STAKE, BYTES7_ZERO),
            value: 0,
            gas: 4700000,
          }),
          'createAndClaim expect 8 bytes as _data',
        );
        const user1DthBalance = await dthInstance.balanceOf(user1);
        const zoneFactoryDthBalance = await dthInstance.balanceOf(zoneFactoryInstance.address);
        expect(user1DthBalance.toString(), 'user1 balance should not have changed').to.equal(wei(MIN_ZONE_DTH_STAKE));
        expect(zoneFactoryDthBalance.toNumber(), 'zone factory balance should still be zero').to.equal(0);
      });
      it(`[error] -- creating a zone with dthAmount minimum - 1 (${MIN_ZONE_DTH_STAKE - 1} DTH)`, async () => {
        await dthInstance.mint(user1, wei(MIN_ZONE_DTH_STAKE - 1), { from: owner });
        await expectRevert2(
          web3.eth.sendTransaction({
            from: user1,
            to: dthInstance.address,
            data: createDthZoneCreateData(zoneFactoryInstance.address, MIN_ZONE_DTH_STAKE - 1, VALID_GEOHASH),
            value: 0,
            gas: 4700000,
          }),
          'zone dth stake shoulld be at least minimum (100DTH)',
        );
        const user1DthBalance = await dthInstance.balanceOf(user1);
        const zoneFactoryDthBalance = await dthInstance.balanceOf(zoneFactoryInstance.address);
        expect(user1DthBalance.toString(), 'user1 balance should not have changed').to.equal(wei(MIN_ZONE_DTH_STAKE - 1));
        expect(zoneFactoryDthBalance.toNumber(), 'zone factory balance should not have changed').to.equal(0);
      });
      it(`[success] ++ creating a zone with dthAmount minimum (${MIN_ZONE_DTH_STAKE} DTH)`, async () => {
        await dthInstance.mint(user1, wei(MIN_ZONE_DTH_STAKE), { from: owner });
        const tx = await web3.eth.sendTransaction({
          from: user1,
          to: dthInstance.address,
          data: createDthZoneCreateData(zoneFactoryInstance.address, MIN_ZONE_DTH_STAKE, VALID_GEOHASH),
          value: 0,
          gas: 4700000,
        });
        const zoneInstanceAddress = `0x${tx.logs[1].topics[1].slice(-40)}`;
        const user1DthBalance = await dthInstance.balanceOf(user1);
        const zoneFactoryDthBalance = await dthInstance.balanceOf(zoneFactoryInstance.address);
        const newZoneDthBalance = await dthInstance.balanceOf(zoneInstanceAddress);
        expect(user1DthBalance.toNumber(), 'user1 balance should have decreased by stake amount').to.equal(0);
        expect(zoneFactoryDthBalance.toNumber(), 'zone factory balance should not have changed').to.equal(0);
        expect(newZoneDthBalance.toString(), 'zone balance should equal stake amount').to.equal(wei(MIN_ZONE_DTH_STAKE));
      });
      it(`[success] ++ deploying a zone with dthAmount minimum + 1 (${MIN_ZONE_DTH_STAKE + 1} DTH)`, async () => {
        await dthInstance.mint(user1, wei(MIN_ZONE_DTH_STAKE + 1), { from: owner });
        const tx = await web3.eth.sendTransaction({
          from: user1,
          to: dthInstance.address,
          data: createDthZoneCreateData(zoneFactoryInstance.address, MIN_ZONE_DTH_STAKE + 1, VALID_GEOHASH),
          value: 0,
          gas: 4700000,
        });
        const zoneInstanceAddress = `0x${tx.logs[1].topics[1].slice(-40)}`;
        const user1DthBalance = await dthInstance.balanceOf(user1);
        const zoneFactoryDthBalance = await dthInstance.balanceOf(zoneFactoryInstance.address);
        const newZoneDthBalance = await dthInstance.balanceOf(zoneInstanceAddress);
        expect(user1DthBalance.toNumber(), 'user1 balance should have decreased by stake amount').to.equal(0);
        expect(zoneFactoryDthBalance.toNumber(), 'zone factory balance should not have changed').to.equal(0);
        expect(newZoneDthBalance.toString(), 'zone balance should equal stake amount').to.equal(wei(MIN_ZONE_DTH_STAKE + 1));
      });
    });
  });

  describe.only('<<< Setters >>>', () => {
    describe('Zone.bid(uint _dthAmount)', () => {
      describe('when Zone just got created (owned by @user1)', () => {
        let zoneInstance;
        const initialZoneDthBalance = MIN_ZONE_DTH_STAKE;

        beforeEach(async () => {
          // create a zone with a zone owner
          const bid = MIN_ZONE_DTH_STAKE;
          await dthInstance.mint(user1, wei(bid), { from: owner });
          const tx = await web3.eth.sendTransaction({
            from: user1,
            to: dthInstance.address,
            data: createDthZoneCreateData(zoneFactoryInstance.address, bid, VALID_GEOHASH),
            value: 0,
            gas: 4700000,
          });
          zoneInstance = await Zone.at(`0x${tx.logs[1].topics[1].slice(-40)}`);
        });
        // i[error] -- t('[error] zone currently has no owner', async () => {
        //   // await dthInstance.approve(zoneInstance, wei(1000), { from: user2 });
        //   // TODO: when release() is implemented
        //   return Promise.resolve();
        // });
        it('[error] -- @user2 (challenger1) cooldown period has not yet ended', async () => {
          const bid = MIN_ZONE_DTH_STAKE + 10;
          await dthInstance.mint(user2, wei(bid), { from: owner });
          await expectRevert2(
            web3.eth.sendTransaction({
              from: user2,
              to: dthInstance.address,
              data: createDthZoneBidData(zoneInstance.address, bid),
              value: 0,
              gas: 4700000,
            }),
            'cooldown period did not end yet',
          );
          const user2DthBalance = await dthInstance.balanceOf(user2);
          const zoneDthBalance = await dthInstance.balanceOf(zoneInstance.address);
          expect(user2DthBalance.toString(), 'user2 balance should not have changed').to.equal(wei(bid));
          expect(zoneDthBalance.toString(), 'zone balance should not have changed').to.equal(wei(initialZoneDthBalance));
        });
        describe('when Zone cooldown period ended', () => {
          beforeEach(async () => {
            await timeTravel(COOLDOWN_PERIOD + ONE_HOUR);
          });
          it('[error] -- @user1 (current zone owner) cannot start auction', async () => {
            const bid = 10;
            await dthInstance.mint(user1, wei(bid), { from: owner });
            await expectRevert2(
              web3.eth.sendTransaction({
                from: user1,
                to: dthInstance.address,
                data: createDthZoneBidData(zoneInstance.address, bid),
                value: 0,
                gas: 4700000,
              }),
              'zoneowner cannot start an auction',
            );
            const user1DthBalance = await dthInstance.balanceOf(user1);
            const zoneDthBalance = await dthInstance.balanceOf(zoneInstance.address);
            expect(user1DthBalance.toString(), 'user1 balance should not have changed').to.equal(wei(bid));
            expect(zoneDthBalance.toString(), 'zone balance should not have changed').to.equal(wei(initialZoneDthBalance));
          });
          it('[error] -- @user2 (challenger1) bid amount is less than current zone stake', async () => {
            const bid = MIN_ZONE_DTH_STAKE - 10;
            await dthInstance.mint(user2, wei(bid), { from: owner });
            await expectRevert2(
              web3.eth.sendTransaction({
                from: user2,
                to: dthInstance.address,
                data: createDthZoneBidData(zoneInstance.address, bid),
                value: 0,
                gas: 4700000,
              }),
              'bid is lower than current zone stake',
            );
            const user2DthBalance = await dthInstance.balanceOf(user2);
            const zoneDthBalance = await dthInstance.balanceOf(zoneInstance.address);
            expect(user2DthBalance.toString(), 'user2 balance should not have changed').to.equal(wei(bid));
            expect(zoneDthBalance.toString(), 'zone balance should not have changed').to.equal(wei(initialZoneDthBalance));
          });
          it('[success] ++ @user2 (challenger1) can start auction if bid higher than current', async () => {
            const bid = MIN_ZONE_DTH_STAKE + 10;
            await dthInstance.mint(user2, wei(bid), { from: owner });
            await web3.eth.sendTransaction({
              from: user2,
              to: dthInstance.address,
              data: createDthZoneBidData(zoneInstance.address, bid),
              value: 0,
              gas: 4700000,
            });
            const user2DthBalance = await dthInstance.balanceOf(user2);
            const zoneDthBalance = await dthInstance.balanceOf(zoneInstance.address);
            expect(user2DthBalance.toString(), 'user2 balance should have decreased by bid amount').to.equal(wei(0));
            const bidMinusEntryFee = 108.9; // 1% of 110 = 1,1
            expect(zoneDthBalance.toString(), 'zone balance should have increased by bid amount (minus entry fee)').to.equal(wei(initialZoneDthBalance + bidMinusEntryFee));
          });
          describe('when @user2 (challenger1) started an Auction for this Zone', () => {
            const challenger1bidMinusEntryFee = 108.9; // 1% of 110 = 1,1
            beforeEach(async () => {
              const bid = MIN_ZONE_DTH_STAKE + 10; // minus entry fee = 108,9
              await dthInstance.mint(user2, wei(bid), { from: owner });
              await web3.eth.sendTransaction({
                from: user2,
                to: dthInstance.address,
                data: createDthZoneBidData(zoneInstance.address, bid),
                value: 0,
                gas: 4700000,
              });
            });
            it('[error] -- @user2 (challenger1) current highest bidder cannot bid', async () => {
              const bid = 10;
              await dthInstance.mint(user2, wei(bid), { from: owner });
              await expectRevert2(
                web3.eth.sendTransaction({
                  from: user2,
                  to: dthInstance.address,
                  data: createDthZoneBidData(zoneInstance.address, bid),
                  value: 0,
                  gas: 4700000,
                }),
                'highest bidder cannot bid',
              );
              const user2DthBalance = await dthInstance.balanceOf(user2);
              const zoneDthBalance = await dthInstance.balanceOf(zoneInstance.address);
              expect(user2DthBalance.toString(), 'user2 balance should not have changed').to.equal(wei(bid));
              expect(zoneDthBalance.toString(), 'zone balance should not have changed').to.equal(wei(initialZoneDthBalance + challenger1bidMinusEntryFee));
            });
            it('[error] -- @user1 (current zone owner) bid amount is less than current highest', async () => {
              const bid = 5;
              await dthInstance.mint(user1, wei(bid), { from: owner });
              await expectRevert2(
                web3.eth.sendTransaction({
                  from: user1,
                  to: dthInstance.address,
                  data: createDthZoneBidData(zoneInstance.address, bid),
                  value: 0,
                  gas: 4700000,
                }),
                'bid + already staked is less than current highest',
              );
              const user1DthBalance = await dthInstance.balanceOf(user1);
              const zoneDthBalance = await dthInstance.balanceOf(zoneInstance.address);
              expect(user1DthBalance.toString(), 'user1 balance should not have changed').to.equal(wei(bid));
              expect(zoneDthBalance.toString(), 'zone balance should not have changed').to.equal(wei(initialZoneDthBalance + challenger1bidMinusEntryFee));
            });
            it('[error] -- @user3 (challenger2) bid amount is less than current highest', async () => {
              const bid = MIN_ZONE_DTH_STAKE + 5;
              await dthInstance.mint(user3, wei(bid), { from: owner });
              await expectRevert2(
                web3.eth.sendTransaction({
                  from: user3,
                  to: dthInstance.address,
                  data: createDthZoneBidData(zoneInstance.address, bid),
                  value: 0,
                  gas: 4700000,
                }),
                'bid is less than current highest',
              );
              const user3DthBalance = await dthInstance.balanceOf(user3);
              const zoneDthBalance = await dthInstance.balanceOf(zoneInstance.address);
              expect(user3DthBalance.toString(), 'user3 balance should not have changed').to.equal(wei(bid));
              expect(zoneDthBalance.toString(), 'zone balance should not have changed').to.equal(wei(initialZoneDthBalance + challenger1bidMinusEntryFee));
            });
            it('[success] ++ @user1 (current zone owner) can overbid challenger1', async () => {
              const bid = 20;
              await dthInstance.mint(user1, wei(bid), { from: owner });
              await web3.eth.sendTransaction({
                from: user1,
                to: dthInstance.address,
                data: createDthZoneBidData(zoneInstance.address, bid),
                value: 0,
                gas: 4700000,
              });
              const user1DthBalance = await dthInstance.balanceOf(user1);
              const zoneDthBalance = await dthInstance.balanceOf(zoneInstance.address);
              expect(user1DthBalance.toString(), 'user1 balance should have decreased by bid amount').to.equal(wei(0));
              expect(zoneDthBalance.toString(), 'zone balance should have increased by bid amount').to.equal(wei(initialZoneDthBalance + challenger1bidMinusEntryFee + bid));
            });
            it('[success] ++ @user3 (challenger2) can overbid challenger1', async () => {
              const bid = MIN_ZONE_DTH_STAKE + 20; // 1% of 120 = 1,2 = 118,8
              const bidMinusEntryFee = 118.8; // 1% of 120 = 1,2 = 118,8
              await dthInstance.mint(user3, wei(bid), { from: owner });
              await web3.eth.sendTransaction({
                from: user3,
                to: dthInstance.address,
                data: createDthZoneBidData(zoneInstance.address, bid),
                value: 0,
                gas: 4700000,
              });
              const user3DthBalance = await dthInstance.balanceOf(user3);
              const zoneDthBalance = await dthInstance.balanceOf(zoneInstance.address);
              expect(user3DthBalance.toString(), 'user3 balance should have decreased by bid amount').to.equal(wei(0));
              expect(zoneDthBalance.toString(), 'zone balance should have increased by bid amount (minus entry fee)').to.equal(wei(initialZoneDthBalance  + challenger1bidMinusEntryFee + bidMinusEntryFee));
            });
            describe('when @user3 (challenger2) also placed a bid in the Auction for this Zone', () => {
              const challenger2bidMinusEntryFee = 118.8; // 1% of 120 = 1,2

              beforeEach(async () => {
                const bid = MIN_ZONE_DTH_STAKE + 20; // minus entry fee = 118,8
                await dthInstance.mint(user3, wei(bid), { from: owner });
                await web3.eth.sendTransaction({
                  from: user3,
                  to: dthInstance.address,
                  data: createDthZoneBidData(zoneInstance.address, bid),
                  value: 0,
                  gas: 4700000,
                });
              });
              it('[error] -- @user3 (challenger2) current highest bidder cannot bid', async () => {
                const bid = 10;
                await dthInstance.mint(user3, wei(bid), { from: owner });
                await expectRevert2(
                  web3.eth.sendTransaction({
                    from: user3,
                    to: dthInstance.address,
                    data: createDthZoneBidData(zoneInstance.address, bid),
                    value: 0,
                    gas: 4700000,
                  }),
                  'highest bidder cannot bid',
                );
                const user3DthBalance = await dthInstance.balanceOf(user3);
                const zoneDthBalance = await dthInstance.balanceOf(zoneInstance.address);
                expect(user3DthBalance.toString(), 'user3 balance should not have changed').to.equal(wei(bid));
                expect(zoneDthBalance.toString(), 'zone balance should not have changed').to.equal(wei(initialZoneDthBalance + challenger1bidMinusEntryFee + challenger2bidMinusEntryFee));
              });
              it('[error] -- @user1 (current zone owner) bid amount is less than current highest', async () => {
                const bid = 5;
                await dthInstance.mint(user1, wei(bid), { from: owner });
                await expectRevert2(
                  web3.eth.sendTransaction({
                    from: user1,
                    to: dthInstance.address,
                    data: createDthZoneBidData(zoneInstance.address, bid),
                    value: 0,
                    gas: 4700000,
                  }),
                  'bid + already staked is less than current highest',
                );
                const user1DthBalance = await dthInstance.balanceOf(user1);
                const zoneDthBalance = await dthInstance.balanceOf(zoneInstance.address);
                expect(user1DthBalance.toString(), 'user1 balance should not have changed').to.equal(wei(bid));
                expect(zoneDthBalance.toString(), 'zone balance should not have changed').to.equal(wei(initialZoneDthBalance + challenger1bidMinusEntryFee + challenger2bidMinusEntryFee));
              });
              it('[error] -- @user2 (challenger1) bid amount is less than current highest', async () => {
                const bid = 5;
                await dthInstance.mint(user2, wei(bid), { from: owner });
                await expectRevert2(
                  web3.eth.sendTransaction({
                    from: user2,
                    to: dthInstance.address,
                    data: createDthZoneBidData(zoneInstance.address, bid),
                    value: 0,
                    gas: 4700000,
                  }),
                  'bid is less than current highest',
                );
                const user2DthBalance = await dthInstance.balanceOf(user2);
                const zoneDthBalance = await dthInstance.balanceOf(zoneInstance.address);
                expect(user2DthBalance.toString(), 'user2 balance should not have changed').to.equal(wei(bid));
                expect(zoneDthBalance.toString(), 'zone balance should not have changed').to.equal(wei(initialZoneDthBalance + challenger1bidMinusEntryFee + challenger2bidMinusEntryFee));
              });
              it('[success] ++ @user1 (current zone owner) can overbid challenger2', async () => {
                const bid = 25;
                await dthInstance.mint(user1, wei(bid), { from: owner });
                await web3.eth.sendTransaction({
                  from: user1,
                  to: dthInstance.address,
                  data: createDthZoneBidData(zoneInstance.address, bid),
                  value: 0,
                  gas: 4700000,
                });
                const user1DthBalance = await dthInstance.balanceOf(user1);
                const zoneDthBalance = await dthInstance.balanceOf(zoneInstance.address);
                expect(user1DthBalance.toString(), 'user1 balance should have decreased by bid amount').to.equal(wei(0));
                expect(zoneDthBalance.toString(), 'zone balance should have increased by bid amount').to.equal(wei(initialZoneDthBalance + challenger1bidMinusEntryFee + challenger2bidMinusEntryFee + bid));
              });
              it('[success] ++ @user2 (challenger1) can overbid challenger2', async () => {
                const bid = 10;
                await dthInstance.mint(user2, wei(bid), { from: owner });
                await web3.eth.sendTransaction({
                  from: user2,
                  to: dthInstance.address,
                  data: createDthZoneBidData(zoneInstance.address, bid),
                  value: 0,
                  gas: 4700000,
                });
                const user2DthBalance = await dthInstance.balanceOf(user2);
                const zoneDthBalance = await dthInstance.balanceOf(zoneInstance.address);
                expect(user2DthBalance.toString(), 'user2 balance should have decreased by bid amount').to.equal(wei(0));
                expect(zoneDthBalance.toString(), 'zone balance should have increased by bid amount (minus entry fee)').to.equal(wei(initialZoneDthBalance + challenger1bidMinusEntryFee + challenger2bidMinusEntryFee + bid));
              });
            });
          });
        });
      });
    });
  });

  describe.only('<<< Getters >>>', () => {
    describe('PURE FUNCTIONS', () => {
      let zoneInstance;

      beforeEach(async () => {
        // create a zone with a zone owner
        const bid = MIN_ZONE_DTH_STAKE;
        await dthInstance.mint(user1, wei(bid), { from: owner });
        const tx = await web3.eth.sendTransaction({
          from: user1,
          to: dthInstance.address,
          data: createDthZoneCreateData(zoneFactoryInstance.address, bid, VALID_GEOHASH),
          value: 0,
          gas: 4700000,
        });
        zoneInstance = await Zone.at(`0x${tx.logs[1].topics[1].slice(-40)}`);
      });
      describe('Zone.calcEntryFee(uint _bid)', () => {
        it('returns correct result for 100 dth', async () => {
          const res = await zoneInstance.calcEntryFee(wei(100));
          expect(res[0].toString()).to.equal(wei(1));
          expect(res[1].toString()).to.equal(wei(99));
        });
        it('returns correct result for 101 dth', async () => {
          const res = await zoneInstance.calcEntryFee(wei(101));
          expect(res[0].toString()).to.equal(wei(1.01));
          expect(res[1].toString()).to.equal(wei(99.99));
        });
      });
      describe.skip('Zone.calcHarbergerTax(uint _startTime, uint _endTime, uint _dthAmount)', () => {
        it('returns correct result for 100 dth', async () => {
          const res = await zoneInstance.calcEntryFee(wei(100));
          expect(res[0].toString()).to.equal(wei(1));
          expect(res[1].toString()).to.equal(wei(99));
        });
        it('returns correct result for 101 dth', async () => {
          const res = await zoneInstance.calcEntryFee(wei(101));
          expect(res[0].toString()).to.equal(wei(1.01));
          expect(res[1].toString()).to.equal(wei(99.99));
        });
      });
    });
    describe('VIEW FUNCTIONS', () => {
      describe('Zone.getLastAuction()', () => {
        describe('when Zone just got created (owned by @user1)', () => {
          let zoneInstance;

          beforeEach(async () => {
            // create a zone with a zone owner
            const bid = MIN_ZONE_DTH_STAKE;
            await dthInstance.mint(user1, wei(bid), { from: owner });
            const tx = await web3.eth.sendTransaction({
              from: user1,
              to: dthInstance.address,
              data: createDthZoneCreateData(zoneFactoryInstance.address, bid, VALID_GEOHASH),
              value: 0,
              gas: 4700000,
            });
            zoneInstance = await Zone.at(`0x${tx.logs[1].topics[1].slice(-40)}`);
          });
          it('returns correct Auction 0 Sentinel values', async () => {
            const lastAuction = await zoneInstance.getLastAuction();
            expect(lastAuction[0].toNumber(), 'lastAuction.id should be zero').to.equal(0);
            expect(lastAuction[1].toNumber(), 'lastAuction.state should equal Ended(=1)').to.equal(1);
            expect(lastAuction[2].toNumber(), 'lastAuction.endTime should be greater than 0').to.not.equal(0);
            expect(lastAuction[2].toNumber(), 'lastAuction.endTime should equal auction.startTime').to.equal(lastAuction[3].toNumber());
            expect(lastAuction[4], 'lastAuction.highestBidder should equal @user1').to.equal(user1);
          });
          describe('when Zone cooldown period ended', () => {
            beforeEach(async () => {
              await timeTravel(COOLDOWN_PERIOD + ONE_HOUR);
            });
            describe('when @user2 (challenger1) started an Auction for this Zone', () => {
              beforeEach(async () => {
                const bid = MIN_ZONE_DTH_STAKE + 10;
                await dthInstance.mint(user2, wei(bid), { from: owner });
                await dthInstance.approve(zoneInstance.address, wei(bid), { from: user2 });
                await web3.eth.sendTransaction({
                  from: user2,
                  to: dthInstance.address,
                  data: createDthZoneBidData(zoneInstance.address, bid),
                  value: 0,
                  gas: 4700000,
                });
              });
              it('returns correct newly created Auction 1 values', async () => {
                const lastAuction = await zoneInstance.getLastAuction();
                expect(lastAuction[0].toNumber(), 'lastAuction.id should be 1').to.equal(1);
                expect(lastAuction[1].toNumber(), 'lastAuction.state should equal Started(=0)').to.equal(0);
                expect(lastAuction[2].toNumber(), 'lastAuction.endTime should be greater than 0').to.not.equal(0);
                expect(lastAuction[3].gt(lastAuction[2]), 'lastAuction.endTime should be bigger than auction.startTime').to.equal(true);
                expect(lastAuction[4], 'lastAuction.highestBidder should equal @user2').to.equal(user2);
              });
              describe('when @user1 (current zone owner) places a counter bid', () => {
                beforeEach(async () => {
                  const bid = 20;
                  await dthInstance.mint(user1, wei(bid), { from: owner });
                  await dthInstance.approve(zoneInstance.address, wei(bid), { from: user1 });
                  await web3.eth.sendTransaction({
                    from: user1,
                    to: dthInstance.address,
                    data: createDthZoneBidData(zoneInstance.address, bid),
                    value: 0,
                    gas: 4700000,
                  });
                });
                it('returns correct updated (highestBidder) Auction 1 values', async () => {
                  const lastAuction = await zoneInstance.getLastAuction();
                  expect(lastAuction[0].toNumber(), 'lastAuction.id should be 1').to.equal(1);
                  expect(lastAuction[1].toNumber(), 'lastAuction.state should equal Started(=0)').to.equal(0);
                  expect(lastAuction[2].toNumber(), 'lastAuction.endTime should be greater than 0').to.not.equal(0);
                  expect(lastAuction[3].gt(lastAuction[2]), 'lastAuction.endTime should be bigger than auction.startTime').to.equal(true);
                  expect(lastAuction[4], 'lastAuction.highestBidder should equal @user1').to.equal(user1);
                });
                describe('when @user2 (challenger1) places a counter bid', () => {
                  beforeEach(async () => {
                    const bid = 20;
                    await dthInstance.mint(user2, wei(bid), { from: owner });
                    await dthInstance.approve(zoneInstance.address, wei(bid), { from: user2 });
                    await web3.eth.sendTransaction({
                      from: user2,
                      to: dthInstance.address,
                      data: createDthZoneBidData(zoneInstance.address, bid),
                      value: 0,
                      gas: 4700000,
                    });
                  });
                  it('returns correct updated (highestBidder) Auction 1 values', async () => {
                    const lastAuction = await zoneInstance.getLastAuction();
                    expect(lastAuction[0].toNumber(), 'lastAuction.id should be 1').to.equal(1);
                    expect(lastAuction[1].toNumber(), 'lastAuction.state should equal Started(=0)').to.equal(0);
                    expect(lastAuction[2].toNumber(), 'lastAuction.endTime should be greater than 0').to.not.equal(0);
                    expect(lastAuction[3].gt(lastAuction[2]), 'lastAuction.endTime should be bigger than auction.startTime').to.equal(true);
                    expect(lastAuction[4], 'lastAuction.highestBidder should equal @user2').to.equal(user2);
                  });
                  describe('when Auction endTime has passed (winner and new zone owner will be @user2)', () => {
                    beforeEach(async () => {
                      await timeTravel(BID_PERIOD + ONE_HOUR);
                    });
                    describe('when Zone cooldown period ended', () => {
                      beforeEach(async () => {
                        await timeTravel(COOLDOWN_PERIOD + ONE_HOUR);
                      });
                      describe('when @user3 (challenger2) started an Auction for this Zone', () => {
                        beforeEach(async () => {
                          const bid = MIN_ZONE_DTH_STAKE + 40;
                          await dthInstance.mint(user3, wei(bid), { from: owner });
                          await dthInstance.approve(zoneInstance.address, wei(bid), { from: user3 });
                          await web3.eth.sendTransaction({
                            from: user3,
                            to: dthInstance.address,
                            data: createDthZoneBidData(zoneInstance.address, bid),
                            value: 0,
                            gas: 4700000,
                          });
                        });
                        it('returns correct newly created Auction 2 values', async () => {
                          const lastAuction = await zoneInstance.getLastAuction();
                          expect(lastAuction[0].toNumber(), 'lastAuction.id should be 2').to.equal(2);
                          expect(lastAuction[1].toNumber(), 'lastAuction.state should equal Started(=0)').to.equal(0);
                          expect(lastAuction[2].toNumber(), 'lastAuction.endTime should be greater than 0').to.not.equal(0);
                          expect(lastAuction[3].gt(lastAuction[2]), 'lastAuction.endTime should be bigger than auction.startTime').to.equal(true);
                          expect(lastAuction[4], 'lastAuction.highestBidder should equal @user3').to.equal(user3);
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
    });
  });
});
