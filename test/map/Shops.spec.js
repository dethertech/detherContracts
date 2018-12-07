/* eslint-env mocha */
/* global artifacts, contract, expect */
/* eslint-disable max-len, no-multi-spaces, object-curly-newline */

const DetherToken = artifacts.require('DetherToken.sol');
const Control = artifacts.require('Control.sol');
const FakeExchangeRateOracle = artifacts.require('FakeExchangeRateOracle.sol');
const SmsCertifier = artifacts.require('SmsCertifier.sol');
const KycCertifier = artifacts.require('KycCertifier.sol');
const Users = artifacts.require('Users.sol');
const GeoRegistry = artifacts.require('GeoRegistry.sol');
const Shops = artifacts.require('Shops.sol');

const Web3 = require('web3');

const { getAccounts } = require('../utils');
const { addCountry } = require('../utils/geo');
const { expectRevert, expectRevert2 } = require('../utils/evmErrors');
const { ethToWei, asciiToHex, remove0x } = require('../utils/convert');
const {
  BYTES16_ZERO, BYTES32_ZERO, COUNTRY_CG, VALID_CG_SHOP_GEOHASH, VALID_CG_SHOP_GEOHASH_2,
  INVALID_CG_SHOP_GEOHASH, NONEXISTING_CG_SHOP_GEOHASH, CG_SHOP_LICENSE_PRICE,
} = require('../utils/values');

const web3 = new Web3('http://localhost:8545');

const createDthShopCreateData = (shopsAddr, dthAmount, shopData) => {
  const fnSig = web3.eth.abi.encodeFunctionSignature('transfer(address,uint256,bytes)');
  const data = `0x30${Object.keys(shopData).map(k => remove0x(shopData[k])).join('')}`;
  const params = web3.eth.abi.encodeParameters(
    ['address', 'uint256', 'bytes'],
    [shopsAddr, ethToWei(dthAmount), data],
  );
  return [fnSig, params.slice(2)].join('');
};

const sendDthShopCreate = async (from, to, recipient, dthAmount, shopData) => {
  const tx = await web3.eth.sendTransaction({
    from,
    to,
    data: createDthShopCreateData(recipient, dthAmount, shopData),
    value: 0,
    gas: 4700000,
  });
  return tx;
};

contract.only('Shops', () => {
  let owner;
  let user1;
  let user2;
  let user3;
  let user4;

  let controlInstance;
  let smsInstance;
  let kycInstance;
  let priceInstance;
  let dthInstance;
  let usersInstance;
  let geoInstance;
  let shopsInstance;

  before(async () => {
    // ROOT_TIME = await getLastBlockTimestamp();
    ([owner, user1, user2, user3, user4] = await getAccounts(web3));
  });

  beforeEach(async () => {
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
    await smsInstance.addDelegate(owner, { from: owner });

    shopsInstance = await Shops.new(
      dthInstance.address,
      geoInstance.address,
      usersInstance.address,
      controlInstance.address,
      { from: owner },
    );

    shopsInstance.setLicensePrice(asciiToHex(COUNTRY_CG), ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
  });

  const enableAndLoadCountry = async (countryCode) => {
    await addCountry(owner, web3, geoInstance, countryCode, 300);
    await geoInstance.enableCountry(countryCode, { from: owner });
  };

  describe('Setters', () => {
    describe('addShop(bytes2 _countryCode, bytes _position, bytes16 _category, bytes16 _name, bytes32 _description, bytes16 _opening)', () => {
      it('[error] -- global pause enabled', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        await smsInstance.certify(user1, { from: owner });
        await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
        await controlInstance.pause({ from: owner });
        await expectRevert2(
          sendDthShopCreate(
            user1, dthInstance.address, shopsInstance.address,
            CG_SHOP_LICENSE_PRICE,
            {
              country: asciiToHex(COUNTRY_CG),
              position: asciiToHex(VALID_CG_SHOP_GEOHASH),
              category: BYTES16_ZERO,
              name: BYTES16_ZERO,
              description: BYTES32_ZERO,
              opening: BYTES16_ZERO,
            },
            { from: user1 },
          ),
          'contract is paused',
        );
      });
      it('[error] -- country disabled', async () => {
        await smsInstance.certify(user1, { from: owner });
        await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
        await expectRevert2(
          sendDthShopCreate(
            user1, dthInstance.address, shopsInstance.address,
            CG_SHOP_LICENSE_PRICE,
            {
              country: asciiToHex(COUNTRY_CG),
              position: asciiToHex(VALID_CG_SHOP_GEOHASH),
              category: BYTES16_ZERO,
              name: BYTES16_ZERO,
              description: BYTES32_ZERO,
              opening: BYTES16_ZERO,
            },
            { from: user1 },
          ),
          'country is disabled',
        );
      });
      it('[error] -- user not registered', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
        await expectRevert2(
          sendDthShopCreate(
            user1, dthInstance.address, shopsInstance.address,
            CG_SHOP_LICENSE_PRICE,
            {
              country: asciiToHex(COUNTRY_CG),
              position: asciiToHex(VALID_CG_SHOP_GEOHASH),
              category: BYTES16_ZERO,
              name: BYTES16_ZERO,
              description: BYTES32_ZERO,
              opening: BYTES16_ZERO,
            },
            { from: user1 },
          ),
          'user not certified',
        );
      });
      it('[error] -- user already has shop', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        await smsInstance.certify(user1, { from: owner });
        await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
        await shopsInstance.addShop(asciiToHex(COUNTRY_CG), asciiToHex(VALID_CG_SHOP_GEOHASH), BYTES16_ZERO, BYTES16_ZERO, BYTES32_ZERO, BYTES16_ZERO, { from: user1 });
        await expectRevert2(
          sendDthShopCreate(
            user1, dthInstance.address, shopsInstance.address,
            CG_SHOP_LICENSE_PRICE,
            {
              country: asciiToHex(COUNTRY_CG),
              position: asciiToHex(VALID_CG_SHOP_GEOHASH_2),
              category: BYTES16_ZERO,
              name: BYTES16_ZERO,
              description: BYTES32_ZERO,
              opening: BYTES16_ZERO,
            },
            { from: user1 },
          ),
          'caller already has shop',
        );
      });
      it('[error] -- there already is a shop at this geohash12', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        await smsInstance.certify(user1, { from: owner });
        await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
        await sendDthShopCreate(
          user1, dthInstance.address, shopsInstance.address,
          CG_SHOP_LICENSE_PRICE,
          {
            country: asciiToHex(COUNTRY_CG),
            position: asciiToHex(VALID_CG_SHOP_GEOHASH),
            category: BYTES16_ZERO,
            name: BYTES16_ZERO,
            description: BYTES32_ZERO,
            opening: BYTES16_ZERO,
          },
          { from: user1 },
        );

        await smsInstance.certify(user2, { from: owner });
        await dthInstance.mint(user2, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
        await expectRevert2(
          sendDthShopCreate(
            user2, dthInstance.address, shopsInstance.address,
            CG_SHOP_LICENSE_PRICE,
            {
              country: asciiToHex(COUNTRY_CG),
              position: asciiToHex(VALID_CG_SHOP_GEOHASH),
              category: BYTES16_ZERO,
              name: BYTES16_ZERO,
              description: BYTES32_ZERO,
              opening: BYTES16_ZERO,
            },
            { from: user2 },
          ),
          'shop already exists at position',
        );
      });
      it('[error] -- invalid geohash chars', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        await smsInstance.certify(user1, { from: owner });
        await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
        await expectRevert2(
          sendDthShopCreate(
            user1, dthInstance.address, shopsInstance.address,
            CG_SHOP_LICENSE_PRICE,
            {
              country: asciiToHex(COUNTRY_CG),
              position: asciiToHex(INVALID_CG_SHOP_GEOHASH),
              category: BYTES16_ZERO,
              name: BYTES16_ZERO,
              description: BYTES32_ZERO,
              opening: BYTES16_ZERO,
            },
            { from: user1 },
          ),
          'invalid geohash characters in position',
        );
      });
      it('[error] -- zone not inside country', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        await smsInstance.certify(user1, { from: owner });
        await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
        await expectRevert2(
          sendDthShopCreate(
            user1, dthInstance.address, shopsInstance.address,
            CG_SHOP_LICENSE_PRICE,
            {
              country: asciiToHex(COUNTRY_CG),
              position: asciiToHex(NONEXISTING_CG_SHOP_GEOHASH),
              category: BYTES16_ZERO,
              name: BYTES16_ZERO,
              description: BYTES32_ZERO,
              opening: BYTES16_ZERO,
            },
            { from: user1 },
          ),
          'zone is not inside country',
        );
      });
      it('[error] -- dth stake less than license price', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        await smsInstance.certify(user1, { from: owner });
        await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE - 1), { from: owner });
        await expectRevert2(
          sendDthShopCreate(
            user1, dthInstance.address, shopsInstance.address,
            CG_SHOP_LICENSE_PRICE - 1,
            {
              country: asciiToHex(COUNTRY_CG),
              position: asciiToHex(VALID_CG_SHOP_GEOHASH),
              category: BYTES16_ZERO,
              name: BYTES16_ZERO,
              description: BYTES32_ZERO,
              opening: BYTES16_ZERO,
            },
            { from: user1 },
          ),
          'send dth is less than shop license price',
        );
      });
      it('[success]', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        await smsInstance.certify(user1, { from: owner });
        await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
        await sendDthShopCreate(
          user1, dthInstance.address, shopsInstance.address,
          CG_SHOP_LICENSE_PRICE,
          {
            country: asciiToHex(COUNTRY_CG),
            position: asciiToHex(VALID_CG_SHOP_GEOHASH),
            category: BYTES16_ZERO,
            name: BYTES16_ZERO,
            description: BYTES32_ZERO,
            opening: BYTES16_ZERO,
          },
          { from: user1 },
        );
      });
    });

    describe('removeShop(bytes12 _position)', () => {

    });
  });

  describe('Getters', () => { });
});
