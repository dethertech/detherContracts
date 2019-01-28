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
const AppealableArbitrator = artifacts.require('AppealableArbitrator.sol');
const CentralizedArbitrator = artifacts.require('CentralizedArbitrator.sol');

const Web3 = require('web3');

const TimeTravel = require('../utils/timeTravel');
const { addCountry } = require('../utils/geo');
const { expectRevert, expectRevert2 } = require('../utils/evmErrors');
const { ethToWei, asciiToHex, remove0x } = require('../utils/convert');
const {
  BYTES16_ZERO, BYTES32_ZERO, COUNTRY_CG, VALID_CG_SHOP_GEOHASH,
  VALID_CG_SHOP_GEOHASH_2, INVALID_CG_SHOP_GEOHASH, NONEXISTING_CG_SHOP_GEOHASH,
  CG_SHOP_LICENSE_PRICE, KLEROS_ARBITRATION_PRICE, ADDRESS_ZERO, KLEROS_DISPUTE_TIMEOUT,
  KLEROS_ARBITRATOR_EXTRADATA, KLEROS_SHOP_WINS, KLEROS_CHALLENGER_WINS, KLEROS_NO_RULING,
} = require('../utils/values');

const web3 = new Web3('http://localhost:8545');
const timeTravel = new TimeTravel(web3);

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

contract('Shops', (accounts) => {
  let owner, user1, user2, user3, user4; // eslint-disable-line

  let __rootState__; // eslint-disable-line no-underscore-dangle

  let controlInstance;
  let smsInstance;
  let kycInstance;
  let priceInstance;
  let dthInstance;
  let usersInstance;
  let geoInstance;
  let shopsInstance;
  let appealableArbitratorInstance;
  let centralizedArbitratorInstance;

  before(async () => {
    __rootState__ = await timeTravel.saveState();
    ([owner, user1, user2, user3, user4] = accounts);
  });

  beforeEach(async () => {
    await timeTravel.revertState(__rootState__); // to go back to real time
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

    await appealableArbitratorInstance.changeArbitrator(appealableArbitratorInstance.address, { from: owner });

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
    await geoInstance.enableCountry(asciiToHex(countryCode), { from: owner });
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
          shopsInstance.removeShop({ from: user1 }),
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
          shopsInstance.removeShop({ from: user1 }),
          'user not certified',
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
          shopsInstance.removeShop({ from: user2 }),
          'caller does not own shop',
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
        await shopsInstance.removeShop({ from: user1 });
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
          shopsInstance.createDispute(user1, 0, 'my evidence link', {
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
          shopsInstance.createDispute(user1, 0, 'my evidence link', {
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
          shopsInstance.createDispute(user1, 1, 'my evidence link', {
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
          shopsInstance.createDispute(user1, 0, '', {
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
          shopsInstance.createDispute(ADDRESS_ZERO, 0, 'my evidence link', {
            from: user2,
            value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
          }),
          'shop does not exist',
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
          shopsInstance.createDispute(user1, 0, 'my evidence link', {
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

        await shopsInstance.createDispute(user1, 0, 'my evidence link', {
          from: user2,
          value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        });

        await expectRevert(
          shopsInstance.createDispute(user1, 0, 'my evidence link', {
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
          shopsInstance.createDispute(user1, 0, 'my evidence link', {
            from: user2,
            value: ethToWei(KLEROS_ARBITRATION_PRICE),
          }),
          'sent eth is lower than arbitration cost',
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

        await shopsInstance.addDisputeType('my first metaevidence line', { from: owner });
        await smsInstance.certify(user2, { from: owner });

        await shopsInstance.createDispute(user1, 0, 'my evidence link', {
          from: user2,
          value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        });

        const disputeBeforeRuling = await shopsInstance.getDispute(0);
        const disputeBeforeRulingObj = {
          id: disputeBeforeRuling[0].toNumber(),
          shop: disputeBeforeRuling[1],
          challenger: disputeBeforeRuling[2],
          disputeType: disputeBeforeRuling[3].toNumber(),
          ruling: disputeBeforeRuling[4].toNumber(),
          status: disputeBeforeRuling[5].toNumber(),
        };
        expect(disputeBeforeRulingObj.id).equals(0);
        expect(disputeBeforeRulingObj.shop).equals(user1);
        expect(disputeBeforeRulingObj.challenger).equals(user2);
        expect(disputeBeforeRulingObj.disputeType).equals(0);
        expect(disputeBeforeRulingObj.ruling).equals(0); // no ruling yet
        expect(disputeBeforeRulingObj.status).equals(0); // Waiting (on ruling)
      });
    });
    describe('appealDispute(uint _disputeID, string _evidenceLink)', () => {
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

        const disputeId = 0;

        await shopsInstance.createDispute(user1, 0, 'my evidence link', {
          from: user2,
          value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        });

        await appealableArbitratorInstance.giveRuling(disputeId, KLEROS_SHOP_WINS, { from: owner }); // dispute 0, shop wins

        await controlInstance.pause({ from: owner });

        await expectRevert(
          shopsInstance.appealDispute(user1, 'my appeal evidence link', {
            from: user2, // challenger can appeal ruling that shop won
            value: ethToWei(KLEROS_ARBITRATION_PRICE),
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
        await smsInstance.certify(user2, { from: owner });

        const disputeId = 0;

        await shopsInstance.createDispute(user1, 0, 'my evidence link', {
          from: user2,
          value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        });

        await appealableArbitratorInstance.giveRuling(disputeId, KLEROS_SHOP_WINS, { from: owner }); // dispute 0, shop wins

        await smsInstance.revoke(user2, { from: owner });

        await expectRevert(
          shopsInstance.appealDispute(user1, 'my appeal evidence link', {
            from: user2, // challenger can appeal ruling that shop won
            value: ethToWei(KLEROS_ARBITRATION_PRICE),
          }),
          'user not certified',
        );
      });
      it('[error] -- empty evidence link', async () => {
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

        const disputeId = 0;

        await shopsInstance.createDispute(user1, 0, 'my evidence link', {
          from: user2,
          value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        });

        await appealableArbitratorInstance.giveRuling(disputeId, KLEROS_SHOP_WINS, { from: owner }); // dispute 0, shop wins

        await expectRevert(
          shopsInstance.appealDispute(user1, '', {
            from: user2, // challenger can appeal ruling that shop won
            value: ethToWei(KLEROS_ARBITRATION_PRICE),
          }),
          'evidence link is empty',
        );
      });
      it('[error] -- dispute is not appealable', async () => {
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

        const disputeId = 0;

        await shopsInstance.createDispute(user1, 0, 'my evidence link', {
          from: user2,
          value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        });

        await appealableArbitratorInstance.giveRuling(disputeId, KLEROS_SHOP_WINS, { from: owner }); // dispute 0, shop wins
        await timeTravel.inSecs(KLEROS_DISPUTE_TIMEOUT + 1);
        await appealableArbitratorInstance.giveRuling(disputeId, KLEROS_SHOP_WINS, { from: owner }); // to finalize

        await expectRevert(
          shopsInstance.appealDispute(user1, 'my evidence link', {
            from: user2, // challenger can appeal ruling that shop won
            value: ethToWei(KLEROS_ARBITRATION_PRICE),
          }),
          'shop has no active dispute',
        );
      });

      it('[error] -- challenger ruled to win, challenger cannot appeal', async () => {
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

        const disputeId = 0;

        await shopsInstance.createDispute(user1, 0, 'my evidence link', {
          from: user2,
          value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        });

        await appealableArbitratorInstance.giveRuling(disputeId, KLEROS_CHALLENGER_WINS, { from: owner }); // dispute 0, shop wins

        await expectRevert(
          shopsInstance.appealDispute(user1, 'my evidence link', {
            from: user2,
            value: ethToWei(KLEROS_ARBITRATION_PRICE),
          }),
          'challenger ruled to win, only shop can appeal',
        );
      });
      it('[error] -- shop ruled to win, shop cannot appeal', async () => {
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

        const disputeId = 0;

        await shopsInstance.createDispute(user1, 0, 'my evidence link', {
          from: user2,
          value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        });

        await appealableArbitratorInstance.giveRuling(disputeId, KLEROS_SHOP_WINS, { from: owner }); // dispute 0, shop wins

        await expectRevert(
          shopsInstance.appealDispute(user1, 'my evidence link', {
            from: user1,
            value: ethToWei(KLEROS_ARBITRATION_PRICE),
          }),
          'shop ruled to win, only challenger can appeal',
        );
      });
      it('[error] -- no party ruled to win, only challenger can appeal', async () => {
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

        const disputeId = 0;

        await shopsInstance.createDispute(user1, 0, 'my evidence link', {
          from: user2,
          value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        });

        await appealableArbitratorInstance.giveRuling(disputeId, KLEROS_NO_RULING, { from: owner }); // dispute 0, shop wins

        await expectRevert(
          shopsInstance.appealDispute(user1, 'my evidence link', {
            from: user1,
            value: ethToWei(KLEROS_ARBITRATION_PRICE),
          }),
          'no ruling given, only challenger can appeal',
        );
      });
      it('[error] -- send eth is lower than appeal cost', async () => {
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

        const disputeId = 0;

        await shopsInstance.createDispute(user1, 0, 'my evidence link', {
          from: user2,
          value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        });

        await appealableArbitratorInstance.giveRuling(disputeId, KLEROS_SHOP_WINS, { from: owner }); // dispute 0, shop wins

        await expectRevert(
          shopsInstance.appealDispute(user1, 'my evidence link', {
            from: user2, // challenger can appeal ruling that shop won
            value: ethToWei(KLEROS_ARBITRATION_PRICE - 0.1),
          }),
          'sent eth is lower than appeal cost',
        );
      });

      it('[success] - challenger wins', async () => {
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

        const disputeId = 0;

        //
        // Create dispute
        //
        await shopsInstance.createDispute(user1, 0, 'my evidence link', {
          from: user2,
          value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        });
        const disputeBeforeRuling = await shopsInstance.getDispute(disputeId);
        const disputeBeforeRulingObj = {
          id: disputeBeforeRuling[0].toNumber(),
          shop: disputeBeforeRuling[1],
          challenger: disputeBeforeRuling[2],
          disputeType: disputeBeforeRuling[3].toNumber(),
          ruling: disputeBeforeRuling[4].toNumber(),
          status: disputeBeforeRuling[5].toNumber(),
        };
        expect(disputeBeforeRulingObj.id).equals(0);
        expect(disputeBeforeRulingObj.shop.toLowerCase()).equals(user1.toLowerCase());
        expect(disputeBeforeRulingObj.challenger.toLowerCase()).equals(user2.toLowerCase());
        expect(disputeBeforeRulingObj.disputeType).equals(0);
        expect(disputeBeforeRulingObj.ruling).equals(0); // no ruling yet
        expect(disputeBeforeRulingObj.status).equals(0); // Waiting (on ruling)

        //
        // Give ruling on dispute
        //
        await appealableArbitratorInstance.giveRuling(disputeId, KLEROS_SHOP_WINS, { from: owner }); // dispute 0, shop wins
        const disputeAfterRuling = await shopsInstance.getDispute(disputeId);
        expect(disputeAfterRuling[4].toNumber()).equals(1); // shop wins
        expect(disputeAfterRuling[5].toNumber()).equals(1); // Appealable

        //
        // Appeal dispute ruling
        //
        await shopsInstance.appealDispute(user1, 'my appeal evidence link', {
          from: user2, // challenger can appeal ruling that shop won
          value: ethToWei(KLEROS_ARBITRATION_PRICE),
        });
        const disputeAfterAppeal = await shopsInstance.getDispute(disputeId);
        expect(disputeAfterAppeal[4].toNumber()).equals(1); // shop wins
        expect(disputeAfterAppeal[5].toNumber()).equals(0); // Waiting

        //
        // Give ruling on appeal
        //
        await appealableArbitratorInstance.giveRuling(disputeId, KLEROS_CHALLENGER_WINS, { from: owner }); // dispute 0, challenger wins
        const disputeAfterAppealRuling = await shopsInstance.getDispute(disputeId);
        expect(disputeAfterAppealRuling[4].toNumber()).equals(2); // challenger wins
        expect(disputeAfterAppealRuling[5].toNumber()).equals(2); // Solved

        const withdrawableDthUser2 = await shopsInstance.withdrawableDth(user2);
        expect(withdrawableDthUser2.toString()).to.equal(ethToWei(CG_SHOP_LICENSE_PRICE));

        await shopsInstance.withdrawDth({ from: user2 });
        const balanceChallengerAfter = await dthInstance.balanceOf(user2);
        expect(balanceChallengerAfter.toString()).to.equal(ethToWei(CG_SHOP_LICENSE_PRICE));

        const shopHasDisputeAfter = (await shopsInstance.getShopByAddr(user1))[6];
        expect(shopHasDisputeAfter).to.equal(false);

        const shopExistsAfter = await shopsInstance.shopByAddrExists(user1);
        expect(shopExistsAfter).to.equal(false);
      });

      it('[success] - shop wins', async () => {
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

        const disputeId = 0;

        //
        // Create dispute
        //
        await shopsInstance.createDispute(user1, 0, 'my evidence link', {
          from: user2,
          value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        });
        const disputeBeforeRuling = await shopsInstance.getDispute(disputeId);
        const disputeBeforeRulingObj = {
          id: disputeBeforeRuling[0].toNumber(),
          shop: disputeBeforeRuling[1],
          challenger: disputeBeforeRuling[2],
          disputeType: disputeBeforeRuling[3].toNumber(),
          ruling: disputeBeforeRuling[4].toNumber(),
          status: disputeBeforeRuling[5].toNumber(),
        };
        expect(disputeBeforeRulingObj.id).equals(0);
        expect(disputeBeforeRulingObj.shop).equals(user1);
        expect(disputeBeforeRulingObj.challenger).equals(user2);
        expect(disputeBeforeRulingObj.disputeType).equals(0);
        expect(disputeBeforeRulingObj.ruling).equals(0); // no ruling yet
        expect(disputeBeforeRulingObj.status).equals(0); // Waiting (on ruling)

        //
        // Give ruling on dispute
        //
        await appealableArbitratorInstance.giveRuling(disputeId, KLEROS_CHALLENGER_WINS, { from: owner }); // dispute 0, shop wins
        const disputeAfterRuling = await shopsInstance.getDispute(disputeId);
        expect(disputeAfterRuling[4].toNumber()).equals(2); // challenger wins
        expect(disputeAfterRuling[5].toNumber()).equals(1); // Appealable

        //
        // Appeal dispute ruling
        //
        await shopsInstance.appealDispute(user1, 'my appeal evidence link', {
          from: user1, // shop can appeal ruling that challenger won
          value: ethToWei(KLEROS_ARBITRATION_PRICE),
        });
        const disputeAfterAppeal = await shopsInstance.getDispute(disputeId);
        expect(disputeAfterAppeal[4].toNumber()).equals(2); // challenger wins
        expect(disputeAfterAppeal[5].toNumber()).equals(0); // Waiting

        //
        // Give ruling on appeal
        //
        // we need to get the updated dispute id, only when using the development kleros contracts
        await appealableArbitratorInstance.giveRuling(disputeId, KLEROS_SHOP_WINS, { from: owner }); // dispute 0, challenger wins
        const disputeAfterAppealRuling = await shopsInstance.getDispute(disputeId);
        expect(disputeAfterAppealRuling[4].toNumber()).equals(1); // shop wins
        expect(disputeAfterAppealRuling[5].toNumber()).equals(2); // Solved

        const withdrawableDthUser2 = await shopsInstance.withdrawableDth(user2);
        expect(withdrawableDthUser2.toString()).to.equal(ethToWei(0));

        const balanceChallengerAfter = await dthInstance.balanceOf(user2);
        expect(balanceChallengerAfter.toNumber()).to.equal(0);

        const shopHasDisputeAfter = (await shopsInstance.getShopByAddr(user1))[6];
        expect(shopHasDisputeAfter).to.equal(false);

        const shopExistsAfter = await shopsInstance.shopByAddrExists(user1);
        expect(shopExistsAfter).to.equal(true);
      });
    });
  });

  describe('Getters', () => { });
});
