/* eslint-env mocha */
/* global artifacts, contract, expect */
/* eslint-disable max-len, no-multi-spaces */

const DetherToken = artifacts.require('DetherToken.sol');
const Control = artifacts.require('Control.sol');
const FakeExchangeRateOracle = artifacts.require('FakeExchangeRateOracle.sol');
const SmsCertifier = artifacts.require('SmsCertifier.sol');
const KycCertifier = artifacts.require('KycCertifier.sol');
const Users = artifacts.require('Users.sol');
const GeoRegistry = artifacts.require('GeoRegistry.sol');
const ZoneFactory = artifacts.require('ZoneFactory.sol');
const Zone = artifacts.require('Zone.sol');

const Web3 = require('web3');

const { getAccounts } = require('../utils');
const { addCountry } = require('./geo_utils');

const web3 = new Web3('http://localhost:8545');

const BYTES7_ZERO = '00000000000000';
// const BYTES32_ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000';
// const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';
// const ADDRESS_BURN = '0xffffffffffffffffffffffffffffffffffffffff';

const MIN_ZONE_DTH_STAKE = 100;
const VALID_GEOHASH = web3.utils.asciiToHex('kr0ttse');
const INVALID_GEOHASH = web3.utils.asciiToHex('krtttse');

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

// const getLastBlockTimestamp = () => (
//   web3.eth.getBlock('latest').then(b => b.timestamp)
// );

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


const createDthZoneCreateData = (zoneFactoryAddr, bid, countryCode, geohash) => {
  const fnSig = web3.eth.abi.encodeFunctionSignature('transfer(address,uint256,bytes)');
  const params = web3.eth.abi.encodeParameters(
    ['address', 'uint256', 'bytes'],
    [zoneFactoryAddr, wei(bid), `0x40${countryCode.slice(2)}${geohash.slice(2)}`],
  );
  return [fnSig, params.slice(2)].join('');
};
const createDthZoneClaimFreeData = (zoneFactoryAddr, dthAmount) => {
  const fnSig = web3.eth.abi.encodeFunctionSignature('transfer(address,uint256,bytes)');
  const params = web3.eth.abi.encodeParameters(
    ['address', 'uint256', 'bytes'],
    [zoneFactoryAddr, wei(dthAmount), '0x41'],
  );
  return [fnSig, params.slice(2)].join('');
};
const createDthZoneBidData = (zoneAddr, bid) => {
  const fnSig = web3.eth.abi.encodeFunctionSignature('transfer(address,uint256,bytes)');
  const params = web3.eth.abi.encodeParameters(
    ['address', 'uint256', 'bytes'],
    [zoneAddr, wei(bid), '0x42'],
  );
  return [fnSig, params.slice(2)].join('');
};
const createDthZoneTopUpData = (zoneAddr, dthAmount) => {
  const fnSig = web3.eth.abi.encodeFunctionSignature('transfer(address,uint256,bytes)');
  const params = web3.eth.abi.encodeParameters(
    ['address', 'uint256', 'bytes'],
    [zoneAddr, wei(dthAmount), '0x43'],
  );
  return [fnSig, params.slice(2)].join('');
};

const COUNTRY_CG = 'CG';

contract.only('ZoneFactory + Zone', () => {
  let owner;
  let user1;
  let user2;
  let user3;

  let __rootState__; // eslint-disable-line no-underscore-dangle

  let controlInstance;
  let smsInstance;
  let kycInstance;
  let dthInstance;
  let priceInstance;
  let usersInstance;
  let geoInstance;
  let zoneFactoryInstance;

  before(async () => {
    __rootState__ = await saveState();
    // ROOT_TIME = await getLastBlockTimestamp();
    ([owner, user1, user2, user3] = await getAccounts(web3));
  });

  beforeEach(async () => {
    await revertState(__rootState__); // to go back to real time

    dthInstance = await DetherToken.new({ from: owner });
    priceInstance = await FakeExchangeRateOracle.new({ from: owner }); // TODO: let CEO update oracle?
    controlInstance = await Control.new({ from: owner });
    smsInstance = await SmsCertifier.new(controlInstance.address, { from: owner });
    kycInstance = await KycCertifier.new(controlInstance.address, { from: owner });
    geoInstance = await GeoRegistry.new(controlInstance.address, { from: owner });

    usersInstance = await Users.new(
      priceInstance.address,
      geoInstance.address,
      smsInstance.address,
      kycInstance.address,
      controlInstance.address,
      { from: owner },
    );

    zoneFactoryInstance = await ZoneFactory.new(
      dthInstance.address,
      geoInstance.address,
      usersInstance.address,
      controlInstance.address,
      { from: owner },
    );

    await smsInstance.addDelegate(owner, { from: owner });
  });

  const createZone = async (from, dthAmount, countryCode, geohash) => {
    await smsInstance.certify(from, { from: owner });
    await dthInstance.mint(from, wei(dthAmount), { from: owner });
    const tx = await web3.eth.sendTransaction({
      from,
      to: dthInstance.address,
      data: createDthZoneCreateData(zoneFactoryInstance.address, dthAmount, web3.utils.asciiToHex(countryCode), geohash),
      value: 0,
      gas: 4700000,
    });
    const zoneInstance = await Zone.at(`0x${tx.logs[1].topics[1].slice(-40)}`);
    return zoneInstance;
  };

  const placeBid = async (from, dthAmount, zoneAddress) => {
    await smsInstance.certify(from, { from: owner });
    await dthInstance.mint(from, wei(dthAmount), { from: owner });
    await web3.eth.sendTransaction({
      from,
      to: dthInstance.address,
      data: createDthZoneBidData(zoneAddress, dthAmount),
      value: 0,
      gas: 4700000,
    });
  };

  const claimFreeZone = async (from, dthAmount, zoneAddress) => {
    await smsInstance.certify(from, { from: owner });
    await dthInstance.mint(from, wei(dthAmount), { from: owner });
    await web3.eth.sendTransaction({
      from,
      to: dthInstance.address,
      data: createDthZoneClaimFreeData(zoneAddress, dthAmount),
      value: 0,
      gas: 4700000,
    });
  };

  const topUp = async (from, dthAmount, zoneAddress) => {
    await smsInstance.certify(from, { from: owner });
    await dthInstance.mint(from, wei(dthAmount), { from: owner });
    await web3.eth.sendTransaction({
      from,
      to: dthInstance.address,
      data: createDthZoneTopUpData(zoneAddress, dthAmount),
      value: 0,
      gas: 4700000,
    });
  };

  const enableAndLoadCountry = async (countryCode) => {
    await addCountry(owner, web3, geoInstance, countryCode, 300);
    await geoInstance.enableCountry(countryCode, { from: owner });
  };

  describe('>>> deploying a Zone', () => {
    describe('[ERC223] ZoneFactory.createAndClaim(bytes2 _country, bytes7 _geohash, uint _dthAmount)', () => {
      it('[error] -- country is disabled', async () => {
        await expectRevert2(
          createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_GEOHASH),
          'country is disabled',
        );
      });
      it('[error] -- creating a zone with geohash 0x0', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        await expectRevert2(
          createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, BYTES7_ZERO),
          'createAndClaim expect 10 bytes as _data',
        );
      });
      it('[error] -- zone is not inside country', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        await expectRevert2(
          createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, INVALID_GEOHASH),
          'zone is not inside country',
        );
      });
      it('[error] -- zone already exists', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        await createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_GEOHASH);
        await expectRevert2(
          createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_GEOHASH),
          'zone already exists',
        );
      });
      it(`[error] -- creating a zone with dthAmount minimum - 1 (${MIN_ZONE_DTH_STAKE - 1} DTH)`, async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        await expectRevert2(
          createZone(user1, MIN_ZONE_DTH_STAKE - 1, COUNTRY_CG, VALID_GEOHASH),
          'zone dth stake shoulld be at least minimum (100DTH)',
        );
      });
      it(`[success] ++ creating a zone with dthAmount minimum (${MIN_ZONE_DTH_STAKE} DTH)`, async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        const zoneInstance = await createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_GEOHASH);
        const user1DthBalance = await dthInstance.balanceOf(user1);
        const zoneFactoryDthBalance = await dthInstance.balanceOf(zoneFactoryInstance.address);
        const newZoneDthBalance = await dthInstance.balanceOf(zoneInstance.address);
        expect(user1DthBalance.toNumber(), 'user1 balance should have decreased by stake amount').to.equal(0);
        expect(zoneFactoryDthBalance.toNumber(), 'zone factory balance should not have changed').to.equal(0);
        expect(newZoneDthBalance.toString(), 'zone balance should equal stake amount').to.equal(wei(MIN_ZONE_DTH_STAKE));
      });
      it(`[success] ++ deploying a zone with dthAmount minimum + 1 (${MIN_ZONE_DTH_STAKE + 1} DTH)`, async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        const zoneInstance = await createZone(user1, MIN_ZONE_DTH_STAKE + 1, COUNTRY_CG, VALID_GEOHASH);
        const user1DthBalance = await dthInstance.balanceOf(user1);
        const zoneFactoryDthBalance = await dthInstance.balanceOf(zoneFactoryInstance.address);
        const newZoneDthBalance = await dthInstance.balanceOf(zoneInstance.address);
        expect(user1DthBalance.toNumber(), 'user1 balance should have decreased by stake amount').to.equal(0);
        expect(zoneFactoryDthBalance.toNumber(), 'zone factory balance should not have changed').to.equal(0);
        expect(newZoneDthBalance.toString(), 'zone balance should equal stake amount').to.equal(wei(MIN_ZONE_DTH_STAKE + 1));
      });
    });
  });

  describe('>>> Zone Actions', () => {
    describe('[ERC223] Zone.claimFreeZone(address _from, uint _dthAmount)', () => {
      it('[error] -- country is disabled', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        const zoneInstance = await createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_GEOHASH);
        await zoneInstance.release({ from: user1 });
        await geoInstance.disableCountry(COUNTRY_CG, { from: owner });
        await expectRevert2(
          claimFreeZone(user2, MIN_ZONE_DTH_STAKE + 1, zoneInstance.address),
          'country is disabled',
        );
      });
      it('[error] -- cannot claim zone which has an owner', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        const zoneInstance = await createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_GEOHASH);
        await expectRevert2(
          claimFreeZone(user2, MIN_ZONE_DTH_STAKE + 1, zoneInstance.address),
          'can not claim zone with owner',
        );
      });
      it('[error] -- cannot claim free zone for minimum stake - 1', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        const zoneInstance = await createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_GEOHASH);
        await timeTravel(COOLDOWN_PERIOD + 1);
        await zoneInstance.release({ from: user1 });
        await expectRevert2(
          claimFreeZone(user1, MIN_ZONE_DTH_STAKE - 1, zoneInstance.address),
          'need at least minimum zone stake amount (100 DTH)',
        );
      });
      it('[success] -- can claim free zone for minimum stake', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        const zoneInstance = await createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_GEOHASH);
        await timeTravel(COOLDOWN_PERIOD + 1);
        await zoneInstance.release({ from: user1 });
        await claimFreeZone(user1, MIN_ZONE_DTH_STAKE, zoneInstance.address);
      });
    });

    describe('[ERC223] Zone.bid(address _from, uint _dthAmount)', () => {
      describe('when Zone just got created (owned by @user1)', () => {
        let zoneInstance;

        beforeEach(async () => {
          // create a zone with a zone owner
          await enableAndLoadCountry(COUNTRY_CG);
          zoneInstance = await createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_GEOHASH);
        });
        it('[error] -- @user2 (challenger1) cooldown period has not yet ended', async () => {
          await expectRevert2(
            placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address),
            'cooldown period did not end yet',
          );
        });
        describe('when Zone cooldown period ended', () => {
          beforeEach(async () => {
            await timeTravel(COOLDOWN_PERIOD + 1);
          });
          it('[error] -- @user1 (current zone owner) cannot start auction', async () => {
            await expectRevert2(
              placeBid(user1, 10, zoneInstance.address),
              'zoneowner cannot start an auction',
            );
          });
          it('[error] -- @user2 (challenger1) bid amount is less than current zone stake', async () => {
            await expectRevert2(
              placeBid(user2, MIN_ZONE_DTH_STAKE - 10, zoneInstance.address),
              'bid is lower than current zone stake',
            );
          });
          it('[error] -- @user2 country is disabled', async () => {
            await geoInstance.disableCountry(COUNTRY_CG, { from: owner });
            await expectRevert2(
              placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address),
              'country is disabled',
            );
          });
          it('[success] ++ @user2 (challenger1) can start auction if bid higher than current', async () => {
            await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address);
            const user2DthBalance = await dthInstance.balanceOf(user2);
            const zoneDthBalance = await dthInstance.balanceOf(zoneInstance.address);
            expect(user2DthBalance.toString(), 'user2 balance should have decreased by bid amount').to.equal(wei(0));
            // bidMinusEntryFee = 108.9; // 1% of 110 = 1,1
            expect(zoneDthBalance.gt(wei(206)) && zoneDthBalance.lt(wei(208)), 'zone balance (minus harberger taxes) should have increased by bid amount (minus entry fee)').to.equal(true);
          });
          describe('when @user2 (challenger1) started an Auction for this Zone', () => {
            beforeEach(async () => {
              await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address);
            });
            it('[error] -- @user1 (current zone owner) bid amount is less than current highest', async () => {
              await expectRevert2(
                placeBid(user1, 5, zoneInstance.address),
                'bid + already staked is less than current highest',
              );
            });
            it('[error] -- @user2 (challenger1) current highest bidder cannot bid', async () => {
              await expectRevert2(
                placeBid(user2, 10, zoneInstance.address),
                'highest bidder cannot bid',
              );
            });
            it('[error] -- @user3 (challenger2) bid amount is less than current highest', async () => {
              await expectRevert2(
                placeBid(user3, MIN_ZONE_DTH_STAKE + 5, zoneInstance.address),
                'bid is less than current highest',
              );
            });
            it('[error] -- @user1 country is disabled', async () => {
              await geoInstance.disableCountry(COUNTRY_CG, { from: owner });
              await expectRevert2(
                placeBid(user1, 20, zoneInstance.address),
                'country is disabled',
              );
            });
            it('[error] -- @user3 country is disabled', async () => {
              await geoInstance.disableCountry(COUNTRY_CG, { from: owner });
              await expectRevert2(
                placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address),
                'country is disabled',
              );
            });
            it('[success] ++ @user1 (current zone owner) can overbid challenger1', async () => {
              await placeBid(user1, 20, zoneInstance.address);
              const user1DthBalance = await dthInstance.balanceOf(user1);
              const zoneDthBalance = await dthInstance.balanceOf(zoneInstance.address);
              expect(user1DthBalance.toString(), 'user1 balance should have decreased by bid amount').to.equal(wei(0));
              expect(zoneDthBalance.gt(wei(226)) && zoneDthBalance.lt(wei(228)), 'zone balance (minus harberger taxes) should have increased by bid amount (minus entry fee)').to.equal(true);
              // expect(zoneDthBalance.toString(), 'zone balance should have increased by bid amount').to.equal(wei(initialZoneDthBalance + challenger1bidMinusEntryFee + bid));
            });
            it('[success] ++ @user3 (challenger2) can overbid challenger1', async () => {
              const bid = MIN_ZONE_DTH_STAKE + 20; // 1% of 120 = 1,2 = 118,8
              const bidMinusEntryFee = 118.8; // 1% of 120 = 1,2 = 118,8
              await placeBid(user3, bid, zoneInstance.address);
              const user3DthBalance = await dthInstance.balanceOf(user3);
              const zoneDthBalance = await dthInstance.balanceOf(zoneInstance.address);
              expect(user3DthBalance.toString(), 'user3 balance should have decreased by bid amount').to.equal(wei(0));
              expect(zoneDthBalance.gt(wei(206 + bidMinusEntryFee)) && zoneDthBalance.lt(wei(208 + bidMinusEntryFee)), 'zone balance (minus harberger taxes) should have increased by bid amount (minus entry fee)').to.equal(true);
            });
            describe('when @user3 (challenger2) also placed a bid in the Auction for this Zone', () => {
              const challenger2bidMinusEntryFee = 118.8; // 1% of 120 = 1,2

              beforeEach(async () => {
                await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address);
              });
              it('[error] -- @user1 (current zone owner) bid amount is less than current highest', async () => {
                await expectRevert2(
                  placeBid(user1, 5, zoneInstance.address),
                  'bid + already staked is less than current highest',
                );
              });
              it('[error] -- @user2 (challenger1) bid amount is less than current highest', async () => {
                await expectRevert2(
                  placeBid(user2, 5, zoneInstance.address),
                  'bid is less than current highest',
                );
              });
              it('[error] -- @user3 (challenger2) current highest bidder cannot bid', async () => {
                await expectRevert2(
                  placeBid(user3, 10, zoneInstance.address),
                  'highest bidder cannot bid',
                );
              });
              it('[error] -- @user1 country is disabled', async () => {
                await geoInstance.disableCountry(COUNTRY_CG, { from: owner });
                await expectRevert2(
                  placeBid(user1, 25, zoneInstance.address),
                  'country is disabled',
                );
              });
              it('[error] -- @user2 country is disabled', async () => {
                await geoInstance.disableCountry(COUNTRY_CG, { from: owner });
                await expectRevert2(
                  placeBid(user2, 10, zoneInstance.address),
                  'country is disabled',
                );
              });
              it('[success] ++ @user1 (current zone owner) can overbid challenger2', async () => {
                await placeBid(user1, 25, zoneInstance.address);
                const user1DthBalance = await dthInstance.balanceOf(user1);
                const zoneDthBalance = await dthInstance.balanceOf(zoneInstance.address);
                expect(user1DthBalance.toString(), 'user1 balance should have decreased by bid amount').to.equal(wei(0));
                expect(zoneDthBalance.gt(wei(206 + challenger2bidMinusEntryFee + 25)) && zoneDthBalance.lt(wei(208 + challenger2bidMinusEntryFee + 25)), 'zone balance (minus harberger taxes) should have increased by bid amount (minus entry fee)').to.equal(true);
              });
              it('[success] ++ @user2 (challenger1) can overbid challenger2', async () => {
                await placeBid(user2, 10, zoneInstance.address);
                const user2DthBalance = await dthInstance.balanceOf(user2);
                const zoneDthBalance = await dthInstance.balanceOf(zoneInstance.address);
                expect(user2DthBalance.toString(), 'user2 balance should have decreased by bid amount').to.equal(wei(0));
                expect(zoneDthBalance.gt(wei(206 + challenger2bidMinusEntryFee + 10)) && zoneDthBalance.lt(wei(208 + challenger2bidMinusEntryFee + 10)), 'zone balance (minus harberger taxes) should have increased by bid amount (minus entry fee)').to.equal(true);
              });
            });
          });
        });
      });
    });

    describe('[ERC223] Zone.topUp(address _from, uint _dthAmount)', () => {
      it('[error] -- country is disabled', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        const zoneInstance = await createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_GEOHASH);
        await geoInstance.disableCountry(COUNTRY_CG, { from: owner });
        await expectRevert2(
          topUp(user1, 10, zoneInstance.address),
          'country is disabled',
        );
      });
      it('[error] -- there is no zone owner', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        const zoneInstance = await createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_GEOHASH);
        await zoneInstance.release({ from: user1 });
        await expectRevert2(
          topUp(user1, 10, zoneInstance.address),
          'zone has no owner',
        );
      });
      it('[error] -- caller is not the zone owner', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        const zoneInstance = await createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_GEOHASH);
        await expectRevert2(
          topUp(user2, 20, zoneInstance.address),
          'caller is not zone owner',
        );
      });
      it('[error] -- can not topUp while running auction', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        const zoneInstance = await createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_GEOHASH);
        await timeTravel(COOLDOWN_PERIOD + 1);
        await placeBid(user2, 110, zoneInstance.address);
        await expectRevert2(
          topUp(user1, 110, zoneInstance.address),
          'cannot top up while auction running',
        );
      });
      it('[successs] -- zone owner can top up if there is no running auction', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        const zoneInstance = await createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_GEOHASH);
        await topUp(user1, 10, zoneInstance.address);
      });
    });

    describe('Zone.release()', () => {
      it('[error] -- country is disabled', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        const zoneInstance = await createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_GEOHASH);
        await geoInstance.disableCountry(COUNTRY_CG, { from: owner });
        await expectRevert(
          zoneInstance.release({ from: user1 }),
          'country is disabled',
        );
      });
      it('[error] -- there is no zone owner', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        const zoneInstance = await createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_GEOHASH);
        await zoneInstance.release({ from: user1 });
        await expectRevert(
          zoneInstance.release({ from: user1 }),
          'zone has no owner',
        );
      });
      it('[error] -- caller is not the zone owner', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        const zoneInstance = await createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_GEOHASH);
        await expectRevert(
          zoneInstance.release({ from: user2 }),
          'caller is not zone owner',
        );
      });
      it('[error] -- can not release while running auction', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        const zoneInstance = await createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_GEOHASH);
        await timeTravel(COOLDOWN_PERIOD + 1);
        await placeBid(user2, 110, zoneInstance.address);
        await expectRevert(
          zoneInstance.release({ from: user1 }),
          'cannot release while auction running',
        );
      });
      it('[successs] -- zone owner can release if there is no running auction', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        const zoneInstance = await createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_GEOHASH);
        await zoneInstance.release({ from: user1 });
      });
    });

    describe('Zone.withdrawFromAuction(uint _auctionId)', () => {
      it('TODO', () => true);
    });
    describe('Zone.withdrawFromAuctions(uint[] _auctionIds)', () => {
      it('TODO', () => true);
    });
    describe('Zone.withdrawFromAllAuctions()', () => {
      it('TODO', () => true);
    });

    describe('TELLER', () => {
      describe('Zone.addTeller(bytes10 _position, int8 _currencyId, bytes16 _messenger, int16 _sellRate, int16 _buyRate, bytes1 _settings)', () => {
        it('TODO', () => true);
      });
      describe('Zone.addFunds(uint _amount)', () => {
        it('TODO', () => true);
      });
      describe('Zone.sellEth(address _to, uint _amount)', () => {
        it('TODO', () => true);
      });
    });
  });

  describe('>>> Zone Getters', () => {
    describe('[ pure ]', () => {
      let zoneInstance;

      beforeEach(async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        zoneInstance = await createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_GEOHASH);
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
      describe('Zone.calcHarbergerTax(uint _startTime, uint _endTime, uint _dthAmount)', () => {
        it('[tax 1 hour] stake 100 dth ', async () => {
          const res = await zoneInstance.calcHarbergerTax(0, ONE_HOUR, wei(100));
          expect(res[0].toString()).to.equal('41666666666666666');
          expect(res[1].toString()).to.equal('99958333333333333334');
        });
        it('[tax 1 day] stake 100 dth ', async () => {
          // with tax being 1% per day, this test should return 1DTH tax2pay after exactly 24 hours
          const res = await zoneInstance.calcHarbergerTax(0, ONE_DAY, wei(100));
          expect(res[0].toString()).to.equal(wei(1));
          expect(res[1].toString()).to.equal(wei(99));
        });
        it('returns correct result for 101 dth', async () => {
          const res = await zoneInstance.calcHarbergerTax(0, ONE_DAY, wei(101));
          expect(res[0].toString()).to.equal(wei(1.01));
          expect(res[1].toString()).to.equal(wei(99.99));
        });
        it('returns correct result 15 second tax time', async () => {
          const res = await zoneInstance.calcHarbergerTax(0, 15, wei(100));
          expect(res[0].toString()).to.equal('173611111111111');
          expect(res[1].toString()).to.equal('99999826388888888889');
        });
      });
    });
    describe('[ view ]', () => {
      describe('Zone.getLastAuction()', () => {
        describe('when Zone just got created (owned by @user1)', () => {
          let zoneInstance;

          beforeEach(async () => {
            await enableAndLoadCountry(COUNTRY_CG);
            zoneInstance = await createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_GEOHASH);
          });
          it('returns correct Auction 0 Sentinel values', async () => {
            const lastAuction = await zoneInstance.getLastAuction();
            expect(lastAuction[0].toNumber(), 'lastAuction.id should be zero').to.equal(0);
            expect(lastAuction[1].toNumber(), 'lastAuction.state should equal Ended(=1)').to.equal(1);
            expect(lastAuction[2].toNumber(), 'lastAuction.endTime should be greater than 0').to.not.equal(0);
            expect(lastAuction[2].toNumber(), 'lastAuction.endTime should equal auction.startTime').to.equal(lastAuction[3].toNumber());
            expect(lastAuction[4], 'lastAuction.highestBidder should equal @user1').to.equal(user1.toLowerCase());
          });
          describe('when Zone cooldown period ended', () => {
            beforeEach(async () => {
              await timeTravel(COOLDOWN_PERIOD + ONE_HOUR);
            });
            describe('when @user2 (challenger1) started an Auction for this Zone', () => {
              beforeEach(async () => {
                await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address);
              });
              it('returns correct newly created Auction 1 values', async () => {
                const lastAuction = await zoneInstance.getLastAuction();
                expect(lastAuction[0].toNumber(), 'lastAuction.id should be 1').to.equal(1);
                expect(lastAuction[1].toNumber(), 'lastAuction.state should equal Started(=0)').to.equal(0);
                expect(lastAuction[2].toNumber(), 'lastAuction.endTime should be greater than 0').to.not.equal(0);
                expect(lastAuction[3].gt(lastAuction[2]), 'lastAuction.endTime should be bigger than auction.startTime').to.equal(true);
                expect(lastAuction[4], 'lastAuction.highestBidder should equal @user2').to.equal(user2.toLowerCase());
              });
              describe('when @user1 (current zone owner) places a counter bid', () => {
                beforeEach(async () => {
                  await placeBid(user1, 20, zoneInstance.address);
                });
                it('returns correct updated (highestBidder) Auction 1 values', async () => {
                  const lastAuction = await zoneInstance.getLastAuction();
                  expect(lastAuction[0].toNumber(), 'lastAuction.id should be 1').to.equal(1);
                  expect(lastAuction[1].toNumber(), 'lastAuction.state should equal Started(=0)').to.equal(0);
                  expect(lastAuction[2].toNumber(), 'lastAuction.endTime should be greater than 0').to.not.equal(0);
                  expect(lastAuction[3].gt(lastAuction[2]), 'lastAuction.endTime should be bigger than auction.startTime').to.equal(true);
                  expect(lastAuction[4], 'lastAuction.highestBidder should equal @user1').to.equal(user1.toLowerCase());
                });
                describe('when @user2 (challenger1) places a counter bid', () => {
                  beforeEach(async () => {
                    await placeBid(user2, 20, zoneInstance.address);
                  });
                  it('returns correct updated (highestBidder) Auction 1 values', async () => {
                    const lastAuction = await zoneInstance.getLastAuction();
                    expect(lastAuction[0].toNumber(), 'lastAuction.id should be 1').to.equal(1);
                    expect(lastAuction[1].toNumber(), 'lastAuction.state should equal Started(=0)').to.equal(0);
                    expect(lastAuction[2].toNumber(), 'lastAuction.endTime should be greater than 0').to.not.equal(0);
                    expect(lastAuction[3].gt(lastAuction[2]), 'lastAuction.endTime should be bigger than auction.startTime').to.equal(true);
                    expect(lastAuction[4], 'lastAuction.highestBidder should equal @user2').to.equal(user2.toLowerCase());
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
                          await placeBid(user3, MIN_ZONE_DTH_STAKE + 40, zoneInstance.address);
                        });
                        it('returns correct newly created Auction 2 values', async () => {
                          const lastAuction = await zoneInstance.getLastAuction();
                          expect(lastAuction[0].toNumber(), 'lastAuction.id should be 2').to.equal(2);
                          expect(lastAuction[1].toNumber(), 'lastAuction.state should equal Started(=0)').to.equal(0);
                          expect(lastAuction[2].toNumber(), 'lastAuction.endTime should be greater than 0').to.not.equal(0);
                          expect(lastAuction[3].gt(lastAuction[2]), 'lastAuction.endTime should be bigger than auction.startTime').to.equal(true);
                          expect(lastAuction[4], 'lastAuction.highestBidder should equal @user3').to.equal(user3.toLowerCase());
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
