/* eslint-env mocha */
/* global artifacts, contract */
/* eslint-disable max-len, no-multi-spaces, no-unused-expressions */

// https://medium.com/@gus_tavo_guim/beautifying-your-smart-contract-tests-with-javascript-4d284efcb2e8

const DetherToken = artifacts.require('DetherToken.sol');
const Control = artifacts.require('Control.sol');
const FakeExchangeRateOracle = artifacts.require('FakeExchangeRateOracle.sol');
const SmsCertifier = artifacts.require('SmsCertifier.sol');
const KycCertifier = artifacts.require('KycCertifier.sol');
const Users = artifacts.require('Users.sol');
const GeoRegistry = artifacts.require('GeoRegistry.sol');
const ZoneFactory = artifacts.require('ZoneFactory.sol');
const Zone = artifacts.require('Zone.sol');

const BigNumber = require('bignumber.js');
const Web3 = require('web3');

const expect = require('../utils/chai');
const TimeTravel = require('../utils/timeTravel');
const { addCountry } = require('../utils/geo');
const { ethToWei, asciiToHex } = require('../utils/convert');
const { expectRevert, expectRevert2 } = require('../utils/evmErrors');
const { getRandomBytes32 } = require('../utils/ipfs');
const {
  BYTES7_ZERO, VALID_CG_ZONE_GEOHASH, INVALID_CG_ZONE_GEOHASH, MIN_ZONE_DTH_STAKE,
  ONE_HOUR, ONE_DAY, BID_PERIOD, COOLDOWN_PERIOD, ADDRESS_ZERO, BYTES32_ZERO,
  BYTES1_ZERO, BYTES12_ZERO, BYTES16_ZERO, ZONE_AUCTION_STATE_STARTED,
  ZONE_AUCTION_STATE_ENDED, TELLER_CG_POSITION, TELLER_CG_CURRENCY_ID,
  TELLER_CG_MESSENGER, TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS,
} = require('../utils/values');

const web3 = new Web3('http://localhost:8545');
const timeTravel = new TimeTravel(web3);

const getLastBlockTimestamp = async () => (await web3.eth.getBlock('latest')).timestamp;

const createDthZoneCreateData = (zoneFactoryAddr, bid, countryCode, geohash) => {
  const fnSig = web3.eth.abi.encodeFunctionSignature('transfer(address,uint256,bytes)');
  const params = web3.eth.abi.encodeParameters(
    ['address', 'uint256', 'bytes'],
    [zoneFactoryAddr, ethToWei(bid), `0x40${countryCode.slice(2)}${geohash.slice(2)}`],
  );
  return [fnSig, params.slice(2)].join('');
};
const createDthZoneClaimFreeData = (zoneFactoryAddr, dthAmount) => {
  const fnSig = web3.eth.abi.encodeFunctionSignature('transfer(address,uint256,bytes)');
  const params = web3.eth.abi.encodeParameters(
    ['address', 'uint256', 'bytes'],
    [zoneFactoryAddr, ethToWei(dthAmount), '0x41'],
  );
  return [fnSig, params.slice(2)].join('');
};
const createDthZoneBidData = (zoneAddr, bid) => {
  const fnSig = web3.eth.abi.encodeFunctionSignature('transfer(address,uint256,bytes)');
  const params = web3.eth.abi.encodeParameters(
    ['address', 'uint256', 'bytes'],
    [zoneAddr, ethToWei(bid), '0x42'],
  );
  return [fnSig, params.slice(2)].join('');
};
const createDthZoneTopUpData = (zoneAddr, dthAmount) => {
  const fnSig = web3.eth.abi.encodeFunctionSignature('transfer(address,uint256,bytes)');
  const params = web3.eth.abi.encodeParameters(
    ['address', 'uint256', 'bytes'],
    [zoneAddr, ethToWei(dthAmount), '0x43'],
  );
  return [fnSig, params.slice(2)].join('');
};

const COUNTRY_CG = 'CG';

const zoneOwnerToObj = zoneOwnerArr => ({
  addr: zoneOwnerArr[0],
  startTime: zoneOwnerArr[1],
  staked: zoneOwnerArr[2],
  balance: zoneOwnerArr[3],
  lastTaxTime: zoneOwnerArr[4],
  auctionId: zoneOwnerArr[5],
});
const zoneOwnerToObjPretty = zoneOwnerArr => ({
  addr: zoneOwnerArr[0],
  startTime: zoneOwnerArr[1].toString(),
  staked: zoneOwnerArr[2].toString(),
  balance: zoneOwnerArr[3].toString(),
  lastTaxTime: zoneOwnerArr[4].toString(),
  auctionId: zoneOwnerArr[5].toString(),
});

const tellerToObj = tellerArr => ({
  currencyId: tellerArr[0],
  messenger: tellerArr[1],
  position: tellerArr[2],
  settings: tellerArr[3],
  buyRate: tellerArr[4],
  sellRate: tellerArr[5],
  funds: tellerArr[6],
  referrer: tellerArr[7],
});

const auctionToObj = auctionArr => ({
  id: auctionArr[0],
  state: auctionArr[1],
  startTime: auctionArr[2],
  endTime: auctionArr[3],
  highestBidder: auctionArr[4],
  highestBid: auctionArr[5],
});
const auctionToObjPretty = auctionArr => ({
  id: auctionArr[0].toString(),
  state: auctionArr[1].toString(),
  startTime: auctionArr[2].toString(),
  endTime: auctionArr[3].toString(),
  highestBidder: auctionArr[4],
  highestBid: auctionArr[5].toString(),
});

contract('ZoneFactory + Zone', () => {
  let owner;
  let user1;
  let user2;
  let user3;
  let user4;
  let user5;

  let __rootState__; // eslint-disable-line no-underscore-dangle

  let controlInstance;
  let smsInstance;
  let kycInstance;
  let dthInstance;
  let priceInstance;
  let usersInstance;
  let geoInstance;
  let zoneFactoryInstance;
  let zoneImplementationInstance;

  before(async () => {
    __rootState__ = await timeTravel.saveState();
    ([owner, user1, user2, user3, user4, user5] = (await web3.eth.getAccounts()).map(a => a.toLowerCase()));
  });

  beforeEach(async () => {
    await timeTravel.revertState(__rootState__); // to go back to real time
    dthInstance = await DetherToken.new({ from: owner });
    priceInstance = await FakeExchangeRateOracle.new({ from: owner }); // TODO: let CEO update oracle?
    controlInstance = await Control.new({ from: owner });
    smsInstance = await SmsCertifier.new(controlInstance.address, { from: owner });
    kycInstance = await KycCertifier.new(controlInstance.address, { from: owner });
    geoInstance = await GeoRegistry.new(controlInstance.address, { from: owner });

    zoneImplementationInstance = await Zone.new({ from: owner });

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
      zoneImplementationInstance.address,
      { from: owner },
    );

    await usersInstance.setZoneFactory(zoneFactoryInstance.address, { from: owner });
    await smsInstance.addDelegate(owner, { from: owner });
  });

  const createZone = async (from, dthAmount, countryCode, geohash) => {
    await dthInstance.mint(from, ethToWei(dthAmount), { from: owner });
    const tx = await web3.eth.sendTransaction({
      from,
      to: dthInstance.address,
      data: createDthZoneCreateData(zoneFactoryInstance.address, dthAmount, asciiToHex(countryCode), asciiToHex(geohash)),
      value: 0,
      gas: 4700000,
    });
    const zoneInstance = await Zone.at(`0x${tx.logs[1].topics[1].slice(-40)}`);
    return zoneInstance;
  };

  const placeBid = async (from, dthAmount, zoneAddress) => {
    await dthInstance.mint(from, ethToWei(dthAmount), { from: owner });
    const tx = await web3.eth.sendTransaction({
      from,
      to: dthInstance.address,
      data: createDthZoneBidData(zoneAddress, dthAmount),
      value: 0,
      gas: 4700000,
    });
    return tx;
  };

  const claimFreeZone = async (from, dthAmount, zoneAddress) => {
    await dthInstance.mint(from, ethToWei(dthAmount), { from: owner });
    const tx = await web3.eth.sendTransaction({
      from,
      to: dthInstance.address,
      data: createDthZoneClaimFreeData(zoneAddress, dthAmount),
      value: 0,
      gas: 4700000,
    });
    return tx;
  };

  const topUp = async (from, dthAmount, zoneAddress) => {
    await dthInstance.mint(from, ethToWei(dthAmount), { from: owner });
    const tx = await web3.eth.sendTransaction({
      from,
      to: dthInstance.address,
      data: createDthZoneTopUpData(zoneAddress, dthAmount),
      value: 0,
      gas: 4700000,
    });
    return tx;
  };

  const enableAndLoadCountry = async (countryCode) => {
    await addCountry(owner, web3, geoInstance, countryCode, 300);
    await geoInstance.enableCountry(countryCode, { from: owner });
  };

  describe('>>> deploying a Zone', () => {
    describe('[ERC223] ZoneFactory.createAndClaim(bytes2 _country, bytes7 _geohash, uint _dthAmount)', () => {
      it('should revert if global pause enabled', async () => {
        await controlInstance.pause({ from: owner });
        await expectRevert2(
          createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_CG_ZONE_GEOHASH),
          'contract is paused',
        );
      });
      it('should revert if country is disabled', async () => {
        await expectRevert2(
          createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_CG_ZONE_GEOHASH),
          'country is disabled',
        );
      });
      it('should revert if creating a zone with geohash 0x0', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        await expectRevert2(
          createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, BYTES7_ZERO),
          'createAndClaim expects 10 bytes as data',
        );
      });
      it('should revert if zone is not inside country', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        await expectRevert2(
          createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, INVALID_CG_ZONE_GEOHASH),
          'zone is not inside country',
        );
      });
      it('should revert if zone already exists', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        await createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_CG_ZONE_GEOHASH);
        await expectRevert2(
          createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_CG_ZONE_GEOHASH),
          'zone already exists',
        );
      });
      it(`should revert if creating a zone with dthAmount minimum - 1 (${MIN_ZONE_DTH_STAKE - 1} DTH)`, async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        await expectRevert2(
          createZone(user1, MIN_ZONE_DTH_STAKE - 1, COUNTRY_CG, VALID_CG_ZONE_GEOHASH),
          'zone dth stake shoulld be at least minimum (100DTH)',
        );
      });
      it('should succeed otherwise', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        await dthInstance.mint(user1, ethToWei(MIN_ZONE_DTH_STAKE), { from: owner });
        const tx = await web3.eth.sendTransaction({
          from: user1,
          to: dthInstance.address,
          data: createDthZoneCreateData(zoneFactoryInstance.address, MIN_ZONE_DTH_STAKE, asciiToHex(COUNTRY_CG), asciiToHex(VALID_CG_ZONE_GEOHASH)),
          value: 0,
          gas: 4700000,
        });
        const zoneInstance = await Zone.at(`0x${tx.logs[1].topics[1].slice(-40)}`);
        // console.log('create zone gas used:', addNumberDots(tx.gasUsed));

        expect(dthInstance.balanceOf(user1)).to.eventually.be.bignumber.equal(0);
        expect(dthInstance.balanceOf(zoneFactoryInstance.address)).to.eventually.be.bignumber.equal(0);
        expect(dthInstance.balanceOf(zoneInstance.address)).to.eventually.be.bignumber.equal(ethToWei(MIN_ZONE_DTH_STAKE));

        expect(zoneFactoryInstance.geohashToZone(asciiToHex(VALID_CG_ZONE_GEOHASH))).to.eventually.equal(zoneInstance.address);
        expect(zoneFactoryInstance.zoneToGeohash(zoneInstance.address)).to.eventually.equal(asciiToHex(VALID_CG_ZONE_GEOHASH));
        expect(zoneFactoryInstance.zoneExists(asciiToHex(VALID_CG_ZONE_GEOHASH))).to.eventually.be.true;

        expect(zoneInstance.auctionExists('0')).to.eventually.be.false;
        expect(zoneInstance.auctionExists('1')).to.eventually.be.false;

        const zoneOwner = zoneOwnerToObj(await zoneInstance.getZoneOwner());
        const lastAuction = auctionToObj(await zoneInstance.getLastAuction());

        const lastBlockTimestamp = await getLastBlockTimestamp();

        expect(zoneOwner.addr).to.equal(user1);
        expect(zoneOwner.startTime).to.be.bignumber.equal(lastBlockTimestamp);
        expect(zoneOwner.lastTaxTime).to.be.bignumber.equal(lastBlockTimestamp);
        expect(zoneOwner.staked).to.be.bignumber.equal(ethToWei(MIN_ZONE_DTH_STAKE));
        expect(zoneOwner.balance).to.be.bignumber.equal(ethToWei(MIN_ZONE_DTH_STAKE));
        expect(zoneOwner.auctionId).to.be.bignumber.equal(0);

        expect(lastAuction.id).to.be.bignumber.equal(0);
        expect(lastAuction.state).to.be.bignumber.equal(ZONE_AUCTION_STATE_STARTED);
        expect(lastAuction.startTime).to.be.bignumber.equal(0);
        expect(lastAuction.endTime).to.be.bignumber.equal(0);
        expect(lastAuction.highestBidder).to.equal(ADDRESS_ZERO);
        expect(lastAuction.highestBid).to.be.bignumber.equal(0);
      });
    });
  });

  describe('Setters', () => {
    let zoneInstance;
    beforeEach(async () => {
      // create a zone with a zone owner
      await enableAndLoadCountry(COUNTRY_CG);
      zoneInstance = await createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_CG_ZONE_GEOHASH);
      await geoInstance.setCountryTierDailyLimit(COUNTRY_CG, '0', '1000', { from: owner });
    });
    describe('AUCTION', () => {
      describe('[ERC223] Zone.claimFreeZone(address _from, uint _dthAmount)', () => {
        it('should revert if global pause enabled', async () => {
          await zoneInstance.release({ from: user1 });
          await controlInstance.pause({ from: owner });
          await expectRevert2(
            claimFreeZone(user2, MIN_ZONE_DTH_STAKE + 1, zoneInstance.address),
            'contract is paused',
          );
        });
        it('should revert if country is disabled', async () => {
          await zoneInstance.release({ from: user1 });
          await geoInstance.disableCountry(COUNTRY_CG, { from: owner });
          await expectRevert2(
            claimFreeZone(user2, MIN_ZONE_DTH_STAKE + 1, zoneInstance.address),
            'country is disabled',
          );
        });
        it('should revert if cannot claim zone which has an owner', async () => {
          await expectRevert2(
            claimFreeZone(user2, MIN_ZONE_DTH_STAKE + 1, zoneInstance.address),
            'can not claim zone with owner',
          );
        });
        it('should revert if cannot claim free zone for minimum stake - 1', async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + 1);
          await zoneInstance.release({ from: user1 });
          await expectRevert2(
            claimFreeZone(user1, MIN_ZONE_DTH_STAKE - 1, zoneInstance.address),
            'need at least minimum zone stake amount (100 DTH)',
          );
        });
        it('should succeed if can claim free zone for minimum stake', async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + 1);
          await zoneInstance.release({ from: user1 });
          await claimFreeZone(user2, MIN_ZONE_DTH_STAKE, zoneInstance.address);

          expect(dthInstance.balanceOf(user2)).to.eventually.be.bignumber.equal(0);
          expect(dthInstance.balanceOf(zoneFactoryInstance.address)).to.eventually.be.bignumber.equal(0);
          expect(dthInstance.balanceOf(zoneInstance.address)).to.eventually.be.bignumber.equal(ethToWei(MIN_ZONE_DTH_STAKE));

          expect(zoneFactoryInstance.geohashToZone(asciiToHex(VALID_CG_ZONE_GEOHASH))).to.eventually.equal(zoneInstance.address);
          expect(zoneFactoryInstance.zoneToGeohash(zoneInstance.address)).to.eventually.equal(asciiToHex(VALID_CG_ZONE_GEOHASH));
          expect(zoneFactoryInstance.zoneExists(asciiToHex(VALID_CG_ZONE_GEOHASH))).to.eventually.be.true;

          expect(zoneInstance.auctionExists('0')).to.eventually.be.false;
          expect(zoneInstance.auctionExists('1')).to.eventually.be.false;

          const zoneOwner = zoneOwnerToObj(await zoneInstance.getZoneOwner());
          const lastAuction = auctionToObj(await zoneInstance.getLastAuction());

          const lastBlockTimestamp = await getLastBlockTimestamp();

          expect(zoneOwner.addr).to.equal(user2);
          expect(zoneOwner.startTime).to.be.bignumber.equal(lastBlockTimestamp);
          expect(zoneOwner.lastTaxTime).to.be.bignumber.equal(lastBlockTimestamp);
          expect(zoneOwner.staked).to.be.bignumber.equal(ethToWei(MIN_ZONE_DTH_STAKE));
          expect(zoneOwner.balance).to.be.bignumber.equal(ethToWei(MIN_ZONE_DTH_STAKE));
          expect(zoneOwner.auctionId).to.be.bignumber.equal(0);

          expect(lastAuction.id).to.be.bignumber.equal(0);
          expect(lastAuction.state).to.be.bignumber.equal(ZONE_AUCTION_STATE_STARTED);
          expect(lastAuction.startTime).to.be.bignumber.equal(0);
          expect(lastAuction.endTime).to.be.bignumber.equal(0);
          expect(lastAuction.highestBidder).to.equal(ADDRESS_ZERO);
          expect(lastAuction.highestBid).to.be.bignumber.equal(0);
        });
      });

      describe('[ERC223] Zone.bid(address _from, uint _dthAmount)', () => {
        it('should revert if cooldown period not yet ended', async () => {
          await expectRevert2(
            placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address),
            'cooldown period did not end yet',
          );
        });
        it('should revert if called by current zone owner', async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + 1);
          await expectRevert2(
            placeBid(user1, 10, zoneInstance.address),
            'zoneowner cannot start an auction',
          );
        });
        it('should revert if country is disabled', async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + 1);
          await geoInstance.disableCountry(COUNTRY_CG, { from: owner });
          await expectRevert2(
            placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address),
            'country is disabled',
          );
        });
        it('should revert if bid (minus burn fee) amount is less than current stake', async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + 1);
          await expectRevert2(
            placeBid(user2, MIN_ZONE_DTH_STAKE, zoneInstance.address),
            'bid is lower than current zone stake',
          );
        });
        it('should succeed if bid (minus burn fee) is higher than current zone stake', async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + 1);
          const oldZoneDthBalance = await dthInstance.balanceOf(zoneInstance.address);
          const bidAmount = MIN_ZONE_DTH_STAKE + 10;
          await placeBid(user2, bidAmount, zoneInstance.address);

          expect(dthInstance.balanceOf(zoneFactoryInstance.address)).to.eventually.be.bignumber.equal(0);
          expect(dthInstance.balanceOf(user2)).to.eventually.be.bignumber.equal(0);
          expect(dthInstance.balanceOf(zoneInstance.address)).to.eventually.be.bignumber.above(oldZoneDthBalance);

          expect(zoneFactoryInstance.geohashToZone(asciiToHex(VALID_CG_ZONE_GEOHASH))).to.eventually.equal(zoneInstance.address);
          expect(zoneFactoryInstance.zoneToGeohash(zoneInstance.address)).to.eventually.equal(asciiToHex(VALID_CG_ZONE_GEOHASH));
          expect(zoneFactoryInstance.zoneExists(asciiToHex(VALID_CG_ZONE_GEOHASH))).to.eventually.be.true;

          expect(zoneInstance.auctionExists('0')).to.eventually.be.false;
          expect(zoneInstance.auctionExists('1')).to.eventually.be.true;
          expect(zoneInstance.auctionExists('2')).to.eventually.be.false;

          const zoneOwner = zoneOwnerToObj(await zoneInstance.getZoneOwner());
          const lastAuction = auctionToObj(await zoneInstance.getLastAuction());

          const lastBlockTimestamp = await getLastBlockTimestamp();

          expect(zoneOwner.addr).to.equal(user1);
          expect(zoneOwner.lastTaxTime).to.be.bignumber.equal(lastBlockTimestamp);
          expect(zoneOwner.staked).to.be.bignumber.equal(ethToWei(MIN_ZONE_DTH_STAKE));
          expect(zoneOwner.balance).to.be.bignumber.below(zoneOwner.staked);
          expect(zoneOwner.auctionId).to.be.bignumber.equal(0);

          expect(lastAuction.id).to.be.bignumber.equal(1);
          expect(lastAuction.state).to.be.bignumber.equal(ZONE_AUCTION_STATE_STARTED);
          expect(lastAuction.startTime).to.be.bignumber.equal(lastBlockTimestamp);
          expect(lastAuction.endTime).to.be.bignumber.equal(lastBlockTimestamp + BID_PERIOD);
          expect(lastAuction.highestBidder).to.equal(user2);
          const [, bidMinusEntryFee] = await zoneInstance.calcEntryFee(ethToWei(bidAmount));
          expect(lastAuction.highestBid).to.be.bignumber.equal(bidMinusEntryFee);
        });
        it('should be possible for a 2nd bidder or the zoneOwner to overbid bidder 1', async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + 1);
          const oldZoneDthBalance1 = await dthInstance.balanceOf(zoneInstance.address);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address);
          const oldZoneDthBalance2 = await dthInstance.balanceOf(zoneInstance.address);
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address);
          const oldZoneDthBalance3 = await dthInstance.balanceOf(zoneInstance.address);
          await placeBid(user1, 30, zoneInstance.address);

          expect(dthInstance.balanceOf(zoneFactoryInstance.address)).to.eventually.be.bignumber.equal(0);
          expect(dthInstance.balanceOf(user1)).to.eventually.be.bignumber.equal(0);
          expect(dthInstance.balanceOf(user2)).to.eventually.be.bignumber.equal(0);
          expect(dthInstance.balanceOf(user3)).to.eventually.be.bignumber.equal(0);
          expect(oldZoneDthBalance1).to.be.bignumber.below(oldZoneDthBalance2);
          expect(oldZoneDthBalance2).to.be.bignumber.below(oldZoneDthBalance3);
          expect(dthInstance.balanceOf(zoneInstance.address)).to.eventually.be.bignumber.above(oldZoneDthBalance3);

          expect(zoneFactoryInstance.geohashToZone(asciiToHex(VALID_CG_ZONE_GEOHASH))).to.eventually.equal(zoneInstance.address);
          expect(zoneFactoryInstance.zoneToGeohash(zoneInstance.address)).to.eventually.equal(asciiToHex(VALID_CG_ZONE_GEOHASH));
          expect(zoneFactoryInstance.zoneExists(asciiToHex(VALID_CG_ZONE_GEOHASH))).to.eventually.be.true;

          expect(zoneInstance.auctionExists('0')).to.eventually.be.false;
          expect(zoneInstance.auctionExists('1')).to.eventually.be.true;
          expect(zoneInstance.auctionExists('2')).to.eventually.be.false;

          const zoneOwner = zoneOwnerToObj(await zoneInstance.getZoneOwner());
          const lastAuction = auctionToObj(await zoneInstance.getLastAuction());

          const lastBlockTimestamp = await getLastBlockTimestamp();

          expect(zoneOwner.addr).to.equal(user1);
          expect(zoneOwner.lastTaxTime).to.be.bignumber.equal(lastBlockTimestamp);
          expect(zoneOwner.staked).to.be.bignumber.equal(ethToWei(MIN_ZONE_DTH_STAKE));
          expect(zoneOwner.balance).to.be.bignumber.below(zoneOwner.staked);
          expect(zoneOwner.auctionId).to.be.bignumber.equal(0);

          expect(lastAuction.id).to.be.bignumber.equal(1);
          expect(lastAuction.state).to.be.bignumber.equal(ZONE_AUCTION_STATE_STARTED);
          expect(lastAuction.startTime).to.be.bignumber.equal(lastBlockTimestamp);
          expect(lastAuction.endTime).to.be.bignumber.equal(lastBlockTimestamp + BID_PERIOD);
          expect(lastAuction.highestBidder).to.equal(user1);
          expect(lastAuction.highestBid).to.be.bignumber.equal(ethToWei(MIN_ZONE_DTH_STAKE + 30));
        });
      });

      describe('[ERC223] Zone.topUp(address _from, uint _dthAmount)', () => {
        it('should revert if global pause enabled', async () => {
          await controlInstance.pause({ from: owner });
          await expectRevert2(
            topUp(user1, 10, zoneInstance.address),
            'contract is paused',
          );
        });
        it('should revert if country is disabled', async () => {
          await geoInstance.disableCountry(COUNTRY_CG, { from: owner });
          await expectRevert2(
            topUp(user1, 10, zoneInstance.address),
            'country is disabled',
          );
        });
        it('should revert if there is no zone owner', async () => {
          await zoneInstance.release({ from: user1 });
          await expectRevert2(
            topUp(user1, 10, zoneInstance.address),
            'zone has no owner',
          );
        });
        it('should revert if caller is not the zone owner', async () => {
          await expectRevert2(
            topUp(user2, 20, zoneInstance.address),
            'caller is not zone owner',
          );
        });
        it('should revert if can not topUp while running auction', async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + 1);
          await placeBid(user2, 110, zoneInstance.address);
          await expectRevert2(
            topUp(user1, 110, zoneInstance.address),
            'cannot top up while auction running',
          );
        });
        it('should succeed if there is no running auction', async () => {
          const oldZoneDthBalance = await dthInstance.balanceOf(zoneInstance.address);
          await topUp(user1, 10, zoneInstance.address);

          expect(dthInstance.balanceOf(zoneFactoryInstance.address)).to.eventually.be.bignumber.equal(0);
          expect(dthInstance.balanceOf(user1)).to.eventually.be.bignumber.equal(0);
          expect(dthInstance.balanceOf(zoneInstance.address)).to.eventually.be.bignumber.above(oldZoneDthBalance);

          expect(zoneFactoryInstance.geohashToZone(asciiToHex(VALID_CG_ZONE_GEOHASH))).to.eventually.equal(zoneInstance.address);
          expect(zoneFactoryInstance.zoneToGeohash(zoneInstance.address)).to.eventually.equal(asciiToHex(VALID_CG_ZONE_GEOHASH));
          expect(zoneFactoryInstance.zoneExists(asciiToHex(VALID_CG_ZONE_GEOHASH))).to.eventually.be.true;

          expect(zoneInstance.auctionExists('0')).to.eventually.be.false;
          expect(zoneInstance.auctionExists('1')).to.eventually.be.false;
          expect(zoneInstance.auctionExists('2')).to.eventually.be.false;

          const zoneOwner = zoneOwnerToObj(await zoneInstance.getZoneOwner());
          const lastAuction = auctionToObj(await zoneInstance.getLastAuction());

          const lastBlockTimestamp = await getLastBlockTimestamp();

          expect(zoneOwner.addr).to.equal(user1);
          expect(zoneOwner.lastTaxTime).to.be.bignumber.equal(lastBlockTimestamp);
          expect(zoneOwner.staked).to.be.bignumber.equal(ethToWei(MIN_ZONE_DTH_STAKE));
          expect(zoneOwner.balance).to.be.bignumber.lte(ethToWei(MIN_ZONE_DTH_STAKE + 10));
          expect(zoneOwner.auctionId).to.be.bignumber.equal(0);

          expect(lastAuction.id).to.be.bignumber.equal(0);
          expect(lastAuction.state).to.be.bignumber.equal(ZONE_AUCTION_STATE_STARTED);
          expect(lastAuction.startTime).to.be.bignumber.equal(0);
          expect(lastAuction.endTime).to.be.bignumber.equal(0);
          expect(lastAuction.highestBidder).to.equal(ADDRESS_ZERO);
          expect(lastAuction.highestBid).to.be.bignumber.equal(0);
        });
      });

      describe('Zone.release()', () => {
        it('should revert if global pause enabled', async () => {
          await controlInstance.pause({ from: owner });
          await expectRevert(
            zoneInstance.release({ from: user1 }),
            'contract is paused',
          );
        });
        it('should revert if caller is not the zone owner', async () => {
          await expectRevert(
            zoneInstance.release({ from: user2 }),
            'caller is not zone owner',
          );
        });
        it('should revert if can not release while running auction', async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + 1);
          await placeBid(user2, 110, zoneInstance.address);
          await expectRevert(
            zoneInstance.release({ from: user1 }),
            'cannot release while auction running',
          );
        });
        it('should succeed if there is no running auction and country is enabled', async () => {
          await zoneInstance.release({ from: user1 });

          expect(dthInstance.balanceOf(zoneFactoryInstance.address)).to.eventually.be.bignumber.equal(0);
          expect(dthInstance.balanceOf(user1)).to.eventually.be.bignumber.above(0);
          expect(dthInstance.balanceOf(zoneInstance.address)).to.eventually.be.bignumber.equal(0);

          expect(zoneFactoryInstance.geohashToZone(asciiToHex(VALID_CG_ZONE_GEOHASH))).to.eventually.equal(zoneInstance.address);
          expect(zoneFactoryInstance.zoneToGeohash(zoneInstance.address)).to.eventually.equal(asciiToHex(VALID_CG_ZONE_GEOHASH));
          expect(zoneFactoryInstance.zoneExists(asciiToHex(VALID_CG_ZONE_GEOHASH))).to.eventually.be.true;

          expect(zoneInstance.auctionExists('0')).to.eventually.be.false;
          expect(zoneInstance.auctionExists('1')).to.eventually.be.false;
          expect(zoneInstance.auctionExists('2')).to.eventually.be.false;

          const zoneOwner = zoneOwnerToObj(await zoneInstance.getZoneOwner());
          const lastAuction = auctionToObj(await zoneInstance.getLastAuction());

          expect(zoneOwner.addr).to.equal(ADDRESS_ZERO);
          expect(zoneOwner.lastTaxTime).to.be.bignumber.equal(0);
          expect(zoneOwner.staked).to.be.bignumber.equal(0);
          expect(zoneOwner.balance).to.be.bignumber.equal(0);
          expect(zoneOwner.auctionId).to.be.bignumber.equal(0);

          expect(lastAuction.id).to.be.bignumber.equal(0);
          expect(lastAuction.state).to.be.bignumber.equal(ZONE_AUCTION_STATE_STARTED);
          expect(lastAuction.startTime).to.be.bignumber.equal(0);
          expect(lastAuction.endTime).to.be.bignumber.equal(0);
          expect(lastAuction.highestBidder).to.equal(ADDRESS_ZERO);
          expect(lastAuction.highestBid).to.be.bignumber.equal(0);
        });
        it('should succeed if there is no running auction and country is disabled', async () => {
          await geoInstance.disableCountry(COUNTRY_CG, { from: owner });
          await zoneInstance.release({ from: user1 });

          expect(dthInstance.balanceOf(zoneFactoryInstance.address)).to.eventually.be.bignumber.equal(0);
          expect(dthInstance.balanceOf(user1)).to.eventually.be.bignumber.above(0);
          expect(dthInstance.balanceOf(zoneInstance.address)).to.eventually.be.bignumber.equal(0);

          expect(zoneFactoryInstance.geohashToZone(asciiToHex(VALID_CG_ZONE_GEOHASH))).to.eventually.equal(zoneInstance.address);
          expect(zoneFactoryInstance.zoneToGeohash(zoneInstance.address)).to.eventually.equal(asciiToHex(VALID_CG_ZONE_GEOHASH));
          expect(zoneFactoryInstance.zoneExists(asciiToHex(VALID_CG_ZONE_GEOHASH))).to.eventually.be.true;

          expect(zoneInstance.auctionExists('0')).to.eventually.be.false;
          expect(zoneInstance.auctionExists('1')).to.eventually.be.false;
          expect(zoneInstance.auctionExists('2')).to.eventually.be.false;

          const zoneOwner = zoneOwnerToObj(await zoneInstance.getZoneOwner());
          const lastAuction = auctionToObj(await zoneInstance.getLastAuction());

          expect(zoneOwner.addr).to.equal(ADDRESS_ZERO);
          expect(zoneOwner.lastTaxTime).to.be.bignumber.equal(0);
          expect(zoneOwner.staked).to.be.bignumber.equal(0);
          expect(zoneOwner.balance).to.be.bignumber.equal(0);
          expect(zoneOwner.auctionId).to.be.bignumber.equal(0);

          expect(lastAuction.id).to.be.bignumber.equal(0);
          expect(lastAuction.state).to.be.bignumber.equal(ZONE_AUCTION_STATE_STARTED);
          expect(lastAuction.startTime).to.be.bignumber.equal(0);
          expect(lastAuction.endTime).to.be.bignumber.equal(0);
          expect(lastAuction.highestBidder).to.equal(ADDRESS_ZERO);
          expect(lastAuction.highestBid).to.be.bignumber.equal(0);
        });
      });

      describe('Zone.withdrawFromAuction(uint _auctionId)', () => {
        it('should revert if global pause enabled', async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address); // loser, can withdraw
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
          await controlInstance.pause({ from: owner });
          await expectRevert(
            zoneInstance.withdrawFromAuction('1', { from: user2 }),
            'contract is paused',
          );
        });
        it('should revert if auction does not exist', async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address); // loser, can withdraw
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
          await expectRevert(
            zoneInstance.withdrawFromAuction('2', { from: user2 }),
            'auctionId does not exist',
          );
        });
        it('should revert if auction is still running', async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address); // loser, can withdraw
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address); // winner
          await expectRevert(
            zoneInstance.withdrawFromAuction('1', { from: user2 }),
            'cannot withdraw while auction is active',
          );
        });
        it('should revert if winning bidder tries to withdraw', async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address); // loser, can withdraw
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
          await expectRevert(
            zoneInstance.withdrawFromAuction('1', { from: user3 }),
            'auction winner can not withdraw',
          );
        });
        it('should revert if nothing to withdraw', async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address); // loser, can withdraw
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
          await zoneInstance.withdrawFromAuction('1', { from: user2 });
          await expectRevert(
            zoneInstance.withdrawFromAuction('1', { from: user2 }),
            'nothing to withdraw',
          );
        });
        it('should succeed while country is enabled', async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address); // loser, can withdraw
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
          await zoneInstance.withdrawFromAuction('1', { from: user2 });
        });
        it('should succeed while country is disabled', async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address); // loser, can withdraw
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
          await geoInstance.disableCountry(COUNTRY_CG, { from: owner });
          await zoneInstance.withdrawFromAuction('1', { from: user2 });
        });
        describe('when succeeds after bid period ended', () => {
          let user1dthBalanceBefore;
          let user2dthBalanceBefore;
          let user3dthBalanceBefore;
          let user2bidAmount;
          let auctionBefore;
          beforeEach(async () => {
            await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
            await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address); // loser, can withdraw
            await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address); // winner
            await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
            user1dthBalanceBefore = await dthInstance.balanceOf(user1);
            user2dthBalanceBefore = await dthInstance.balanceOf(user2);
            user3dthBalanceBefore = await dthInstance.balanceOf(user3);
            user2bidAmount = await zoneInstance.auctionBids('1', user2);
            auctionBefore = auctionToObj(await zoneInstance.getLastAuction());

            await zoneInstance.withdrawFromAuction('1', { from: user2 });
          });
          it('user auction bid should be reset to 0', () => {
            expect(zoneInstance.auctionBids('1', user2)).to.eventually.be.bignumber.equal(0);
          });
          it('user dth balance should have increased by withdrawn bid amount', async () => {
            const user2dthBalanceAfter = await dthInstance.balanceOf(user2);
            const expectedNewDthBalance = user2dthBalanceBefore.plus(user2bidAmount);
            expect(user2dthBalanceAfter).to.be.bignumber.equal(expectedNewDthBalance);
          });
          it('pevious zoneOwner and winning bidder dth balance should not have changed', async () => {
            const user1dthBalanceAfter = await dthInstance.balanceOf(user1);
            const user3dthBalanceAfter = await dthInstance.balanceOf(user3);
            expect(user1dthBalanceAfter).to.be.bignumber.equal(user1dthBalanceBefore);
            expect(user3dthBalanceAfter).to.be.bignumber.equal(user3dthBalanceBefore);
          });
          it('auction state should have changed to Ended', async () => {
            const auctionAfter = auctionToObj(await zoneInstance.getLastAuction());
            expect(auctionAfter.state).to.be.bignumber.equal(ZONE_AUCTION_STATE_ENDED);
          });
          it('all other auction fields should have not changed', async () => {
            const auctionAfter = auctionToObj(await zoneInstance.getLastAuction());
            expect(auctionAfter.id).to.be.bignumber.equal(auctionBefore.id);
            expect(auctionAfter.startTime).to.be.bignumber.equal(auctionBefore.startTime);
            expect(auctionAfter.endTime).to.be.bignumber.equal(auctionBefore.endTime);
            expect(auctionAfter.highestBidder).to.equal(auctionBefore.highestBidder);
            expect(auctionAfter.highestBid).to.be.bignumber.equal(auctionBefore.highestBid);
          });
          it('zoneOwner lastTaxTime should equal auction endTime', async () => {
            const zoneOwnerAfter = zoneOwnerToObj(await zoneInstance.getZoneOwner());
            expect(zoneOwnerAfter.lastTaxTime).to.be.bignumber.equal(auctionBefore.endTime);
          });
          it('zoneOwner addr should be updated to last auction winner', async () => {
            const zoneOwnerAfter = zoneOwnerToObj(await zoneInstance.getZoneOwner());
            expect(zoneOwnerAfter.addr).to.be.bignumber.equal(user3);
          });
          it('zoneOwner stake + balance should be updated to winning bid minus entry fee', async () => {
            const zoneOwnerAfter = zoneOwnerToObj(await zoneInstance.getZoneOwner());
            const [, bidMinusEntryFeeUser3] = await zoneInstance.calcEntryFee(ethToWei(MIN_ZONE_DTH_STAKE + 20));
            expect(zoneOwnerAfter.staked).to.be.bignumber.equal(bidMinusEntryFeeUser3);
            expect(zoneOwnerAfter.balance).to.be.bignumber.equal(bidMinusEntryFeeUser3);
          });
          it('zoneOwner auctionId should be updated to last auction id', async () => {
            const zoneOwnerAfter = zoneOwnerToObj(await zoneInstance.getZoneOwner());
            expect(zoneOwnerAfter.auctionId).to.be.bignumber.equal('1');
          });
        });
      });
      describe('Zone.withdrawFromAuctions(uint[] _auctionIds)', () => {
        it('should revert if global pause enabled', async () => {
          // auction 1
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address); // loser
          await placeBid(user4, MIN_ZONE_DTH_STAKE + 30, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
          // auction 2
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user1, MIN_ZONE_DTH_STAKE + 40, zoneInstance.address); // loser
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 50, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 60, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);

          await controlInstance.pause({ from: owner });
          await expectRevert(
            zoneInstance.withdrawFromAuctions(['1'], { from: user3 }),
            'contract is paused',
          );
        });
        it('should revert if empty auctionIds list arg', async () => {
          // auction 1
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address); // loser
          await placeBid(user4, MIN_ZONE_DTH_STAKE + 30, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
          // auction 2
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user1, MIN_ZONE_DTH_STAKE + 40, zoneInstance.address); // loser
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 50, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 60, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);

          await expectRevert(
            zoneInstance.withdrawFromAuctions([], { from: user3 }),
            'auctionIds list is empty',
          );
        });
        it('should revert if auctionIds list is 1 longer than currentAuctionId', async () => {
          // auction 1
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address); // loser
          await placeBid(user4, MIN_ZONE_DTH_STAKE + 30, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
          // auction 2
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user1, MIN_ZONE_DTH_STAKE + 40, zoneInstance.address); // loser
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 50, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 60, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);

          await expectRevert( // currentAuctionId == 2
            zoneInstance.withdrawFromAuctions(['1', '2', '1'], { from: user3 }),
            'auctionIds list is longer than allowed',
          );
        });

        it('should revert if auctionIds list (len 1) contains nonexistent auctionId', async () => {
          // auction 1
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address); // loser
          await placeBid(user4, MIN_ZONE_DTH_STAKE + 30, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
          // auction 2
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user1, MIN_ZONE_DTH_STAKE + 40, zoneInstance.address); // loser
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 50, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 60, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);

          await expectRevert( // currentAuctionId == 2
            zoneInstance.withdrawFromAuctions(['3'], { from: user3 }),
            'auctionId does not exist',
          );
        });
        it('should revert if auctionIds list (len 2) contains (at start) non-existent auctionId', async () => {
          // auction 1
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address); // loser
          await placeBid(user4, MIN_ZONE_DTH_STAKE + 30, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
          // auction 2
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user1, MIN_ZONE_DTH_STAKE + 40, zoneInstance.address); // loser
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 50, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 60, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);

          await expectRevert( // currentAuctionId == 2
            zoneInstance.withdrawFromAuctions(['3', '1'], { from: user3 }),
            'auctionId does not exist',
          );
        });
        it('should revert if auctionIds list (len 2) contains (at end) non-existent auctionId', async () => {
          // auction 1
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address); // loser
          await placeBid(user4, MIN_ZONE_DTH_STAKE + 30, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
          // auction 2
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user1, MIN_ZONE_DTH_STAKE + 40, zoneInstance.address); // loser
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 50, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 60, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);

          await expectRevert( // currentAuctionId == 2
            zoneInstance.withdrawFromAuctions(['1', '3'], { from: user3 }),
            'auctionId does not exist',
          );
        });
        it('should revert if auctionIds list (len 3) contains (in middle) non-existent auctionId', async () => {
          // auction 1
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address); // loser
          await placeBid(user4, MIN_ZONE_DTH_STAKE + 30, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
          // auction 2
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user1, MIN_ZONE_DTH_STAKE + 40, zoneInstance.address); // loser
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 50, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 60, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
          // auction 3
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user1, MIN_ZONE_DTH_STAKE + 70, zoneInstance.address); // loser
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 80, zoneInstance.address); // loser
          await placeBid(user4, MIN_ZONE_DTH_STAKE + 90, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);

          await expectRevert( // currentAuctionId == 2
            zoneInstance.withdrawFromAuctions(['1', '4', '2'], { from: user3 }),
            'auctionId does not exist',
          );
        });

        it('should revert if auctionIds list (len 1) contains still-running auctionId', async () => {
          // auction 1
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address); // loser
          await placeBid(user4, MIN_ZONE_DTH_STAKE + 30, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
          // auction 2
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user1, MIN_ZONE_DTH_STAKE + 40, zoneInstance.address); // loser
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 50, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 60, zoneInstance.address); // winner
          // await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);

          await expectRevert( // currentAuctionId == 2
            zoneInstance.withdrawFromAuctions(['2'], { from: user3 }),
            'cannot withdraw from running auction',
          );
        });
        it('should revert if auctionIds list (len 2) contains (at start) still-running auctionId', async () => {
          // auction 1
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address); // loser
          await placeBid(user4, MIN_ZONE_DTH_STAKE + 30, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
          // auction 2
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user1, MIN_ZONE_DTH_STAKE + 40, zoneInstance.address); // loser
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 50, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 60, zoneInstance.address); // winner
          // await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);

          await expectRevert(
            zoneInstance.withdrawFromAuctions(['2', '1'], { from: user3 }),
            'cannot withdraw from running auction',
          );
        });
        it('should revert if auctionIds list (len 2) contains (at end) still-running auctionId', async () => {
          // auction 1
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address); // loser
          await placeBid(user4, MIN_ZONE_DTH_STAKE + 30, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
          // auction 2
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user1, MIN_ZONE_DTH_STAKE + 40, zoneInstance.address); // loser
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 50, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 60, zoneInstance.address); // winner
          // await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);

          await expectRevert( // currentAuctionId == 2
            zoneInstance.withdrawFromAuctions(['1', '2'], { from: user3 }),
            'cannot withdraw from running auction',
          );
        });
        it('should revert if auctionIds list (len 3) contains (in middle) still-running auctionId', async () => {
          // auction 1
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address); // loser
          await placeBid(user4, MIN_ZONE_DTH_STAKE + 30, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
          // auction 2
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user1, MIN_ZONE_DTH_STAKE + 40, zoneInstance.address); // loser
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 50, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 60, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);

          // auction 3
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user1, MIN_ZONE_DTH_STAKE + 70, zoneInstance.address); // loser
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 80, zoneInstance.address); // loser
          await placeBid(user4, MIN_ZONE_DTH_STAKE + 90, zoneInstance.address); // winner
          // await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);

          await expectRevert( // currentAuctionId == 3
            zoneInstance.withdrawFromAuctions(['1', '3', '2'], { from: user3 }),
            'cannot withdraw from running auction',
          );
        });
        it.skip('should succeed to withdraw part of a users withdrawable bids', async () => {
          // auction 1
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address); // loser
          await placeBid(user4, MIN_ZONE_DTH_STAKE + 30, zoneInstance.address); // loser
          await placeBid(user5, MIN_ZONE_DTH_STAKE + 40, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
          // auction 2
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user1, MIN_ZONE_DTH_STAKE + 50, zoneInstance.address); // loser
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 60, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 70, zoneInstance.address); // loser
          await placeBid(user4, MIN_ZONE_DTH_STAKE + 80, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
          // auction 3
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user1, MIN_ZONE_DTH_STAKE + 90, zoneInstance.address); // loser
          const lastAuctionBlockTimestamp = await getLastBlockTimestamp();
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 100, zoneInstance.address); // loser
          await placeBid(user5, MIN_ZONE_DTH_STAKE + 110, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 120, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);

          const [, user2bid1MinusEntryFee1] = await zoneInstance.calcEntryFee(ethToWei(MIN_ZONE_DTH_STAKE + 10));
          const [, user2bid1MinusEntryFee3] = await zoneInstance.calcEntryFee(ethToWei(MIN_ZONE_DTH_STAKE + 100));

          // user2 never won an auction

          await zoneInstance.withdrawFromAuctions(['1', '3'], { from: user2 });

          expect(dthInstance.balanceOf(zoneFactoryInstance.address)).to.eventually.be.bignumber.equal(0);
          expect(dthInstance.balanceOf(user1)).to.eventually.be.bignumber.equal(0);
          expect(dthInstance.balanceOf(user2)).to.eventually.be.bignumber.equal(user2bid1MinusEntryFee1.add(user2bid1MinusEntryFee3));
          expect(dthInstance.balanceOf(user3)).to.eventually.be.bignumber.equal(0);
          expect(dthInstance.balanceOf(user4)).to.eventually.be.bignumber.equal(0);
          expect(dthInstance.balanceOf(user5)).to.eventually.be.bignumber.equal(0);
          expect(dthInstance.balanceOf(zoneInstance.address)).to.eventually.be.bignumber.above(0);

          expect(zoneFactoryInstance.geohashToZone(asciiToHex(VALID_CG_ZONE_GEOHASH))).to.eventually.equal(zoneInstance.address);
          expect(zoneFactoryInstance.zoneToGeohash(zoneInstance.address)).to.eventually.equal(asciiToHex(VALID_CG_ZONE_GEOHASH));
          expect(zoneFactoryInstance.zoneExists(asciiToHex(VALID_CG_ZONE_GEOHASH))).to.eventually.be.true;

          expect(zoneInstance.auctionExists('0')).to.eventually.be.false;
          expect(zoneInstance.auctionExists('1')).to.eventually.be.true;
          expect(zoneInstance.auctionExists('2')).to.eventually.be.true;
          expect(zoneInstance.auctionExists('3')).to.eventually.be.true;
          expect(zoneInstance.auctionExists('4')).to.eventually.be.false;

          const zoneOwner = zoneOwnerToObj(await zoneInstance.getZoneOwner());
          const lastAuction = auctionToObj(await zoneInstance.getLastAuction());
          const teller = tellerToObj(await zoneInstance.getTeller());

          const lastBlockTimestamp = await getLastBlockTimestamp();

          expect(zoneOwner.addr).to.equal(user3);
          expect(zoneOwner.lastTaxTime).to.be.bignumber.equal(lastBlockTimestamp);
          const [, bidMinusEntryFeeUser3] = await zoneInstance.calcEntryFee(ethToWei(MIN_ZONE_DTH_STAKE + 120));
          expect(zoneOwner.staked).to.be.bignumber.equal(bidMinusEntryFeeUser3);
          expect(zoneOwner.balance).to.be.bignumber.equal(bidMinusEntryFeeUser3);
          expect(zoneOwner.auctionId).to.be.bignumber.equal(3);

          expect(lastAuction.id).to.be.bignumber.equal(3);
          expect(lastAuction.state).to.be.bignumber.equal(ZONE_AUCTION_STATE_ENDED);
          expect(lastAuction.startTime).to.be.bignumber.equal(lastAuctionBlockTimestamp);
          expect(lastAuction.endTime).to.be.bignumber.equal(lastAuctionBlockTimestamp + BID_PERIOD);
          expect(lastAuction.highestBidder).to.equal(user3);
          expect(lastAuction.highestBid).to.be.bignumber.equal(bidMinusEntryFeeUser3);

          expect(teller.currencyId).to.be.bignumber.equal(0);
          expect(teller.messenger).to.equal(BYTES16_ZERO);
          expect(teller.position).to.equal(BYTES12_ZERO);
          expect(teller.settings).to.equal(BYTES1_ZERO);
          expect(teller.buyRate).to.be.bignumber.equal(0);
          expect(teller.sellRate).to.be.bignumber.equal(0);
          expect(teller.funds).to.be.bignumber.equal(0);
          expect(teller.referrer).to.equal(ADDRESS_ZERO);

          expect(zoneInstance.getCertifiedComments()).to.eventually.be.an('array').with.lengthOf(0);
          expect(zoneInstance.getComments()).to.eventually.be.an('array').with.lengthOf(0);
        });
        it.only('should succeed to withdraw all of a users withdrawable bids', async () => {
          // auction 1
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address); // loser
          await placeBid(user4, MIN_ZONE_DTH_STAKE + 30, zoneInstance.address); // loser
          await placeBid(user5, MIN_ZONE_DTH_STAKE + 40, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
          // auction 2
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user1, MIN_ZONE_DTH_STAKE + 50, zoneInstance.address); // loser
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 60, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 70, zoneInstance.address); // loser
          await placeBid(user4, MIN_ZONE_DTH_STAKE + 80, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
          // auction 3
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user1, MIN_ZONE_DTH_STAKE + 90, zoneInstance.address); // loser
          const lastAuctionBlockTimestamp = await getLastBlockTimestamp();
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 100, zoneInstance.address); // loser
          await placeBid(user5, MIN_ZONE_DTH_STAKE + 110, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 120, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);

          const [, user2bid1MinusEntryFee1] = await zoneInstance.calcEntryFee(ethToWei(MIN_ZONE_DTH_STAKE + 10));
          const [, user2bid1MinusEntryFee2] = await zoneInstance.calcEntryFee(ethToWei(MIN_ZONE_DTH_STAKE + 60));
          const [, user2bid1MinusEntryFee3] = await zoneInstance.calcEntryFee(ethToWei(MIN_ZONE_DTH_STAKE + 100));

          // user2 never won an auction

          await zoneInstance.withdrawFromAuctions(['1', '2', '3'], { from: user2 });

          expect(dthInstance.balanceOf(zoneFactoryInstance.address)).to.eventually.be.bignumber.equal(0);
          expect(dthInstance.balanceOf(user1)).to.eventually.be.bignumber.equal(0);
          expect(dthInstance.balanceOf(user2)).to.eventually.be.bignumber.equal(user2bid1MinusEntryFee1.add(user2bid1MinusEntryFee2).add(user2bid1MinusEntryFee3));
          expect(dthInstance.balanceOf(user3)).to.eventually.be.bignumber.equal(0);
          expect(dthInstance.balanceOf(user4)).to.eventually.be.bignumber.equal(0);
          expect(dthInstance.balanceOf(user5)).to.eventually.be.bignumber.equal(0);
          expect(dthInstance.balanceOf(zoneInstance.address)).to.eventually.be.bignumber.above(0);

          expect(zoneFactoryInstance.geohashToZone(asciiToHex(VALID_CG_ZONE_GEOHASH))).to.eventually.equal(zoneInstance.address);
          expect(zoneFactoryInstance.zoneToGeohash(zoneInstance.address)).to.eventually.equal(asciiToHex(VALID_CG_ZONE_GEOHASH));
          expect(zoneFactoryInstance.zoneExists(asciiToHex(VALID_CG_ZONE_GEOHASH))).to.eventually.be.true;

          expect(zoneInstance.auctionExists('0')).to.eventually.be.false;
          expect(zoneInstance.auctionExists('1')).to.eventually.be.true;
          expect(zoneInstance.auctionExists('2')).to.eventually.be.true;
          expect(zoneInstance.auctionExists('3')).to.eventually.be.true;
          expect(zoneInstance.auctionExists('4')).to.eventually.be.false;

          const zoneOwner = zoneOwnerToObj(await zoneInstance.getZoneOwner());
          const lastAuction = auctionToObj(await zoneInstance.getLastAuction());

          const lastBlockTimestamp = await getLastBlockTimestamp();

          expect(zoneOwner.addr).to.equal(user3);
          expect(zoneOwner.lastTaxTime).to.be.bignumber.equal(lastBlockTimestamp);
          const [, bidMinusEntryFeeUser3] = await zoneInstance.calcEntryFee(ethToWei(MIN_ZONE_DTH_STAKE + 120));
          expect(zoneOwner.staked).to.be.bignumber.equal(bidMinusEntryFeeUser3);
          expect(zoneOwner.balance).to.be.bignumber.equal(bidMinusEntryFeeUser3);
          expect(zoneOwner.auctionId).to.be.bignumber.equal(3);

          expect(lastAuction.id).to.be.bignumber.equal(3);
          expect(lastAuction.state).to.be.bignumber.equal(ZONE_AUCTION_STATE_ENDED);
          expect(lastAuction.startTime).to.be.bignumber.equal(lastAuctionBlockTimestamp);
          expect(lastAuction.endTime).to.be.bignumber.equal(lastAuctionBlockTimestamp + BID_PERIOD);
          expect(lastAuction.highestBidder).to.equal(user3);
          expect(lastAuction.highestBid).to.be.bignumber.equal(bidMinusEntryFeeUser3);
        });
      });
    });

    describe('TELLER', () => {
      describe('Zone.addTeller(bytes _position, uint8 _currencyId, bytes16 _messenger, int16 _sellRate, int16 _buyRate, bytes1 _settings)', () => {
        it('should revert if global pause is enabled', async () => {
          await controlInstance.pause({ from: owner });
          await expectRevert(
            zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 }),
            'contract is paused',
          );
        });
        it('should revert if country is disabled', async () => {
          await geoInstance.disableCountry(COUNTRY_CG, { from: owner });
          await expectRevert(
            zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 }),
            'country is disabled',
          );
        });
        it('should revert if position is empty bytes array', async () => {
          await expectRevert(
            zoneInstance.addTeller('0x', TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 }),
            'expected position to be 10 bytes',
          );
        });
        it('should revert if position is 9 bytes (instead of expected 12)', async () => {
          await expectRevert(
            zoneInstance.addTeller(asciiToHex('krcztsebc'), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 }),
            'expected position to be 10 bytes',
          );
        });
        it('should revert if position is 11 bytes (instead of expected 12)', async () => {
          await expectRevert(
            zoneInstance.addTeller(asciiToHex('krcztsebcde'), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 }),
            'expected position to be 10 bytes',
          );
        });
        it('should revert if position does not match geohash of Zone contract', async () => {
          await expectRevert(
            zoneInstance.addTeller(asciiToHex('xxxxxxxbcddd'), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 }),
            'position is not inside this zone',
          );
        });
        it('should revert if position last 3 chars contain invalid geohash char', async () => {
          await expectRevert(
            // a is not a valid geohash char
            zoneInstance.addTeller(asciiToHex('krcztsebcdda'), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 }),
            'invalid position geohash characters',
          );
        });
        it('should revert if currency id is zero', async () => {
          await expectRevert(
            zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), '0', asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 }),
            'currency id must be in range 1-100',
          );
        });
        it('should revert if currency id is 101', async () => {
          await expectRevert(
            zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), '101', asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 }),
            'currency id must be in range 1-100',
          );
        });
        it('should revert if seller bit set -- sellrate less than -9999', async () => {
          await expectRevert(
            zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), '-10000', TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 }),
            'sellRate should be between -9999 and 9999',
          );
        });
        it('should revert if seller bit set -- sellrate more than than 9999', async () => {
          await expectRevert(
            zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), '10000', TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 }),
            'sellRate should be between -9999 and 9999',
          );
        });
        it('should revert if seller bit not set -- sellrate is not zero', async () => {
          await expectRevert(
            zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), '1', TELLER_CG_BUYRATE, '0x02', ADDRESS_ZERO, { from: user1 }),
            'cannot set sellRate if not set as seller',
          );
        });
        it('should revert if buyer bit set -- buyrate less than -9999', async () => {
          await expectRevert(
            zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, '-10000', TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 }),
            'buyRate should be between -9999 and 9999',
          );
        });
        it('should revert if buyer bit set -- buyrate more than than 9999', async () => {
          await expectRevert(
            zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, '10000', TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 }),
            'buyRate should be between -9999 and 9999',
          );
        });
        it('should revert if buyer bit not set -- buyrate is not zero', async () => {
          await expectRevert(
            zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, '1', '0x01', ADDRESS_ZERO, { from: user1 }),
            'cannot set buyRate if not set as buyer',
          );
        });
        it('should revert if caller is not zone owner', async () => {
          await expectRevert(
            zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user2 }),
            'only zone owner can add teller info',
          );
        });
        it('should succeed if all args valid', async () => {
          await zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, TELLER_CG_MESSENGER, TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, user5, { from: user1 });

          const zoneOwner = zoneOwnerToObj(await zoneInstance.getZoneOwner());
          const teller = tellerToObj(await zoneInstance.getTeller());

          const lastBlockTimestamp = await getLastBlockTimestamp();

          expect(zoneInstance.auctionExists('0')).to.eventually.be.false;
          expect(zoneInstance.auctionExists('1')).to.eventually.be.false;

          expect(zoneOwner.addr).to.equal(user1);
          expect(zoneOwner.lastTaxTime).to.be.bignumber.equal(lastBlockTimestamp);
          expect(zoneOwner.staked).to.be.bignumber.equal(ethToWei(MIN_ZONE_DTH_STAKE));
          expect(zoneOwner.balance).to.be.bignumber.lte(ethToWei(MIN_ZONE_DTH_STAKE));
          expect(zoneOwner.auctionId).to.be.bignumber.equal(0);

          expect(teller.currencyId).to.be.bignumber.equal(TELLER_CG_CURRENCY_ID);
          expect(teller.messenger).to.equal(asciiToHex(TELLER_CG_MESSENGER));
          expect(teller.position).to.equal(asciiToHex(TELLER_CG_POSITION));
          expect(teller.settings).to.equal(TELLER_CG_SETTINGS);
          expect(teller.buyRate).to.be.bignumber.equal(TELLER_CG_BUYRATE);
          expect(teller.sellRate).to.be.bignumber.equal(TELLER_CG_SELLRATE);
          expect(teller.funds).to.be.bignumber.equal(0);
          expect(teller.referrer).to.equal(user5);

          expect(zoneInstance.getCertifiedComments()).to.eventually.be.an('array').with.lengthOf(0);
          expect(zoneInstance.getComments()).to.eventually.be.an('array').with.lengthOf(0);
        });
        it('should succeed if optional arg "messenger" is bytes16(0)', async () => {
          await zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, '0x00000000000000000000000000000000', TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, user5, { from: user1 });

          const teller = tellerToObj(await zoneInstance.getTeller());

          expect(teller.currencyId).to.be.bignumber.equal(TELLER_CG_CURRENCY_ID);
          expect(teller.messenger).to.equal('0x00000000000000000000000000000000');
          expect(teller.position).to.equal(asciiToHex(TELLER_CG_POSITION));
          expect(teller.settings).to.equal(TELLER_CG_SETTINGS);
          expect(teller.buyRate).to.be.bignumber.equal(TELLER_CG_BUYRATE);
          expect(teller.sellRate).to.be.bignumber.equal(TELLER_CG_SELLRATE);
          expect(teller.funds).to.be.bignumber.equal(0);
          expect(teller.referrer).to.equal(user5);
        });
        it('should succeed if optional arg "referrer" is address(0)', async () => {
          await zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, TELLER_CG_MESSENGER, TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 });

          const teller = tellerToObj(await zoneInstance.getTeller());

          expect(teller.currencyId).to.be.bignumber.equal(TELLER_CG_CURRENCY_ID);
          expect(teller.messenger).to.equal(asciiToHex(TELLER_CG_MESSENGER));
          expect(teller.position).to.equal(asciiToHex(TELLER_CG_POSITION));
          expect(teller.settings).to.equal(TELLER_CG_SETTINGS);
          expect(teller.buyRate).to.be.bignumber.equal(TELLER_CG_BUYRATE);
          expect(teller.sellRate).to.be.bignumber.equal(TELLER_CG_SELLRATE);
          expect(teller.funds).to.be.bignumber.equal(0);
          expect(teller.referrer).to.equal(ADDRESS_ZERO);
        });
      });
      describe('Zone.addFunds(uint _amount)', () => {
        it('should revert if global pause is enabled', async () => {
          await zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 });
          await controlInstance.pause({ from: owner });
          await expectRevert(
            zoneInstance.addFunds({ from: user1, value: ethToWei(100) }),
            'contract is paused',
          );
        });
        it('should revert if country is disabled', async () => {
          await zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 });
          await geoInstance.disableCountry(COUNTRY_CG, { from: owner });
          await expectRevert(
            zoneInstance.addFunds({ from: user1, value: ethToWei(100) }),
            'country is disabled',
          );
        });
        it('should revert if no eth send with call', async () => {
          await zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 });
          await expectRevert(
            zoneInstance.addFunds({ from: user1, value: ethToWei(0) }),
            'no eth send with call',
          );
        });
        it('should revert if called by not-zoneowner', async () => {
          await zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 });
          await expectRevert(
            zoneInstance.addFunds({ from: user2, value: ethToWei(100) }),
            'only zoneOwner can add funds',
          );
        });
        it('should revert if no teller added', async () => {
          await expectRevert(
            zoneInstance.addFunds({ from: user1, value: ethToWei(100) }),
            'not yet added teller info',
          );
        });
        it('should succeed otherwise', async () => {
          await zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 });
          const userEthBalanceBefore = new BigNumber(await web3.eth.getBalance(user1));
          const zoneEthBalanceBefore = new BigNumber(await web3.eth.getBalance(zoneInstance.address));
          await zoneInstance.addFunds({ from: user1, value: ethToWei(100) });
          const userEthBalanceAfter = new BigNumber(await web3.eth.getBalance(user1));
          const zoneEthBalanceAfter = new BigNumber(await web3.eth.getBalance(zoneInstance.address));
          expect(userEthBalanceAfter).to.be.bignumber.below(userEthBalanceBefore.minus(ethToWei(100)));
          expect(zoneEthBalanceAfter).to.be.bignumber.equal(zoneEthBalanceBefore.plus(ethToWei(100)));
          expect(zoneInstance.funds(user1)).to.eventually.be.bignumber.equal(ethToWei(100));
        });
      });
      describe('Zone.sellEth(address _to, uint _amount)', () => {
        it('should revert if global pause is enabled', async () => {
          await zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 });
          await zoneInstance.addFunds({ from: user1, value: ethToWei(1) });
          await controlInstance.pause({ from: owner });
          await expectRevert(
            zoneInstance.sellEth(user3, ethToWei(1), { from: user1 }),
            'contract is paused',
          );
        });
        it('should revert if country is disabled', async () => {
          await zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 });
          await zoneInstance.addFunds({ from: user1, value: ethToWei(1) });
          await geoInstance.disableCountry(COUNTRY_CG, { from: owner });
          await expectRevert(
            zoneInstance.sellEth(user3, ethToWei(1), { from: user1 }),
            'country is disabled',
          );
        });
        it('should revert if sender is also to', async () => {
          await zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 });
          await zoneInstance.addFunds({ from: user1, value: ethToWei(1) });
          await expectRevert(
            zoneInstance.sellEth(user1, ethToWei(1), { from: user1 }),
            'sender cannot also be to',
          );
        });
        it('should revert if amount is zero', async () => {
          await zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 });
          await zoneInstance.addFunds({ from: user1, value: ethToWei(1) });
          await expectRevert(
            zoneInstance.sellEth(user3, ethToWei(0), { from: user1 }),
            'amount to sell cannot be zero',
          );
        });
        it('should revert if caller is not zoneowner', async () => {
          await zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 });
          await zoneInstance.addFunds({ from: user1, value: ethToWei(1) });
          await expectRevert(
            zoneInstance.sellEth(user3, ethToWei(1), { from: user2 }),
            'can only be called by zone owner',
          );
        });
        it('should revert if zone is no teller', async () => {
          await expectRevert(
            zoneInstance.sellEth(user3, ethToWei(1), { from: user1 }),
            'not yet added teller info',
          );
        });
        it('should revert if amount to sell is greater than funds added', async () => {
          await zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 });
          await zoneInstance.addFunds({ from: user1, value: ethToWei(1) });
          await expectRevert(
            zoneInstance.sellEth(user3, ethToWei(1.1), { from: user1 }),
            'cannot sell more than in funds',
          );
        });
        it('should revert if amount to sell is not enough pay 0.1% referrer fee', async () => {
          await zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, user4, { from: user1 });
          await zoneInstance.addFunds({ from: user1, value: ethToWei(1) });
          await expectRevert(
            zoneInstance.sellEth(user3, ethToWei(1), { from: user1 }),
            'not enough funds to sell eth amount plus pay referrer fee',
          );
        });
        it('should revert if amount to sell is greater than daily limit', async () => {
          await zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 });
          await zoneInstance.addFunds({ from: user1, value: ethToWei(2) });
          await expectRevert(
            zoneInstance.sellEth(user3, ethToWei(2), { from: user1 }),
            'exceeded daily sell limit',
          );
        });
        it('should succeed and transfer sell amount to buyer', async () => {
          await zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 });
          await zoneInstance.addFunds({ from: user1, value: ethToWei(1) });

          const buyerEthBalanceBefore = new BigNumber(await web3.eth.getBalance(user2));

          await zoneInstance.sellEth(user2, ethToWei(1), { from: user1 });

          const zoneEthBalanceAfter = new BigNumber(await web3.eth.getBalance(zoneInstance.address));
          const buyerEthBalanceAfter = new BigNumber(await web3.eth.getBalance(user2));

          expect(zoneInstance.funds(user1)).to.eventually.be.bignumber.equal(0);
          expect(zoneInstance.funds(user2)).to.eventually.be.bignumber.equal(0);

          expect(zoneEthBalanceAfter).to.be.bignumber.equal(0);
          expect(buyerEthBalanceAfter).to.be.bignumber.equal(buyerEthBalanceBefore.plus(ethToWei(1)));
        });
        it('should succeed and transfer sell amount to buyer plus send 0.1% referrer fee to referrer', async () => {
          await zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, user3, { from: user1 });
          await zoneInstance.addFunds({ from: user1, value: ethToWei(1.001) });

          const buyerEthBalanceBefore = new BigNumber(await web3.eth.getBalance(user2));
          const referrerEthBalanceBefore = new BigNumber(await web3.eth.getBalance(user3));

          await zoneInstance.sellEth(user2, ethToWei(1), { from: user1 });

          const zoneEthBalanceAfter = new BigNumber(await web3.eth.getBalance(zoneInstance.address));
          const buyerEthBalanceAfter = new BigNumber(await web3.eth.getBalance(user2));
          const referrerEthBalanceAfter = new BigNumber(await web3.eth.getBalance(user3));

          expect(zoneInstance.funds(user1)).to.eventually.be.bignumber.equal(0);
          expect(zoneInstance.funds(user2)).to.eventually.be.bignumber.equal(0);
          expect(zoneInstance.withdrawableEth(user3)).to.eventually.be.bignumber.equal(ethToWei(0.001));

          expect(zoneEthBalanceAfter).to.be.bignumber.equal(ethToWei(0.001));
          expect(buyerEthBalanceAfter).to.be.bignumber.equal(buyerEthBalanceBefore.plus(ethToWei(1)));
          expect(referrerEthBalanceAfter).to.be.bignumber.equal(referrerEthBalanceBefore.plus(0));
        });
      });
      describe('Zone.addComment(bytes32 _commentHash)', () => {
        beforeEach(async () => {
          await zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 });
        });
        it('should revert if global pause is enabled', async () => {
          await controlInstance.pause({ from: owner });
          await expectRevert(
            zoneInstance.addComment(getRandomBytes32(), { from: user2 }),
            'contract is paused',
          );
        });
        it('should revert if country is disabled', async () => {
          await geoInstance.disableCountry(COUNTRY_CG, { from: owner });
          await expectRevert(
            zoneInstance.addComment(getRandomBytes32(), { from: user2 }),
            'country is disabled',
          );
        });
        it('should revert if comment hash is empty', async () => {
          await expectRevert(
            zoneInstance.addComment(BYTES32_ZERO, { from: user2 }),
            'comment hash cannot be 0x0',
          );
        });
        it('should revert if zone has no owner', async () => {
          await zoneInstance.release({ from: user1 });
          await expectRevert(
            zoneInstance.addComment(getRandomBytes32(), { from: user2 }),
            'cannot comment on zone without owner',
          );
        });
        it('should revert if zone has no teller', async () => {
          await zoneInstance.removeTeller({ from: user1 });
          await expectRevert(
            zoneInstance.addComment(getRandomBytes32(), { from: user2 }),
            'cannot comment on zone without teller',
          );
        });
        it('should revert if called by current zone owner', async () => {
          await expectRevert(
            zoneInstance.addComment(getRandomBytes32(), { from: user1 }),
            'zone owner cannot comment on himself',
          );
        });
        it('should succeed otherwise', async () => {
          await zoneInstance.addComment(getRandomBytes32(), { from: user2 });

          expect(zoneInstance.getCertifiedComments()).to.eventually.be.an('array').with.lengthOf(0);
          expect(zoneInstance.getComments()).to.eventually.be.an('array').with.lengthOf(1);
        });
      });
      describe('Zone.addCertifiedComment(bytes32 _commentHash)', () => {
        beforeEach(async () => {
          await zoneInstance.addTeller(asciiToHex(TELLER_CG_POSITION), TELLER_CG_CURRENCY_ID, asciiToHex(TELLER_CG_MESSENGER), TELLER_CG_SELLRATE, TELLER_CG_BUYRATE, TELLER_CG_SETTINGS, ADDRESS_ZERO, { from: user1 });
          await zoneInstance.addFunds({ from: user1, value: ethToWei(1) });
        });
        it('should revert if global pause is enabled', async () => {
          await zoneInstance.sellEth(user2, ethToWei(1), { from: user1 });
          await controlInstance.pause({ from: owner });
          await expectRevert(
            zoneInstance.addCertifiedComment(getRandomBytes32(), { from: user2 }),
            'contract is paused',
          );
        });
        it('should revert if country is disabled', async () => {
          await zoneInstance.sellEth(user2, ethToWei(1), { from: user1 });
          await geoInstance.disableCountry(COUNTRY_CG, { from: owner });
          await expectRevert(
            zoneInstance.addCertifiedComment(getRandomBytes32(), { from: user2 }),
            'country is disabled',
          );
        });
        it('should revert if comment hash is empty', async () => {
          await zoneInstance.sellEth(user2, ethToWei(1), { from: user1 });
          await expectRevert(
            zoneInstance.addCertifiedComment(BYTES32_ZERO, { from: user2 }),
            'comment hash cannot be 0x0',
          );
        });
        it('should revert if zone has no owner', async () => {
          await zoneInstance.sellEth(user2, ethToWei(1), { from: user1 });
          await zoneInstance.release({ from: user1 });
          await expectRevert(
            zoneInstance.addCertifiedComment(getRandomBytes32(), { from: user2 }),
            'cannot comment on zone without owner',
          );
        });
        it('should revert if zone has no teller', async () => {
          await zoneInstance.sellEth(user2, ethToWei(1), { from: user1 });
          await zoneInstance.removeTeller({ from: user1 });
          await expectRevert(
            zoneInstance.addCertifiedComment(getRandomBytes32(), { from: user2 }),
            'cannot comment on zone without teller',
          );
        });
        it('should revert if zone owner cannot comment himself', async () => {
          await zoneInstance.sellEth(user2, ethToWei(1), { from: user1 });
          await expectRevert(
            zoneInstance.addCertifiedComment(getRandomBytes32(), { from: user1 }),
            'zone owner cannot comment on himself',
          );
        });
        it('should revert if user did not trade with teller yet (1 trade = 1 comment)', async () => {
          await expectRevert(
            zoneInstance.addCertifiedComment(getRandomBytes32(), { from: user2 }),
            'user not allowed to place a certified comment',
          );
        });
        it('should succeed otherwise', async () => {
          await zoneInstance.sellEth(user2, ethToWei(1), { from: user1 });
          await zoneInstance.addCertifiedComment(getRandomBytes32(), { from: user2 });

          expect(zoneInstance.getCertifiedComments()).to.eventually.be.an('array').with.lengthOf(1);
          expect(zoneInstance.getComments()).to.eventually.be.an('array').with.lengthOf(0);
        });
      });
    });
  });

  describe('Getters', () => {
    describe('[ pure ]', () => {
      let zoneInstance;
      beforeEach(async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        zoneInstance = await createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_CG_ZONE_GEOHASH);
      });
      describe('Zone.calcEntryFee(uint _bid)', () => {
        it('returns correct result for 100 dth', async () => {
          const res = await zoneInstance.calcEntryFee(ethToWei(100));
          expect(res[0].toString()).to.equal(ethToWei(1));
          expect(res[1].toString()).to.equal(ethToWei(99));
        });
        it('returns correct result for 101 dth', async () => {
          const res = await zoneInstance.calcEntryFee(ethToWei(101));
          expect(res[0].toString()).to.equal(ethToWei(1.01));
          expect(res[1].toString()).to.equal(ethToWei(99.99));
        });
      });
      describe('Zone.calcHarbergerTax(uint _startTime, uint _endTime, uint _dthAmount)', () => {
        it('[tax 1 hour] stake 100 dth ', async () => {
          const res = await zoneInstance.calcHarbergerTax(0, ONE_HOUR, ethToWei(100));
          expect(res[0].toString()).to.equal('41666666666666666');
          expect(res[1].toString()).to.equal('99958333333333333334');
        });
        it('[tax 1 day] stake 100 dth ', async () => {
          // with tax being 1% per day, this test should return 1DTH tax2pay after exactly 24 hours
          const res = await zoneInstance.calcHarbergerTax(0, ONE_DAY, ethToWei(100));
          expect(res[0].toString()).to.equal(ethToWei(1));
          expect(res[1].toString()).to.equal(ethToWei(99));
        });
        it('returns correct result for 101 dth', async () => {
          const res = await zoneInstance.calcHarbergerTax(0, ONE_DAY, ethToWei(101));
          expect(res[0].toString()).to.equal(ethToWei(1.01));
          expect(res[1].toString()).to.equal(ethToWei(99.99));
        });
        it('returns correct result 15 second tax time', async () => {
          const res = await zoneInstance.calcHarbergerTax(0, 15, ethToWei(100));
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
            zoneInstance = await createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_CG_ZONE_GEOHASH);
          });
          it.skip('returns correct Auction 0 Sentinel values', async () => {
            const lastAuction = auctionToObj(await zoneInstance.getLastAuction());
            expect(lastAuction.id.toNumber(), 'lastAuction.id should be zero').to.equal(0);
            expect(lastAuction.state.toNumber(), 'lastAuction.state should equal Ended(=1)').to.equal(1);
            expect(lastAuction.startTime.toNumber(), 'lastAuction.endTime should be greater than 0').to.not.equal(0);
            expect(lastAuction.startTime.toNumber(), 'lastAuction.endTime should equal auction.startTime').to.equal(lastAuction.endTime.toNumber());
            expect(lastAuction.highestBidder, 'lastAuction.highestBidder should equal @user1').to.equal(user1.toLowerCase());
          });
          describe('when Zone cooldown period ended', () => {
            beforeEach(async () => {
              await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
            });
            describe('when @user2 (challenger1) started an Auction for this Zone', () => {
              beforeEach(async () => {
                await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address);
              });
              it('returns correct newly created Auction 1 values', async () => {
                const lastAuction = auctionToObj(await zoneInstance.getLastAuction());
                expect(lastAuction.id.toNumber(), 'lastAuction.id should be 1').to.equal(1);
                expect(lastAuction.state.toNumber(), 'lastAuction.state should equal Started(=0)').to.equal(0);
                expect(lastAuction.startTime.toNumber(), 'lastAuction.endTime should be greater than 0').to.not.equal(0);
                expect(lastAuction.endTime.gt(lastAuction.startTime), 'lastAuction.endTime should be bigger than auction.startTime').to.equal(true);
                expect(lastAuction.highestBidder, 'lastAuction.highestBidder should equal @user2').to.equal(user2.toLowerCase());
              });
              describe('when @user1 (current zone owner) places a counter bid', () => {
                beforeEach(async () => {
                  await placeBid(user1, 20, zoneInstance.address);
                });
                it('returns correct updated (highestBidder) Auction 1 values', async () => {
                  const lastAuction = auctionToObj(await zoneInstance.getLastAuction());
                  expect(lastAuction.id.toNumber(), 'lastAuction.id should be 1').to.equal(1);
                  expect(lastAuction.state.toNumber(), 'lastAuction.state should equal Started(=0)').to.equal(0);
                  expect(lastAuction.startTime.toNumber(), 'lastAuction.endTime should be greater than 0').to.not.equal(0);
                  expect(lastAuction.endTime.gt(lastAuction.startTime), 'lastAuction.endTime should be bigger than auction.startTime').to.equal(true);
                  expect(lastAuction.highestBidder, 'lastAuction.highestBidder should equal @user1').to.equal(user1.toLowerCase());
                });
                describe('when @user2 (challenger1) places a counter bid', () => {
                  beforeEach(async () => {
                    await placeBid(user2, 20, zoneInstance.address);
                  });
                  it('returns correct updated (highestBidder) Auction 1 values', async () => {
                    const lastAuction = auctionToObj(await zoneInstance.getLastAuction());
                    expect(lastAuction.id.toNumber(), 'lastAuction.id should be 1').to.equal(1);
                    expect(lastAuction.state.toNumber(), 'lastAuction.state should equal Started(=0)').to.equal(0);
                    expect(lastAuction.startTime.toNumber(), 'lastAuction.endTime should be greater than 0').to.not.equal(0);
                    expect(lastAuction.endTime.gt(lastAuction.startTime), 'lastAuction.endTime should be bigger than auction.startTime').to.equal(true);
                    expect(lastAuction.highestBidder, 'lastAuction.highestBidder should equal @user2').to.equal(user2.toLowerCase());
                  });
                  describe('when Auction endTime has passed (winner and new zone owner will be @user2)', () => {
                    beforeEach(async () => {
                      await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
                    });
                    describe('when Zone cooldown period ended', () => {
                      beforeEach(async () => {
                        await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
                      });
                      describe('when @user3 (challenger2) started an Auction for this Zone', () => {
                        beforeEach(async () => {
                          await placeBid(user3, MIN_ZONE_DTH_STAKE + 40, zoneInstance.address);
                        });
                        it('returns correct newly created Auction 2 values', async () => {
                          const lastAuction = auctionToObj(await zoneInstance.getLastAuction());
                          expect(lastAuction.id.toNumber(), 'lastAuction.id should be 2').to.equal(2);
                          expect(lastAuction.state.toNumber(), 'lastAuction.state should equal Started(=0)').to.equal(0);
                          expect(lastAuction.startTime.toNumber(), 'lastAuction.endTime should be greater than 0').to.not.equal(0);
                          expect(lastAuction.endTime.gt(lastAuction.startTime), 'lastAuction.endTime should be bigger than auction.startTime').to.equal(true);
                          expect(lastAuction.highestBidder, 'lastAuction.highestBidder should equal @user3').to.equal(user3.toLowerCase());
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
