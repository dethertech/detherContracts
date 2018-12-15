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
const CentralizedArbitrator = artifacts.require('CentralizedArbitrator.sol');
const AppealableArbitrator = artifacts.require('AppealableArbitrator.sol');

const Web3 = require('web3');

const { getAccounts } = require('../utils');
const { addCountry } = require('../utils/geo');
const { expectRevert, expectRevert2 } = require('../utils/evmErrors');
const { ethToWei, asciiToHex, remove0x } = require('../utils/convert');
const {
  BYTES12_ZERO, BYTES16_ZERO, BYTES32_ZERO, COUNTRY_CG, VALID_CG_SHOP_GEOHASH,
  VALID_CG_SHOP_GEOHASH_2, INVALID_CG_SHOP_GEOHASH, NONEXISTING_CG_SHOP_GEOHASH,
  CG_SHOP_LICENSE_PRICE, KLEROS_ARBITRATION_PRICE, ADDRESS_ZERO, KLEROS_DISPUTE_TIMEOUT,
  KLEROS_ARBITRATOR_EXTRADATA,
} = require('../utils/values');

const web3 = new Web3('http://localhost:8545');

const createDthShopCreateDataBytes = (fnByte, shopData) => (
  `${fnByte}${Object.keys(shopData).map(k => remove0x(shopData[k])).join('')}`
);

const createDthShopCreateData = (shopsAddr, dthAmount, shopData, fnByte) => {
  const fnSig = web3.eth.abi.encodeFunctionSignature('transfer(address,uint256,bytes)');
  const data = createDthShopCreateDataBytes(fnByte, shopData);
  const params = web3.eth.abi.encodeParameters(
    ['address', 'uint256', 'bytes'],
    [shopsAddr, ethToWei(dthAmount), data],
  );
  return [fnSig, params.slice(2)].join('');
};

const sendDthShopCreate = async (from, to, recipient, dthAmount, shopData, fnByte = '0x30') => {
  const tx = await web3.eth.sendTransaction({
    from,
    to,
    data: createDthShopCreateData(recipient, dthAmount, shopData, fnByte),
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
  let centralizedArbitratorInstance;
  let appealableArbitratorInstance;

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

    centralizedArbitratorInstance = await CentralizedArbitrator.new(
      ethToWei(KLEROS_ARBITRATION_PRICE),
      { from: owner },
    );

    appealableArbitratorInstance = await AppealableArbitrator.new(
      ethToWei(KLEROS_ARBITRATION_PRICE),
      centralizedArbitratorInstance.address,
      KLEROS_ARBITRATOR_EXTRADATA,
      KLEROS_DISPUTE_TIMEOUT,
      { from: owner },
    );

    shopsInstance = await Shops.new(
      dthInstance.address,
      geoInstance.address,
      usersInstance.address,
      controlInstance.address,
      appealableArbitratorInstance.address,
      KLEROS_ARBITRATOR_EXTRADATA,
      { from: owner },
    );

    shopsInstance.setCountryLicensePrice(asciiToHex(COUNTRY_CG), ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
  });

  const enableAndLoadCountry = async (countryCode) => {
    await addCountry(owner, web3, geoInstance, countryCode, 300);
    await geoInstance.enableCountry(countryCode, { from: owner });
  };

  describe('Setters', () => {
    describe('setCountryLicensePrice(bytes2 _countryCode, uint _priceDth)', () => {
      it('[error] -- can only be called by CEO', async () => {
        await expectRevert(
          shopsInstance.setCountryLicensePrice(asciiToHex(COUNTRY_CG), CG_SHOP_LICENSE_PRICE, { from: user1 }),
          'can only be called by CEO',
        );
      });
      it('[success]', async () => {
        await shopsInstance.setCountryLicensePrice(asciiToHex(COUNTRY_CG), CG_SHOP_LICENSE_PRICE, { from: owner });
      });
    });
    describe('addShop(bytes2 _countryCode, bytes _position, bytes16 _category, bytes16 _name, bytes32 _description, bytes16 _opening)', () => {
      it('[error] -- can only be called by dth contract', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        await smsInstance.certify(user1, { from: owner });
        await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
        const addShopData = createDthShopCreateDataBytes('0x30', {
          country: asciiToHex(COUNTRY_CG),
          position: asciiToHex(VALID_CG_SHOP_GEOHASH),
          category: BYTES16_ZERO,
          name: BYTES16_ZERO,
          description: BYTES32_ZERO,
          opening: BYTES16_ZERO,
        });
        await expectRevert(
          shopsInstance.tokenFallback(user1, ethToWei(CG_SHOP_LICENSE_PRICE), addShopData, { from: user1 }),
          'can only be called by dth contract',
        );
      });
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
          ),
          'contract is paused',
        );
      });
      it('[error] -- bytes arg does not have length 95', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
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
              name: BYTES32_ZERO, // <-- should be bytes16(0)
              description: BYTES32_ZERO,
              opening: BYTES16_ZERO,
            },
          ),
          'addShop expects 95 bytes as data',
        );
      });
      it('[error] -- first byte is not 0x30', async () => {
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
            '0x99', // <-- incorrect fn byte, should be 0x30
          ),
          'incorrect first byte in data, expected 0x30',
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
          ),
          'country is disabled',
        );
      });
      it('[error] -- user not certified', async () => {
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
          ),
          'user not certified',
        );
      });
      it('[error] -- user already has shop', async () => {
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
        );

        await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
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
        );
      });
    });
    describe('removeShop(bytes12 _position)', () => {
      it('[error] -- contract is paused', async () => {
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
        );

        await controlInstance.pause({ from: owner });

        await expectRevert(
          shopsInstance.removeShop(asciiToHex(VALID_CG_SHOP_GEOHASH), { from: user1 }),
          'contract is paused',
        );
      });
      it('[error] -- user not certified', async () => {
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
        );
        await smsInstance.revoke(user1, { from: owner });
        await expectRevert(
          shopsInstance.removeShop(asciiToHex(VALID_CG_SHOP_GEOHASH), { from: user1 }),
          'user not certified',
        );
      });
      it('[error] -- position is bytes12(0)', async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        await smsInstance.certify(user1, { from: owner });

        await expectRevert(
          shopsInstance.removeShop(BYTES12_ZERO, { from: user1 }),
          'position cannot be bytes12(0)',
        );
      });
      it('[error] -- caller does not own shop', async () => {
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
        );
        await smsInstance.certify(user2, { from: owner });
        await expectRevert(
          shopsInstance.removeShop(asciiToHex(VALID_CG_SHOP_GEOHASH), { from: user2 }),
          'caller does not own shop at position',
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
        );
        await shopsInstance.removeShop(asciiToHex(VALID_CG_SHOP_GEOHASH), { from: user1 });
      });
    });
    describe('createDispute(bytes12 _position, uint _disputeTypeId, string _evidenceLink)', () => {
      it('[error] -- contract is paused', async () => {
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
        );

        await shopsInstance.addDisputeType('my first metaevidence line', { from: owner });
        await smsInstance.certify(user2, { from: owner });

        await controlInstance.pause({ from: owner });

        await expectRevert(
          shopsInstance.createDispute(asciiToHex(VALID_CG_SHOP_GEOHASH), 0, 'my evidence link', {
            from: user2,
            value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
          }),
          'contract is paused',
        );
      });
      it('[error] -- user not certified', async () => {
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
        );

        await shopsInstance.addDisputeType('my first metaevidence line', { from: owner });

        await expectRevert(
          shopsInstance.createDispute(asciiToHex(VALID_CG_SHOP_GEOHASH), 0, 'my evidence link', {
            from: user2,
            value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
          }),
          'user not certified',
        );
      });
      it('[error] -- dispute type does not exist', async () => {
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
        );

        await shopsInstance.addDisputeType('my first metaevidence line', { from: owner });
        await smsInstance.certify(user2, { from: owner });

        await expectRevert(
          shopsInstance.createDispute(asciiToHex(VALID_CG_SHOP_GEOHASH), 1, 'my evidence link', {
            from: user2,
            value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
          }),
          'dispute type does not exist',
        );
      });
      it('[error] -- evidence link is empty', async () => {
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
        );

        await shopsInstance.addDisputeType('my first metaevidence line', { from: owner });
        await smsInstance.certify(user2, { from: owner });

        await expectRevert(
          shopsInstance.createDispute(asciiToHex(VALID_CG_SHOP_GEOHASH), 0, '', {
            from: user2,
            value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
          }),
          'evidence link is empty',
        );
      });
      it('[error] -- shop does not exist', async () => {
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
        );

        await shopsInstance.addDisputeType('my first metaevidence line', { from: owner });
        await smsInstance.certify(user2, { from: owner });

        await expectRevert(
          shopsInstance.createDispute(asciiToHex(BYTES12_ZERO), 0, 'my evidence link', {
            from: user2,
            value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
          }),
          'no shop at that position',
        );
      });
      it('[error] -- shop owner cannot start dispute with his own shop', async () => {
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
        );

        await shopsInstance.addDisputeType('my first metaevidence line', { from: owner });

        await expectRevert(
          shopsInstance.createDispute(asciiToHex(VALID_CG_SHOP_GEOHASH), 0, 'my evidence link', {
            from: user1,
            value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
          }),
          'shop owner cannot start dispute on own shop',
        );
      });
      it('[error] -- cannot start dispute if shop already has dispute', async () => {
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
        );

        await shopsInstance.addDisputeType('my first metaevidence line', { from: owner });
        await smsInstance.certify(user2, { from: owner });

        await shopsInstance.createDispute(asciiToHex(VALID_CG_SHOP_GEOHASH), 0, 'my evidence link', {
          from: user2,
          value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        });

        await expectRevert(
          shopsInstance.createDispute(asciiToHex(VALID_CG_SHOP_GEOHASH), 0, 'my evidence link', {
            from: user2,
            value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
          }),
          'shop already has a dispute',
        );
      });
      it('[error] -- send eth is lower than arbitration cost', async () => {
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
        );

        await shopsInstance.addDisputeType('my first metaevidence line', { from: owner });
        await smsInstance.certify(user2, { from: owner });

        await expectRevert(
          shopsInstance.createDispute(asciiToHex(VALID_CG_SHOP_GEOHASH), 0, 'my evidence link', {
            from: user2,
            value: ethToWei(KLEROS_ARBITRATION_PRICE),
          }),
          'sent eth is lower than arbitration cost',
        );
      });
      it.only('[success]', async () => {
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
        );

        await shopsInstance.addDisputeType('my first metaevidence line', { from: owner });
        await smsInstance.certify(user2, { from: owner });

        await shopsInstance.createDispute(asciiToHex(VALID_CG_SHOP_GEOHASH), 0, 'my evidence link', {
          from: user2,
          value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        });

        const disputeBeforeRuling = await shopsInstance.getDispute(0);
        const disputeBeforeRulingObj = {
          shop: disputeBeforeRuling[0],
          challenger: disputeBeforeRuling[1],
          disputeType: disputeBeforeRuling[2].toNumber(),
          ruling: disputeBeforeRuling[3].toNumber(),
          status: disputeBeforeRuling[4].toNumber(),
        };
        console.log({ disputeBeforeRulingObj });
        expect(disputeBeforeRulingObj.shop).equals(user1.toLowerCase());
        expect(disputeBeforeRulingObj.challenger).equals(user2.toLowerCase());
        expect(disputeBeforeRulingObj.disputeType).equals(0);
        expect(disputeBeforeRulingObj.ruling).equals(0); // no ruling yet
        expect(disputeBeforeRulingObj.status).equals(0); // Waiting (on ruling)
      });
    });
    describe('appealDispute(uint _disputeID, string _evidenceLink)', () => {
      it.only('[success]', async () => {
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
        );
        await shopsInstance.addDisputeType('my first metaevidence line', { from: owner });
        await smsInstance.certify(user2, { from: owner });

        //
        // Create dispute
        //
        await shopsInstance.createDispute(asciiToHex(VALID_CG_SHOP_GEOHASH), 0, 'my evidence link', {
          from: user2,
          value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        });
        const disputeBeforeRuling = await shopsInstance.getDispute(0);
        const disputeBeforeRulingObj = {
          shop: disputeBeforeRuling[0],
          challenger: disputeBeforeRuling[1],
          disputeType: disputeBeforeRuling[2].toNumber(),
          ruling: disputeBeforeRuling[3].toNumber(),
          status: disputeBeforeRuling[4].toNumber(),
        };
        console.log({ disputeBeforeRulingObj });
        expect(disputeBeforeRulingObj.shop).equals(user1.toLowerCase());
        expect(disputeBeforeRulingObj.challenger).equals(user2.toLowerCase());
        expect(disputeBeforeRulingObj.disputeType).equals(0);
        expect(disputeBeforeRulingObj.ruling).equals(0); // no ruling yet
        expect(disputeBeforeRulingObj.status).equals(0); // Waiting (on ruling)

        //
        // Give ruling on dispute
        //
        await appealableArbitratorInstance.giveRuling(0, 1, { from: owner }); // dispute 0, shop wins
        const disputeBeforeAppeal = await shopsInstance.getDispute(0);
        const disputeBeforeAppealObj = {
          shop: disputeBeforeAppeal[0],
          challenger: disputeBeforeAppeal[1],
          disputeType: disputeBeforeAppeal[2].toNumber(),
          ruling: disputeBeforeAppeal[3].toNumber(),
          status: disputeBeforeAppeal[4].toNumber(),
        };
        console.log({ disputeBeforeAppealObj });
        expect(disputeBeforeAppealObj.shop).equals(user1.toLowerCase());
        expect(disputeBeforeAppealObj.challenger).equals(user2.toLowerCase());
        expect(disputeBeforeAppealObj.disputeType).equals(0);
        expect(disputeBeforeAppealObj.ruling).equals(1); // shop wins
        expect(disputeBeforeAppealObj.status).equals(1); // Appealable

        //
        // Appeal dispute ruling
        //
        await shopsInstance.appealDispute(0, 'my appeal evidence link', {
          from: user2, // challenger can appeal ruling that shop won
          value: ethToWei(KLEROS_ARBITRATION_PRICE),
        });
        const disputeAfterAppeal = await shopsInstance.getDispute(0);
        const disputeAfterAppealObj = {
          shop: disputeAfterAppeal[0],
          challenger: disputeAfterAppeal[1],
          disputeType: disputeAfterAppeal[2].toNumber(),
          ruling: disputeAfterAppeal[3].toNumber(),
          status: disputeAfterAppeal[4].toNumber(),
        };
        console.log({ disputeAfterAppealObj });
        expect(disputeAfterAppealObj.shop).equals(user1.toLowerCase());
        expect(disputeAfterAppealObj.challenger).equals(user2.toLowerCase());
        expect(disputeAfterAppealObj.disputeType).equals(0);
        expect(disputeAfterAppealObj.ruling).equals(1); // shop wins
        expect(disputeAfterAppealObj.status).equals(0); // Waiting (on ruling)

        //
        // Ruling on appeal
        //
        await centralizedArbitratorInstance.giveRuling(0, 2, { from: owner }); // dispute 0, challenger wins
        const disputeAfterAppealRuling = await shopsInstance.getDispute(0);
        const disputeAfterAppealRulingObj = {
          shop: disputeAfterAppealRuling[0],
          challenger: disputeAfterAppealRuling[1],
          disputeType: disputeAfterAppealRuling[2].toNumber(),
          ruling: disputeAfterAppealRuling[3].toNumber(),
          status: disputeAfterAppealRuling[4].toNumber(),
        };
        console.log({ disputeAfterAppealRulingObj });
        expect(disputeAfterAppealRulingObj.shop).equals(user1.toLowerCase());
        expect(disputeAfterAppealRulingObj.challenger).equals(user2.toLowerCase());
        expect(disputeAfterAppealRulingObj.disputeType).equals(0);
        expect(disputeAfterAppealRulingObj.ruling).equals(2); // challenger wins
        expect(disputeAfterAppealRulingObj.status).equals(2); // Resolved
        // so its not possible to appeal AGAIN ??
      });
    });
  });

  describe('Getters', () => { });
});
