/* eslint-disable */
/* global artifacts */
const DetherToken = artifacts.require('DetherToken.sol');
const Control = artifacts.require('Control.sol');
const FakeExchangeRateOracle = artifacts.require('FakeExchangeRateOracle.sol');
const ExchangeRateOracle = artifacts.require('ExchangeRateOracle.sol');
const SmsCertifier = artifacts.require('SmsCertifier.sol');
const KycCertifier = artifacts.require('KycCertifier.sol');
const CertifierRegistry = artifacts.require('CertifierRegistry');
const Users = artifacts.require('Users.sol');
const GeoRegistry = artifacts.require('GeoRegistry.sol');
const ZoneFactory = artifacts.require('ZoneFactory.sol');
const Zone = artifacts.require('Zone.sol');
const Teller = artifacts.require('Teller.sol');
const Shops = artifacts.require('Shops.sol');
const ShopsDispute = artifacts.require('ShopsDispute.sol');

// const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const CONTRACT_ADDRESSES = {
  'kovan-fork': {
    mkrPriceFeed: '0xa944bd4b25c9f186a846fd5668941aa3d3b8425f',
  },
  kovan: {
    mkrPriceFeed: '0xa944bd4b25c9f186a846fd5668941aa3d3b8425f',
  },
  mainnet: {
    mkrPriceFeed: '0x729D19f657BD0614b4985Cf1D82531c67569197B',
  },
};

// NOTE: when running 'truffle test' the migrations will also run, and if we have a 60 second
// delay, right in the middle of the tests after 60 seconds, the next contract in this migration
// file will be deployed. therefore comment them out until you actually want to deploy.
module.exports = async (deployer, network) => {
  console.log('Deploy contract to => ', network);

  // await deployer.deploy(DetherToken, { gas: 6500000 });
  let dth;
  switch (network) {
    case 'develop':
    // use a fake instance to test locally using truffle develop
    // fall through
    case 'rinkeby':
    // use a fake instance to test locally using truffle develop
    // fall through
    case 'development':
    // use a fake instance to test locally using ganache
    // fall through
    case 'ropsten':
      await deployer.deploy(DetherToken, { gas: 6500000 });
      dth = await DetherToken.deployed();
      break;

    case 'kovan-fork':
    // fall through

    case 'kovan':
      dth = await DetherToken.at('0x9027e9fc4641e2991a36eaeb0347bc5b35322741'); // DTH kovan address
      break;

    case 'mainnet':
      dth = await DetherToken.at('0x5adc961D6AC3f7062D2eA45FEFB8D8167d44b190'); // DTH mainnet address
      break;

    default:
      throw new Error(`did not specify how to deploy ExchangeRateOracle on this network (${network})`);
  }

  // await deployer.deploy(FakeExchangeRateOracle, { gas: 6500000 });
  // const price = await FakeExchangeRateOracle.deployed();

  let price;
  switch (network) {
    case 'develop':
    // use a fake instance to test locally using truffle develop
    // fall through
    case 'rinkeby':
    // use a fake instance to test locally using truffle develop
    // fall through
    case 'development':
    // use a fake instance to test locally using ganache
    // fall through
    case 'ropsten':
      // Maker doesn't test on ropsten so we use a fake instance
      await deployer.deploy(FakeExchangeRateOracle, { gas: 6000000 });
      price = await FakeExchangeRateOracle.deployed();
      break;

    case 'kovan':
      await deployer.deploy(
        ExchangeRateOracle,
        // pass int he address of the Maker price feed contract on the blockchain
        CONTRACT_ADDRESSES[network].mkrPriceFeed,
        { gas: 6500000 },
      );
      price = await ExchangeRateOracle.deployed();
      break;
    // fall through
    case 'kovan-fork':
      console.log('kovan-fork network')
      await deployer.deploy(
        ExchangeRateOracle,
        // pass int he address of the Maker price feed contract on the blockchain
        CONTRACT_ADDRESSES['kovan'].mkrPriceFeed,
        { gas: 6500000 },
      );
      price = await ExchangeRateOracle.deployed();
      break;
    // fall through
    case 'mainnet':
      await deployer.deploy(
        ExchangeRateOracle,
        // pass int he address of the Maker price feed contract on the blockchain
        CONTRACT_ADDRESSES[network].mkrPriceFeed,
        { gas: 6500000 },
      );
      price = await ExchangeRateOracle.deployed();

      break;

    default:
      throw new Error(`did not specify how to deploy ExchangeRateOracle on this network (${network})`);
  }


  await deployer.deploy(Control, { gas: 6500000 });
  const control = await Control.deployed();

  await deployer.deploy(SmsCertifier, control.address, { gas: 6500000 });
  const sms = await SmsCertifier.deployed();

  await deployer.deploy(KycCertifier, control.address, { gas: 6500000 });
  const kyc = await KycCertifier.deployed();

  await deployer.deploy(CertifierRegistry, { gas: 6500000 });
  const certifierRegistry = await CertifierRegistry.deployed();

  await deployer.deploy(GeoRegistry, control.address, { gas: 6500000 });
  const geo = await GeoRegistry.deployed();

  await deployer.deploy(Zone, { gas: 6500000 });
  const zoneImplementation = await Zone.deployed();

  await deployer.deploy(Teller, { gas: 6500000 });
  const tellerImplementation = await Teller.deployed();

  await deployer.deploy(Users, price.address, geo.address, sms.address, kyc.address, control.address, certifierRegistry.address, { gas: 6500000 });
  const users = await Users.deployed();

  await deployer.deploy(ZoneFactory, dth.address, geo.address, users.address, control.address, zoneImplementation.address, tellerImplementation.address, { gas: 6500000 });
  const zoneFactory = await ZoneFactory.deployed();

  await deployer.deploy(Shops, dth.address, geo.address, users.address, control.address, zoneFactory.address, { gas: 6500000 });
  const shops = await Shops.deployed();

  await deployer.deploy(ShopsDispute, shops.address, users.address, control.address, '0xffffffffffffffffffffffffffffffffffffffff', '0x0', { gas: 6500000 });
  const shopsDispute = await ShopsDispute.deployed();
  await shops.setShopsDisputeContract(shopsDispute.address);
  // });
  // // gas 1,161,360
  // // await deployer.deploy(DetherToken, { gas: 6000000, gasPrice: 26500000000 });
  //
  // // gas: 4,873,314
  // await deployer.deploy(DetherCore, { gas: 6500000 });
  // // await delay(60000);
  //
  // // gas 1,477,280
  // await deployer.deploy(DetherBank, { gas: 6500000 });
  // // await delay(60000);
  //
  // // gas 552,780
  // await deployer.deploy(SmsCertifier, { gas: 6500000 });
  // // await delay(60000);
  //
  // // gas 552,780
  // await deployer.deploy(KycCertifier, { gas: 6500000 });
  // // await delay(60000);
  //

};
