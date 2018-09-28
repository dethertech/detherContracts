/* eslint-env node, mocha */
/* global artifacts, contract, web3, assert */
/* eslint-disable max-len */

const {
  // expectThrow,
  // waitForMined,
  hexEncode,
  toNBytes,
  intTo5bytes,
  intTo2bytes,
  intTobytes,
  toAsciiStripZero,
  weiToEth,
  ethToWei,
} = require('./utils');

const {
  teller1,
  teller2,
  teller3,
  shop1,
  shop2,
  shop3,
  shop8,
} = require('./mock.json');

const DetherCore = artifacts.require('./DetherCore.sol');
const DetherBank = artifacts.require('./DetherBank.sol');
const SmsCertifier = artifacts.require('./certifier/SmsCertifier.sol');
const KycCertifier = artifacts.require('./certifier/KycCertifier.sol');
const Dth = artifacts.require('./token/DetherToken.sol');

// NOTE: use a fake version with a preset exchange rate
const ExchangeRateOracle = artifacts.require('./token/FakeExchangeRateOracle.sol');

// fix to solve truffle pblm with overloading
const web3Abi = require('web3-eth-abi');
/* eslint-disable quote-props, comma-dangle */
const overloadedTransferAbi = {
  'constant': false,
  'inputs': [
    {
      'name': '_to',
      'type': 'address'
    },
    {
      'name': '_value',
      'type': 'uint256'
    },
    {
      'name': '_data',
      'type': 'bytes'
    }
  ],
  'name': 'transfer',
  'outputs': [
    {
      'name': '',
      'type': 'bool'
    }
  ],
  'payable': false,
  'stateMutability': 'nonpayable',
  'type': 'function'
};
/* eslint-enable quote-props, comma-dangle */

let dether;
let smsCertifier;
let kycCertifier;
let dthToken;
let detherBank;
let priceOracle;

const shopToContract = (rawshop) => {
  const lat = intTo5bytes(parseFloat(rawshop.lat) * 100000);
  const lng = intTo5bytes(parseFloat(rawshop.lng) * 100000);
  const hexshopGeo = `0x31${lat}${lng}`;

  const country = toNBytes(rawshop.countryId, 2);
  const postalCode = toNBytes(rawshop.postalCode, 16);
  const hexShopAddr = `${country}${postalCode}`;

  const cat = toNBytes(rawshop.cat, 16);
  const name = toNBytes(rawshop.name, 16);
  const hexShopId = `${cat}${name}`;

  const description = toNBytes(rawshop.description, 32);
  const opening = toNBytes(rawshop.opening, 16);
  const hexShopDesc = `${description}${opening}31`;

  const hexShop = `${hexshopGeo}${hexShopAddr}${hexShopId}${hexShopDesc}`;
  return hexShop;
};

const shopToContractBulk = (rawshop) => {
  const lat = intTo5bytes(parseFloat(rawshop.lat) * 100000);
  const lng = intTo5bytes(parseFloat(rawshop.lng) * 100000);
  const hexshopGeo = `0x33${lat}${lng}`;

  const country = toNBytes(rawshop.countryId, 2);
  const postalCode = toNBytes(rawshop.postalCode, 16);
  const hexShopAddr = `${country}${postalCode}`;

  const cat = toNBytes(rawshop.cat, 16);
  const name = toNBytes(rawshop.name, 16);
  const hexShopId = `${cat}${name}`;

  const description = toNBytes(rawshop.description, 32);
  const opening = toNBytes(rawshop.opening, 16);
  const hexShopDesc = `${description}${opening}`;

  const hexShop = `${hexshopGeo}${hexShopAddr}${hexShopId}${hexShopDesc}${rawshop.address}`;
  return hexShop;
};

const tellerToContract = (rawteller) => {
  const lat = intTo5bytes(parseFloat(rawteller.lat) * 100000);
  const lng = intTo5bytes(parseFloat(rawteller.lng) * 100000);

  const currency = intTobytes(parseInt(rawteller.currencyId, 10));
  const avatar = intTobytes(parseInt(rawteller.avatarId, 10));
  const rates = intTo2bytes(parseFloat(rawteller.rates, 10) * 10);

  const countryId = toNBytes(rawteller.countryId, 2);
  const postalCode = toNBytes(rawteller.postalCode, 16);
  const messenger = toNBytes(rawteller.messenger, 16);

  const buyer = rawteller.buyer ? '01' : '00';
  const buyRates = intTo2bytes(parseFloat(rawteller.buyRates) * 10);

  const hexteller = `0x32${lat}${lng}${countryId}${postalCode}${avatar}${currency}${messenger}${rates}${buyer}${buyRates}`;
  return hexteller;
};

const shopFromContract = rawshop => ({
  lat: rawshop[0] / 100000,
  lng: rawshop[1] / 100000,
  countryId: toAsciiStripZero(rawshop[2]),
  postalCode: toAsciiStripZero(rawshop[3]),
  cat: toAsciiStripZero(rawshop[4]),
  name: toAsciiStripZero(rawshop[5]),
  description: toAsciiStripZero(rawshop[6]),
  opening: toAsciiStripZero(rawshop[7]),
});

const tellerFromContract = rawTeller => ({
  lat: rawTeller[0] / 100000,
  lng: rawTeller[1] / 100000,
  countryId: toAsciiStripZero(rawTeller[2]),
  postalCode: toAsciiStripZero(rawTeller[3]),
  currencyId: rawTeller[4].toNumber(),
  messenger: toAsciiStripZero(rawTeller[5]),
  avatarId: rawTeller[6].toNumber(),
  rates: rawTeller[7].toNumber() / 10,
  balance: weiToEth(rawTeller[8]),
  online: rawTeller[9],
  buyer: rawTeller[10],
  buyRates: rawTeller[11].toNumber() / 10,
});

const getAccounts = () => new Promise((resolve, reject) => {
  web3.eth.getAccounts((err, acc) => err ? reject(err) : resolve(acc)); // eslint-disable-line
});

let owner;
let user1address;
let user2address;
let user3address;
let moderator;
let cmo;
let certifier;
let cfo;

contract('Dether Dth', () => {
  before(async () => {
    const accs = await getAccounts();
    /* eslint-disable prefer-destructuring */
    owner = accs[0];
    user1address = accs[1];
    user2address = accs[2];
    user3address = accs[3];
    moderator = accs[4];
    cmo = accs[5];
    certifier = accs[6];
    cfo = accs[7];
    /* eslint-enable prefer-destructuring */
  });

  beforeEach(async () => {
    dthToken = await Dth.new({ gas: 6500000, gasPrice: 10000000000, from: owner });
    dether = await DetherCore.new({ gas: 6500000, gasPrice: 10000000000, from: owner });
    smsCertifier = await SmsCertifier.new({ gas: 6500000, gasPrice: 10000000000, from: owner });
    kycCertifier = await KycCertifier.new({ gas: 6500000, gasPrice: 10000000000, from: owner });
    detherBank = await DetherBank.new({ gas: 6500000, gasPrice: 10000000000, from: owner });
    //
    // // uses the FakeExchangeRateOracle.sol contract during testing
    priceOracle = await ExchangeRateOracle.new({ gas: 6500000, gasPrice: 25000000000, from: owner });

    await dether.initContract(dthToken.address, detherBank.address);
    await dether.setCSO(moderator);
    await dether.setCMO(cmo);
    await dether.setCFO(cfo);
    await dether.setPriceOracle(priceOracle.address, { from: cfo });
    await dether.setSmsCertifier(smsCertifier.address);
    await dether.setKycCertifier(kycCertifier.address);
    await dether.setShopModerator(moderator);
    await dether.setTellerModerator(moderator);

    await detherBank.setDth(dthToken.address);
    await detherBank.transferOwnership(dether.address);

    await smsCertifier.addDelegate(certifier, 'test', { gas: 4000000, from: owner });
    await smsCertifier.certify(user1address, { gas: 4000000, from: certifier });
    await smsCertifier.certify(user2address, { gas: 4000000, from: certifier });
    await smsCertifier.certify(user3address, { gas: 4000000, from: certifier });
    await smsCertifier.certify(moderator, { gas: 4000000, from: certifier });

    await kycCertifier.addDelegate(certifier, 'test', { gas: 4000000, from: owner });
    await kycCertifier.certify(user2address, { gas: 4000000, from: certifier });

    await dthToken.mint(owner, 1000);
    await dthToken.mint(user1address, 1000);
    await dthToken.mint(user2address, 1000);
    await dthToken.mint(user3address, 1000);
    await dthToken.mint(moderator, 1000);
    await dthToken.finishMinting();

    await dether.setLicenceShopPrice(web3.toHex(shop1.countryId), 10, { from: cmo });
    await dether.setLicenceTellerPrice(web3.toHex(teller1.countryId), 10, { from: cmo });

    await dether.openZoneShop(web3.toHex(shop1.countryId), { from: cmo });
    await dether.openZoneShop(web3.toHex(shop2.countryId), { from: cmo });
    await dether.openZoneShop(web3.toHex(shop3.countryId), { from: cmo });
    await dether.openZoneShop(web3.toHex(shop8.countryId), { from: cmo });
    await dether.openZoneTeller(web3.toHex(teller1.countryId), { from: cmo });
    await dether.openZoneTeller(web3.toHex(teller2.countryId), { from: cmo });
    await dether.openZoneTeller(web3.toHex(teller3.countryId), { from: cmo });

    await dether.setSellDailyLimit(1, web3.toHex(teller1.countryId), 1000, { from: cfo });
    await dether.setSellDailyLimit(2, web3.toHex(teller2.countryId), 5000, { from: cfo });
  });

  contract('Add shop --', async () => {
    it('should be able to bulk add shop from the same address', async () => {
      shop1.address = '0000000000000000000000000000000000000001';

      const transferMethodTransactionDataShop1 = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, shopToContractBulk(shop1)],
      );
      await web3.eth.sendTransaction({
        from: moderator,
        to: dthToken.address,
        data: transferMethodTransactionDataShop1,
        value: 0,
        gas: 4700000,
      });

      const shop1value = await dether.getShop('0x0000000000000000000000000000000000000001');

      assert.equal(
        await dether.isShop('0x0000000000000000000000000000000000000001'),
        true,
        'should be true since shop is now online',
      );
      const formatedValueShop1 = shopFromContract(shop1value);
        console.log('test 4 formated value => ', formatedValueShop1);
      assert.equal(formatedValueShop1.lat, shop1.lat, 'lat did not match');
      assert.equal(formatedValueShop1.lng, shop1.lng, 'lng did not match');
      assert.equal(formatedValueShop1.countryId, shop1.countryId, 'countryId did not match');
      assert.equal(formatedValueShop1.postalCode, shop1.postalCode, 'postalCode did not match');
      assert.equal(formatedValueShop1.cat, shop1.cat, 'cat did not match');
      assert.equal(formatedValueShop1.name, shop1.name, 'name did not match');
      assert.equal(formatedValueShop1.description, shop1.description, ' description did not match');
      assert.equal(formatedValueShop1.opening, shop1.opening, 'opening did not match');

      shop2.address = '0000000000000000000000000000000000000002';

      const transferMethodTransactionDataShop2 = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, shopToContractBulk(shop2)],
      );

      await web3.eth.sendTransaction({
        from: moderator,
        to: dthToken.address,
        data: transferMethodTransactionDataShop2,
        value: 0,
        gas: 4700000,
      });

      const shop2value = await dether.getShop('0x0000000000000000000000000000000000000002');

      assert.equal(
        await dether.isShop('0x0000000000000000000000000000000000000002'),
        true,
        'should be true since shop is now online',
      );

      const formatedValueShop2 = shopFromContract(shop2value);

      assert.equal(formatedValueShop2.lat, shop2.lat, 'lat did not match');
      assert.equal(formatedValueShop2.lng, shop2.lng, 'lng did not match');
      assert.equal(formatedValueShop2.countryId, shop2.countryId, 'countryId did not match');
      assert.equal(formatedValueShop2.postalCode, shop2.postalCode, 'postalCode did not match');
      assert.equal(formatedValueShop2.cat, shop2.cat, 'cat did not match');
      assert.equal(formatedValueShop2.name, shop2.name, 'name did not match');
      assert.equal(formatedValueShop2.description, shop2.description, ' description did not match');
      assert.equal(formatedValueShop2.opening, shop2.opening, 'opening did not match');

      // verify when delete CSO is refund
      assert.equal(
        (await dthToken.balanceOf(moderator)).toNumber(),
        960,
        'balance should have 2 * 20 less',
      );

      // delete
      await dether.deleteShopMods('0x0000000000000000000000000000000000000002', { from: moderator });

      assert.equal(
        await dether.isShop('0x0000000000000000000000000000000000000002'),
        false,
        'should be false since shop was deleted',
      );

      assert.equal(
        (await dthToken.balanceOf(moderator)).toNumber(),
        980,
        'balance should have increased by 20',
      );
    });

    it('should parse data and register and be on the map', async () => {
      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, shopToContract(shop8)],
      );

      await web3.eth.sendTransaction({
        from: user1address,
        to: dthToken.address,
        data: transferMethodTransactionData,
        value: 0,
        gas: 4700000,
      });

      const shop8value = await dether.getShop(user1address);

      assert.equal(await dether.isShop(user1address), true, 'assert shop is now online');

      const formatedValue = shopFromContract(shop8value);

      assert.equal(formatedValue.lat, shop8.lat, 'lat did not match');
      assert.equal(formatedValue.lng, shop8.lng, 'lng did not match');
      assert.equal(formatedValue.countryId, shop8.countryId, 'countryId dit not match');
      assert.equal(formatedValue.postalCode, shop8.postalCode, 'postalCode did not match');
      assert.equal(formatedValue.cat, shop8.cat, 'cat did not match');
      assert.equal(formatedValue.name, shop8.name, 'name did not match');
      assert.equal(formatedValue.description, shop8.description, 'description did not match');
      assert.equal(formatedValue.opening, shop8.opening, 'opening did not match');
    });

    it('should not be possible to add shop in unopened zone', async () => {
      await dether.closeZoneShop(web3.toHex(shop3.countryId), { from: cmo });

      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, shopToContract(shop3)],
      );

      try {
        await web3.eth.sendTransaction({
          from: user3address,
          to: dthToken.address,
          data: transferMethodTransactionData,
          value: 0,
          gas: 4700000,
        });
      } catch (err) {
        // nothing
      }

      assert.equal(await dether.isShop(user3address), false, 'assert shop is now online');
    });

    it('should get all shop in a zone', async () => {
      const zoneBefore = await dether.getZoneShop(
        web3.toHex(shop1.countryId),
        web3.toHex(shop1.postalCode),
      );

      assert.equal(zoneBefore, '', 'zone should be empty string');

      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, shopToContract(shop1)],
      );

      await web3.eth.sendTransaction({
        from: user1address,
        to: dthToken.address,
        data: transferMethodTransactionData,
        value: 0,
        gas: 4700000,
      });

      const transferMethodTransactionData2 = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, shopToContract(shop2)],
      );

      await web3.eth.sendTransaction({
        from: user2address,
        to: dthToken.address,
        data: transferMethodTransactionData2,
        value: 0,
        gas: 5000000,
      });

      const zoneAfter = await dether.getZoneShop(
        hexEncode(shop1.countryId),
        hexEncode(shop1.postalCode),
      );

      assert.deepEqual(zoneAfter, [user1address, user2address], `zone should have equaled: [${user1address}, ${user2address}]`);
    });

    it('should have empty zone after delete', async () => {
      const zoneBefore = await dether.getZoneShop(
        web3.toHex(shop1.countryId),
        web3.toHex(shop1.postalCode),
      );

      assert.equal(zoneBefore, '', 'zone should be empty string');

      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, shopToContract(shop1)],
      );

      await web3.eth.sendTransaction({
        from: user1address,
        to: dthToken.address,
        data: transferMethodTransactionData,
        value: 0,
        gas: 5000000,
      });

      const transferMethodTransactionData2 = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, shopToContract(shop2)],
      );

      await web3.eth.sendTransaction({
        from: user2address,
        to: dthToken.address,
        data: transferMethodTransactionData2,
        value: 0,
        gas: 5000000,
      });

      assert.equal(await dether.isShop(user1address), true, 'shop should be online');

      await dether.deleteShop({
        from: user2address,
        gas: 4000000,
      });

      await dether.deleteShop({
        from: user1address,
        gas: 4000000,
      });

      const zoneAfter = await dether.getZoneShop(
        hexEncode(shop1.countryId),
        hexEncode(shop1.postalCode),
      );

      assert.equal(zoneAfter, '', 'zone should be cleared (empty string) after delete');
    });

    it('should have token back after delete', async () => {
      const balanceBeforeUser1 = await dthToken.balanceOf(user1address);

      const stakedTellerBeforeUser1 = await dether.getStakedShop(user1address);

      const zone = await dether.getZoneShop(
        web3.toHex(shop1.countryId),
        web3.toHex(shop1.postalCode),
      );

      assert.equal(zone, '', 'zone should be empty string');

      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, shopToContract(shop1)],
      );

      await web3.eth.sendTransaction({
        from: user1address,
        to: dthToken.address,
        data: transferMethodTransactionData,
        value: 0,
        gas: 5000000,
      });

      assert.equal(await dether.isShop(user1address), true, 'shop should be true since its now online');

      await dether.deleteShop({
        from: user1address,
        gas: 4000000,
      });

      const balanceAfterUser1 = await dthToken.balanceOf(user1address);
      const stakedTellerAfterUser1 = await dether.getStakedShop(user1address);

      assert.equal(
        balanceAfterUser1.toNumber(),
        balanceBeforeUser1.add(stakedTellerBeforeUser1).toNumber(),
        'balance user1 should be original balance + amount staked in shop',
      );

      assert.equal(
        stakedTellerAfterUser1.toNumber(),
        0,
        'staked amount should be zero',
      );
    });

    it('should be able to delete a random shop as a moderator', async () => {
      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, shopToContract(shop1)],
      );

      await web3.eth.sendTransaction({
        from: user1address,
        to: dthToken.address,
        data: transferMethodTransactionData,
        value: 0,
        gas: 5000000,
      });

      assert.equal(await dether.isShop(user1address), true, 'shop should be true since its now online');

      await dether.deleteShopMods(user1address, {
        from: moderator,
        gas: 4000000,
      });

      assert.equal(await dether.isShop(user1address), false, 'shop should be false since we deleted it');
    });

    it('should not be be able to delete a random shop if not moderator', async () => {
      assert.equal(await dether.isShop(user1address), false, 'assert is shop pref delete');

      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, shopToContract(shop1)],
      );

      await web3.eth.sendTransaction({
        from: user1address,
        to: dthToken.address,
        data: transferMethodTransactionData,
        value: 0,
        gas: 5000000,
      });

      assert.equal(
        await dether.isShop(user1address),
        true,
        'shop should be true since its now online',
      );

      try {
        await dether.deleteShopMods(user1address, {
          from: cmo,
          gas: 4000000,
        });
      } catch (err) {
        // nothing
      }

      assert.equal(
        await dether.isShop(user1address),
        true,
        'shop should be true since its still online',
      );
    });
  });

  /*
   * Teller
   */

  contract('Add Teller --', async () => {
    it('should parse data and register and be on the map', async () => {
      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, tellerToContract(teller1)],
      );

      await web3.eth.sendTransaction({
        from: user1address,
        to: dthToken.address,
        data: transferMethodTransactionData,
        value: 0,
        gas: 5000000,
      });

      const teller1value = await dether.getTeller(user1address);

      const valueFromContract = tellerFromContract(teller1value);

      assert.equal(await dether.isTeller(user1address), true, 'shop should be true since its now online');

      assert.equal(valueFromContract.lat, teller1.lat, 'lat did not match');
      assert.equal(valueFromContract.lng, teller1.lng, 'lng did not match');
      assert.equal(valueFromContract.countryId, teller1.countryId, 'countryId did not match');
      assert.equal(valueFromContract.postalCode, teller1.postalCode, 'postalCode did not match');
      assert.equal(valueFromContract.currencyId, teller1.currencyId, 'currency did not match');
      assert.equal(valueFromContract.messenger, teller1.messenger, 'messenger did not match');
      assert.equal(valueFromContract.avatarId, teller1.avatarId, 'avatar did not match');
      assert.equal(valueFromContract.rates, teller1.rates, 'rate did not match');
      assert.equal(valueFromContract.online, true, 'status did not match');
      assert.equal(valueFromContract.buyer, teller1.buyer, 'buyer did not match');
    });

    it('should not be possible to add shop in unopened zone', async () => {
      await dether.closeZoneTeller(web3.toHex(teller3.countryId), { from: cmo });

      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, tellerToContract(teller3)],
      );

      try {
        await web3.eth.sendTransaction({
          from: user3address,
          to: dthToken.address,
          data: transferMethodTransactionData,
          value: 0,
          gas: 5000000,
        });
      } catch (err) {
        // nothing
      }

      assert.equal(await dether.isTeller(user3address), false, 'teller should be false since we closed it');
    });

    it('should get all teller in a zone', async () => {
      const zoneBefore = await dether.getZoneTeller(
        hexEncode(teller1.countryId),
        hexEncode(teller1.postalCode),
      );

      assert.equal(zoneBefore, '', 'zone should be empty string since it doesnt exist yet');

      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, tellerToContract(teller3)],
      );

      await web3.eth.sendTransaction({
        from: user1address,
        to: dthToken.address,
        data: transferMethodTransactionData,
        value: 0,
        gas: 5000000,
      });

      const transferMethodTransactionData2 = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, tellerToContract(teller2)],
      );

      await web3.eth.sendTransaction({
        from: user2address,
        to: dthToken.address,
        data: transferMethodTransactionData2,
        value: 0,
        gas: 5000000,
      });

      const zoneAfter = await dether.getZoneTeller(
        hexEncode(teller2.countryId),
        hexEncode(teller2.postalCode),
      );

      assert.deepEqual(zoneAfter, [user1address, user2address], `zone should have equaled: [${user1address}, ${user2address}]`);
    });

    it('should have empty zone after delete', async () => {
      const zoneBefore = await dether.getZoneTeller(
        web3.toHex(teller1.countryId),
        web3.toHex(teller1.postalCode),
      );

      assert.equal(zoneBefore, '', 'zone should be empty string since it doesnt exist yet');

      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, tellerToContract(teller1)],
      );

      await web3.eth.sendTransaction({
        from: user1address,
        to: dthToken.address,
        data: transferMethodTransactionData,
        value: 0,
        gas: 5000000,
      });

      const transferMethodTransactionData2 = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, tellerToContract(teller2)],
      );

      await web3.eth.sendTransaction({
        from: user2address,
        to: dthToken.address,
        data: transferMethodTransactionData2,
        value: 0,
        gas: 5000000,
      });

      assert.equal(await dether.isTeller(user1address), true, 'assert shop is now online');

      await dether.deleteTeller({ from: user1address, gas: 4000000 });
      await dether.deleteTeller({ from: user2address, gas: 4000000 });

      const zoneAfterTeller1 = await dether.getZoneTeller(
        hexEncode(teller1.countryId),
        hexEncode(teller1.postalCode),
      );
      assert.equal(zoneAfterTeller1, '', 'zone 1 should be empty string');

      const zoneAfterTeller2 = await dether.getZoneTeller(
        hexEncode(teller2.countryId),
        hexEncode(teller2.postalCode),
      );
      assert.equal(zoneAfterTeller2, '', 'zone 2 should be empty string');
    });

    it('should have token back after delete', async () => {
      const zoneBefore = await dether.getZoneTeller(
        web3.toHex(teller1.countryId),
        web3.toHex(teller1.postalCode),
      );
      assert.equal(zoneBefore, '', 'zone should be empty string');

      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, tellerToContract(teller1)],
      );

      await web3.eth.sendTransaction({
        from: user1address,
        to: dthToken.address,
        data: transferMethodTransactionData,
        value: 0,
        gas: 5000000,
      });

      const balanceBeforeUser1 = await dthToken.balanceOf(user1address);
      const stakedTellerBeforeUser1 = await dether.getStakedTeller(user1address);

      assert.equal(await dether.isTeller(user1address), true, 'teller should be true');

      await dether.deleteTeller({
        from: user1address,
        gas: 4000000,
      });

      const balanceAfterUser1 = await dthToken.balanceOf(user1address);
      const stakedTellerAfterUser1 = await dether.getStakedTeller(user1address);

      assert.equal(
        balanceAfterUser1.toNumber(),
        balanceBeforeUser1.add(stakedTellerBeforeUser1).toNumber(),
        'TODO',
      );

      assert.equal(
        stakedTellerAfterUser1.toNumber(),
        0,
        'staked token should be zero',
      );
    });

    it('should be able to delete a random shop as a moderator', async () => {
      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, tellerToContract(teller1)],
      );

      await web3.eth.sendTransaction({
        from: user1address,
        to: dthToken.address,
        data: transferMethodTransactionData,
        value: 0,
        gas: 5000000,
      });

      assert.equal(
        await dether.isTeller(user1address),
        true,
        'teller should be true since user 1 is a teller',
      );

      await dether.deleteTellerMods(user1address, {
        from: moderator,
        gas: 4000000,
      });

      assert.equal(
        await dether.isTeller(user1address),
        false,
        'teller should be false since user 1 no longer a teller',
      );
    });

    it('should not be be able to delete a random shop if not moderator', async () => {
      assert.equal(
        await dether.isTeller(user1address),
        false,
        'should be false since user 1 is not a teller',
      );

      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, tellerToContract(teller1)],
      );

      await web3.eth.sendTransaction({
        from: user1address,
        to: dthToken.address,
        data: transferMethodTransactionData,
        value: 0,
        gas: 5000000,
      });

      assert.equal(
        await dether.isTeller(user1address),
        true,
        'teller should be true since user 1 is a teller',
      );

      try {
        await dether.deleteTellerMods(user1address, {
          from: cmo,
          gas: 4000000,
        });
      } catch (err) {
        // nothing
      }

      assert.equal(
        await dether.isTeller(user1address),
        true,
        'should be true since user1 is teller',
      );
    });

    it('should get his ETH back when delete shop', async () => {
      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, tellerToContract(teller1)],
      );

      await web3.eth.sendTransaction({
        from: user1address,
        to: dthToken.address,
        data: transferMethodTransactionData,
        value: 0,
        gas: 5000000,
      });

      assert.equal(
        await dether.isTeller(user1address),
        true,
        'should be true, since user1 is now a teller',
      );

      await dether.addFunds({
        from: user1address,
        value: ethToWei(1),
      });

      assert.equal(
        weiToEth(await dether.getTellerBalance(user1address)),
        1,
        'teller balance should be 1 ETH',
      );

      const balancePreDeleteUser1 = await web3.eth.getBalance(user1address);

      await dether.deleteTeller({
        from: user1address,
        gas: 3000000,
      });

      const balancePostDeleteUser1 = await web3.eth.getBalance(user1address);

      const balanceTellerPostDeleteUser1 = await dether.getTellerBalance(user1address);

      assert.equal(
        balanceTellerPostDeleteUser1.toNumber(),
        0,
        'should be zero since we deleted the teller',
      );

      assert(
        balancePostDeleteUser1.gt(balancePreDeleteUser1),
        'balance should have increased since we got refunded the amount we added to the deleted teller',
      );
    });

    it('should update teller', async () => {
      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, tellerToContract(teller1)],
      );

      await web3.eth.sendTransaction({
        from: user1address,
        to: dthToken.address,
        data: transferMethodTransactionData,
        value: 0,
        gas: 5000000,
      });

      assert.equal(
        await dether.isTeller(user1address),
        true,
        'should be true, user1 is a teller',
      );

      await dether.updateTeller(
        9,
        web3.toHex('mehdi_dether'),
        7,
        289,
        false,
        { from: user1address },
      );

      const teller1value = await dether.getTeller(user1address);

      const teller = tellerFromContract(teller1value);

      assert.equal(
        await dether.isTeller(user1address),
        true,
        'assert shop is now online',
      );

      assert.equal(teller.lat, teller1.lat, 'lat did not match');
      assert.equal(teller.lng, teller1.lng, 'lng did not match');
      assert.equal(teller.countryId, teller1.countryId, 'countryId did not match');
      assert.equal(teller.postalCode, teller1.postalCode, 'postalCode did not match');
      assert.equal(teller.currencyId, 9, 'currency did not match');
      assert.equal(teller.messenger, 'mehdi_dether', 'messenger did not match');
      assert.equal(teller.avatarId, 7, 'avatar did not match');
      assert.equal(teller.rates, 28.9, 'rate did not match');
      assert.equal(teller.online, false, 'status did not match');
    });

    it('should have his reput upgrade when sell', async () => {
      const balanceReceiverBefore = await web3.eth.getBalance(moderator);

      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, tellerToContract(teller1)],
      );

      await web3.eth.sendTransaction({
        from: user1address,
        to: dthToken.address,
        data: transferMethodTransactionData,
        value: 0,
        gas: 5000000,
      });

      assert.equal(
        await dether.isTeller(user1address),
        true,
        'should be true since user 1 is a teller',
      );

      const weiToSell = ethToWei(0.1);

      await dether.addFunds({
        from: user1address,
        value: weiToSell,
      });

      assert.equal(
        (await dether.getTellerBalance(user1address)).toString(),
        weiToSell.toString(),
        'teller balance should equal added funds',
      );

      // sell 1 eth belonging to user1 to moderator
      await dether.sellEth(moderator, weiToSell, { from: user1address });

      assert.equal(
        (await dether.getTellerBalance(user1address)).toNumber(),
        0,
        'should be 0 since we sold all to moderator',
      );

      const balanceReceiverAfter = await web3.eth.getBalance(moderator);

      assert.equal(
        balanceReceiverBefore.add(weiToSell).toString(),
        balanceReceiverAfter.toString(),
        'should have increased by amount received',
      );

      const profileTellerUser1 = await dether.getReput(user1address);

      assert.equal(
        profileTellerUser1[2].toString(),
        1,
        '(nbTrade) should equal 1, the number of times this teller sold something',
      );
    });

    it('tier1 teller should be able to sell less than max daily limit eth', async () => {
      const balanceReceiverBefore = await web3.eth.getBalance(moderator);

      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, tellerToContract(teller1)],
      );

      await web3.eth.sendTransaction({
        from: user1address,
        to: dthToken.address,
        data: transferMethodTransactionData,
        value: 0,
        gas: 5000000,
      });

      assert.equal(
        await dether.isTeller(user1address),
        true,
        'should be true since user 1 is a teller',
      );

      const weiToSell = ethToWei(0.1);

      await dether.addFunds({
        from: user1address,
        value: weiToSell,
      });

      assert.equal(
        (await dether.getTellerBalance(user1address)).toNumber(),
        weiToSell,
        'teller balance should equal added funds',
      );

      await dether.sellEth(moderator, weiToSell, { from: user1address });

      assert.equal(
        (await dether.getTellerBalance(user1address)).toNumber(),
        0,
        'teller balance should be zero since we send all of it to the moderator',
      );

      const balanceReceiverAfter = await web3.eth.getBalance(moderator);

      assert.equal(
        balanceReceiverAfter.toString(),
        balanceReceiverBefore.add(weiToSell).toString(),
        'receiver balance should have increased by sold amount',
      );
    });

    it('tier2 teller should be able to sell less than max daily limit eth', async () => {
      const balanceReceiverBefore = await web3.eth.getBalance(moderator);

      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, tellerToContract(teller2)],
      );

      await web3.eth.sendTransaction({
        from: user2address,
        to: dthToken.address,
        data: transferMethodTransactionData,
        value: 0,
        gas: 5000000,
      });

      assert.equal(
        await dether.isTeller(user2address),
        true,
        'should be true since user 2 is a teller',
      );

      const weiToSell = ethToWei(0.1);

      await dether.addFunds({
        from: user2address,
        value: weiToSell,
      });

      assert.equal(
        (await dether.getTellerBalance(user2address)).toNumber(),
        weiToSell,
        'teller balance should equal added funds',
      );

      await dether.sellEth(moderator, weiToSell, { from: user2address });

      assert.equal(
        (await dether.getTellerBalance(user2address)).toNumber(),
        0,
        'teller balance should be zero since we send all of it to the moderator',
      );

      const balanceReceiverAfter = await web3.eth.getBalance(moderator);

      assert.equal(
        balanceReceiverAfter.toString(),
        balanceReceiverBefore.add(weiToSell).toString(),
        'receiver balance should have increased by sold amount',
      );
    });

    it('tier1 teller should be able to sell max daily limit of eth', async () => {
      const balanceReceiverBefore = await web3.eth.getBalance(moderator);

      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, tellerToContract(teller1)],
      );

      await web3.eth.sendTransaction({
        from: user1address,
        to: dthToken.address,
        data: transferMethodTransactionData,
        value: 0,
        gas: 5000000,
      });

      assert.equal(
        await dether.isTeller(user1address),
        true,
        'should be true since user 1 is a teller',
      );

      const usdDailyLimit = await dether.getSellDailyLimit(1, web3.toHex(teller1.countryId));
      const weiPriceOneUsd = await priceOracle.getWeiPriceOneUsd();
      const weiDailyLimit = usdDailyLimit.mul(weiPriceOneUsd);

      const weiToSell = weiDailyLimit;

      await dether.addFunds({
        from: user1address,
        value: weiToSell,
      });

      assert.equal(
        (await dether.getTellerBalance(user1address)).toString(),
        weiToSell.toString(),
        'teller balance should equal the added funds',
      );

      await dether.sellEth(moderator, weiToSell, { from: user1address });

      assert.equal(
        (await dether.getTellerBalance(user1address)).toNumber(),
        0,
        'teller balance should be zero since we send all of it to the moderator',
      );

      const balanceReceiverAfter = await web3.eth.getBalance(moderator);

      assert.equal(
        balanceReceiverAfter.toString(),
        balanceReceiverBefore.add(weiToSell).toString(),
        'receiver balance should have increased with the amount sold',
      );
    });

    it('tier2 teller should be able to sell max daily limit of eth', async () => {
      const balanceReceiverBefore = await web3.eth.getBalance(moderator);

      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, tellerToContract(teller2)],
      );

      await web3.eth.sendTransaction({
        from: user2address,
        to: dthToken.address,
        data: transferMethodTransactionData,
        value: 0,
        gas: 5000000,
      });

      assert.equal(
        await dether.isTeller(user2address),
        true,
        'should be true since user 2 is a teller',
      );

      const usdDailyLimit = await dether.getSellDailyLimit(2, web3.toHex(teller2.countryId));
      const weiPriceOneUsd = await priceOracle.getWeiPriceOneUsd();
      const weiDailyLimit = usdDailyLimit.mul(weiPriceOneUsd);

      const weiToSell = weiDailyLimit;

      await dether.addFunds({
        from: user2address,
        value: weiToSell,
      });

      assert.equal(
        (await dether.getTellerBalance(user2address)).toString(),
        weiToSell.toString(),
        'teller balance should equal the added funds',
      );

      await dether.sellEth(moderator, weiToSell, { from: user2address });

      assert.equal(
        (await dether.getTellerBalance(user2address)).toNumber(),
        0,
        'teller balance should be zero since we send all of it to the moderator',
      );

      const balanceReceiverAfter = await web3.eth.getBalance(moderator);

      assert.equal(
        balanceReceiverAfter.toString(),
        balanceReceiverBefore.add(weiToSell).toString(),
        'receiver balance should have increased with the amount sold',
      );
    });

    it('tier1 teller should not be able to sell more eth than max daily tier1 limit (1 tx)', async () => {
      const balanceReceiverBefore = await web3.eth.getBalance(moderator);

      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, tellerToContract(teller1)],
      );

      await web3.eth.sendTransaction({
        from: user1address,
        to: dthToken.address,
        data: transferMethodTransactionData,
        value: 0,
        gas: 5000000,
      });

      assert.equal(
        await dether.isTeller(user1address),
        true,
        'should be true since user 1 is a teller',
      );

      const usdDailyLimit = await dether.getSellDailyLimit(1, web3.toHex(teller1.countryId));
      const weiPriceOneUsd = await priceOracle.getWeiPriceOneUsd();
      const weiDailyLimit = usdDailyLimit.mul(weiPriceOneUsd);

      // try to sell a bit more than the daily limit wei
      const weiToSell = weiDailyLimit.add(1);

      await dether.addFunds({
        from: user1address,
        value: weiToSell,
      });

      const balanceTellerBefore = await dether.getTellerBalance(user1address);

      assert.equal(
        balanceTellerBefore.toString(),
        weiToSell.toString(),
        'teller balance of user 1 should equal the added funds',
      );

      // should throw since sell amount exceeds daily limit for tier 1
      let caughtError = false;
      try {
        await dether.sellEth(moderator, weiToSell, { from: user1address });
      } catch (err) {
        caughtError = true;
      }
      assert(caughtError, true, 'dether.sellEth should have thrown');

      const balanceTellerAfter = await dether.getTellerBalance(user1address);

      assert.equal(
        balanceTellerBefore.toString(),
        balanceTellerAfter.toString(),
        'teller balance should not have changed',
      );

      const balanceReceiverAfter = await web3.eth.getBalance(moderator);

      assert.equal(
        balanceReceiverAfter.toString(),
        balanceReceiverBefore.toString(),
        'receiver balance should not have changed',
      );
    });

    it('tier2 teller should not be able to sell more eth than max daily tier2 limit (1 tx)', async () => {
      const balanceReceiverBefore = await web3.eth.getBalance(moderator);

      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, tellerToContract(teller2)],
      );

      await web3.eth.sendTransaction({
        from: user2address,
        to: dthToken.address,
        data: transferMethodTransactionData,
        value: 0,
        gas: 5000000,
      });

      assert.equal(
        await dether.isTeller(user2address),
        true,
        'should be true since user 2 is a teller',
      );

      const usdDailyLimit = await dether.getSellDailyLimit(2, web3.toHex(teller2.countryId));
      const weiPriceOneUsd = await priceOracle.getWeiPriceOneUsd();
      const weiDailyLimit = usdDailyLimit.mul(weiPriceOneUsd);

      // try to sell a bit more than the daily limit wei
      const weiToSell = weiDailyLimit.add(1);

      await dether.addFunds({
        from: user2address,
        value: weiToSell,
      });

      const balanceTellerBefore = await dether.getTellerBalance(user2address);

      assert.equal(
        balanceTellerBefore.toString(),
        weiToSell.toString(),
        'teller balance of user 1 should equal the added funds',
      );

      // should throw since sell amount exceeds daily limit for tier 2
      let caughtError = false;
      try {
        await dether.sellEth(moderator, weiToSell, { from: user2address });
      } catch (err) {
        caughtError = true;
      }
      assert(caughtError, true, 'dether.sellEth should have thrown');

      const balanceTellerAfter = await dether.getTellerBalance(user2address);

      assert.equal(
        balanceTellerBefore.toString(),
        balanceTellerAfter.toString(),
        'teller balance should not have changed',
      );

      const balanceReceiverAfter = await web3.eth.getBalance(moderator);

      assert.equal(
        balanceReceiverBefore.toString(),
        balanceReceiverAfter.toString(),
        'receiver balance should not have changed',
      );
    });

    it('tier1 teller should not be able to sell more eth than max daily tier1 limit (multiple tx)', async () => {
      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, tellerToContract(teller1)],
      );

      await web3.eth.sendTransaction({
        from: user1address,
        to: dthToken.address,
        data: transferMethodTransactionData,
        value: 0,
        gas: 5000000,
      });

      assert.equal(
        await dether.isTeller(user1address),
        true,
        'should be true since user 1 is a teller',
      );

      const usdDailyLimit = await dether.getSellDailyLimit(1, web3.toHex(teller1.countryId));
      const weiPriceOneUsd = await priceOracle.getWeiPriceOneUsd();
      const weiDailyLimit = usdDailyLimit.mul(weiPriceOneUsd);

      //
      // first sell
      //

      const weiSoldTodayBefore1 = await detherBank.getWeiSoldToday(user1address);
      const balanceReceiverBefore1 = await web3.eth.getBalance(moderator);

      assert.equal(
        weiSoldTodayBefore1.toNumber(),
        0,
        'should  be zero since didnt sell anything yet',
      );

      // first, sell half of allowed daily limit
      const weiToSell1 = weiDailyLimit.div(2);

      await dether.addFunds({
        from: user1address,
        value: weiToSell1,
      });

      const balanceTellerBefore1 = await dether.getTellerBalance(user1address);

      assert.equal(
        balanceTellerBefore1.toString(),
        weiToSell1.toString(),
        'teller balance of user 1 should equal the added funds',
      );

      await dether.sellEth(moderator, weiToSell1, { from: user1address });

      const weiSoldTodayAfter1 = await detherBank.getWeiSoldToday(user1address);
      const balanceTellerAfter1 = await dether.getTellerBalance(user1address);

      assert.equal(
        weiSoldTodayBefore1.add(weiToSell1).toString(),
        weiSoldTodayAfter1.toString(),
        'should reflect the sold eth',
      );

      assert.equal(
        balanceTellerAfter1.toNumber(),
        0,
        'teller balance should be zero since we send all of it to the moderator',
      );

      const balanceReceiverAfter1 = await web3.eth.getBalance(moderator);

      assert.equal(
        balanceReceiverAfter1.toString(),
        balanceReceiverBefore1.add(weiToSell1).toString(),
        'receiver balance should have increased with the amount sold',
      );

      //
      // second sell
      //

      const balanceReceiverBefore2 = await web3.eth.getBalance(moderator);

      // second, try to sell full daily limit
      const weiToSell2 = weiDailyLimit;

      const balanceTellerBefore2 = await dether.getTellerBalance(user1address);

      // should throw since sell amount exceeds daily limit for tier 1
      let caughtError = false;
      try {
        await dether.sellEth(moderator, weiToSell2, { from: user1address });
      } catch (err) {
        caughtError = true;
      }
      assert(caughtError, true, 'dether.sellEth should have thrown');

      const weiSoldTodayAfter2 = await detherBank.getWeiSoldToday(user1address);
      const balanceTellerAfter2 = await dether.getTellerBalance(user1address);

      assert.equal(
        weiSoldTodayAfter1.toString(),
        weiSoldTodayAfter2.toString(),
        'should not have changed since sell failed',
      );

      assert.equal(
        balanceTellerAfter2.toString(),
        balanceTellerBefore2.toString(),
        'teller balance should not have changed since sell failed',
      );

      const balanceReceiverAfter2 = await web3.eth.getBalance(moderator);

      assert.equal(
        balanceReceiverBefore2.toString(),
        balanceReceiverAfter2.toString(),
        'receiver balance should not have changed',
      );
    });

    it('tier2 teller should not be able to sell more eth than max daily tier2 limit (multiple tx)', async () => {
      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, tellerToContract(teller2)],
      );

      await web3.eth.sendTransaction({
        from: user2address,
        to: dthToken.address,
        data: transferMethodTransactionData,
        value: 0,
        gas: 5000000,
      });

      assert.equal(
        await dether.isTeller(user2address),
        true,
        'should be true since user 2 is a teller',
      );

      const usdDailyLimit = await dether.getSellDailyLimit(2, web3.toHex(teller2.countryId));
      const weiPriceOneUsd = await priceOracle.getWeiPriceOneUsd();
      const weiDailyLimit = usdDailyLimit.mul(weiPriceOneUsd);

      //
      // first sell
      //

      const weiSoldTodayBefore1 = await detherBank.getWeiSoldToday(user2address);
      const balanceReceiverBefore1 = await web3.eth.getBalance(moderator);

      assert.equal(
        weiSoldTodayBefore1.toNumber(),
        0,
        'should  be zero since didnt sell anything yet',
      );

      // first, sell half of allowed daily limit
      const weiToSell1 = weiDailyLimit.div(2);

      await dether.addFunds({
        from: user2address,
        value: weiToSell1,
      });

      const balanceTellerBefore1 = await dether.getTellerBalance(user2address);

      assert.equal(
        balanceTellerBefore1.toString(),
        weiToSell1.toString(),
        'teller balance of user 2 should equal the added funds',
      );

      await dether.sellEth(moderator, weiToSell1, { from: user2address });

      const weiSoldTodayAfter1 = await detherBank.getWeiSoldToday(user2address);
      const balanceTellerAfter1 = await dether.getTellerBalance(user2address);

      assert.equal(
        weiSoldTodayBefore1.add(weiToSell1).toString(),
        weiSoldTodayAfter1.toString(),
        'should reflect the sold eth',
      );

      assert.equal(
        balanceTellerAfter1.toNumber(),
        0,
        'teller balance should be zero since we send all of it to the moderator',
      );

      const balanceReceiverAfter1 = await web3.eth.getBalance(moderator);

      assert.equal(
        balanceReceiverAfter1.toString(),
        balanceReceiverBefore1.add(weiToSell1).toString(),
        'receiver balance should have increased with the amount sold',
      );

      //
      // second sell
      //

      const balanceReceiverBefore2 = await web3.eth.getBalance(moderator);

      // second, try to sell full daily limit
      const weiToSell2 = weiDailyLimit;

      const balanceTellerBefore2 = await dether.getTellerBalance(user2address);

      // should throw since sell amount exceeds daily limit for tier 1
      let caughtError = false;
      try {
        await dether.sellEth(moderator, weiToSell2, { from: user2address });
      } catch (err) {
        caughtError = true;
      }
      assert(caughtError, true, 'dether.sellEth should have thrown');

      const weiSoldTodayAfter2 = await detherBank.getWeiSoldToday(user2address);
      const balanceTellerAfter2 = await dether.getTellerBalance(user2address);

      assert.equal(
        weiSoldTodayAfter1.toString(),
        weiSoldTodayAfter2.toString(),
        'should not have changed since sell failed',
      );

      assert.equal(
        balanceTellerAfter2.toString(),
        balanceTellerBefore2.toString(),
        'teller balance should not have changed since sell failed',
      );

      const balanceReceiverAfter2 = await web3.eth.getBalance(moderator);

      assert.equal(
        balanceReceiverBefore2.toString(),
        balanceReceiverAfter2.toString(),
        'receiver balance should not have changed',
      );
    });
    it('loyalty points decrease 21% with each sell between same teller and buyer (both sms certified)', async () => {
      const balanceReceiverBefore = await web3.eth.getBalance(user2address);

      //
      // make user1address a Teller
      //

      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [dether.address, 20, tellerToContract(teller1)],
      );

      await web3.eth.sendTransaction({
        from: user1address,
        to: dthToken.address,
        data: transferMethodTransactionData,
        value: 0,
        gas: 5000000,
      });

      assert.equal(
        await dether.isTeller(user1address),
        true,
        'should be true since user 1 is a teller',
      );

      const weiToSell = new web3.toBigNumber(ethToWei(0.4));

      await dether.addFunds({
        from: user1address,
        value: weiToSell,
      });

      //
      // before checks
      //

      assert.equal(
        (await dether.getTellerBalance(user1address)).toNumber(),
        weiToSell,
        'teller balance should equal added funds',
      );

      const loyaltyPercBefore = await dether.getPairSellLoyaltyPerc(user1address, user2address);

      assert.equal(
        loyaltyPercBefore.toString(),
        '0',
        'loyalty percentage should be 0 before first sell',
      );

      const loyaltyPointsBefore = await dether.getLoyaltyPoints(user1address);

      //
      // first sell
      //

      await dether.sellEth(user2address, weiToSell.div(4), { from: user1address });

      const loyaltyPercAfter1 = await dether.getPairSellLoyaltyPerc(user1address, user2address);

      assert.equal(
        loyaltyPercAfter1.toString(),
        '7900',
        'loyalty percentage should have decreased by 21% after first sell (=79,00%)',
      );

      const loyaltyPointsAfter1 = await dether.getLoyaltyPoints(user1address);

      assert.equal(
        weiToSell.div(4).toString(),
        loyaltyPointsAfter1.toString(),
        'loyalty points should have increased by 100% of the sold wei amount',
      );

      //
      // second sell
      //

      await dether.sellEth(user2address, weiToSell.div(4), { from: user1address });

      const loyaltyPercAfter2 = await dether.getPairSellLoyaltyPerc(user1address, user2address);

      assert.equal(
        loyaltyPercAfter1.mul(79).div(100).toFixed(0),
        loyaltyPercAfter2.toString(),
        'loyalty percentage should have decreased by 21% after second sell (=62,41%)',
      );

      const loyaltyPointsAfter2 = await dether.getLoyaltyPoints(user1address);

      assert.equal(
        loyaltyPointsAfter1.add(weiToSell.div(4).mul(79).div(100)).toString(),
        loyaltyPointsAfter2.toString(),
        'loyalty points should have increased by 79% of the sold wei amount',
      );

      //
      // third sell
      //

      await dether.sellEth(user2address, weiToSell.div(4), { from: user1address });

      const loyaltyPercAfter3 = await dether.getPairSellLoyaltyPerc(user1address, user2address);

      assert.equal(
        loyaltyPercAfter2.mul(79).div(100).toFixed(0),
        loyaltyPercAfter3.toString(),
        'loyalty percentage should have decreased by 21% after third sell (=49,30%)',
      );

      const loyaltyPointsAfter3 = await dether.getLoyaltyPoints(user1address);

      assert.equal(
        loyaltyPointsAfter2.add(weiToSell.div(4).mul(62.41).div(100)).toString(),
        loyaltyPointsAfter3.toString(),
        'loyalty points should have increased by 62,41% of the sold wei amount',
      );

      //
      // fourth sell
      //

      await dether.sellEth(user2address, weiToSell.div(4), { from: user1address });

      const loyaltyPercAfter4 = await dether.getPairSellLoyaltyPerc(user1address, user2address);

      assert.equal(
        loyaltyPercAfter3.mul(79).div(100).toFixed(0),
        loyaltyPercAfter4.toString(),
        'loyalty percentage should have decreased by 21% after fourth sell (=38,94%)',
      );

      const loyaltyPointsAfter4 = await dether.getLoyaltyPoints(user1address);

      assert.equal(
        loyaltyPointsAfter3.add(weiToSell.div(4).mul(49.30).div(100)).toString(),
        loyaltyPointsAfter4.toString(),
        'loyalty points should have increased by 49,30% of the sold wei amount',
      );

      //
      // after checks
      //

      assert.equal(
        (await dether.getTellerBalance(user1address)).toNumber(),
        0,
        'teller balance should be zero since we send all of it to user2',
      );

      const balanceReceiverAfter = await web3.eth.getBalance(user2address);

      assert.equal(
        balanceReceiverAfter.toString(),
        balanceReceiverBefore.add(weiToSell).toString(),
        'receiver balance should have increased by sold amount',
      );
    });
  });
});
