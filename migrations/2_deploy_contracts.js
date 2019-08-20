/* eslint-disable */
/* global artifacts */
const DetherToken = artifacts.require("DetherToken.sol");
const CertifierRegistry = artifacts.require("CertifierRegistry");
const Users = artifacts.require("Users.sol");
const GeoRegistry = artifacts.require("GeoRegistry.sol");
const ZoneFactory = artifacts.require("ZoneFactory.sol");
const Zone = artifacts.require("Zone.sol");
const Teller = artifacts.require("Teller.sol");
const Shops = artifacts.require("Shops.sol");
const ShopsDispute = artifacts.require("ShopsDispute.sol");
const TaxCollector = artifacts.require("TaxCollector.sol");

const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";
// const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const CONTRACT_ADDRESSES = {
  "kovan-fork": {
    mkrPriceFeed: "0xa944bd4b25c9f186a846fd5668941aa3d3b8425f"
  },
  kovan: {
    mkrPriceFeed: "0xa944bd4b25c9f186a846fd5668941aa3d3b8425f"
  },
  mainnet: {
    mkrPriceFeed: "0x729D19f657BD0614b4985Cf1D82531c67569197B"
  }
};

// NOTE: when running 'truffle test' the migrations will also run, and if we have a 60 second
// delay, right in the middle of the tests after 60 seconds, the next contract in this migration
// file will be deployed. therefore comment them out until you actually want to deploy.
module.exports = async (deployer, network) => {
  console.log("Deploy contract to => ", network);

  // await deployer.deploy(DetherToken, { gas: 6500000 });
  let dth;
  switch (network) {
    case "develop":
    // use a fake instance to test locally using truffle develop
    // fall through
    case "rinkeby":
    // use a fake instance to test locally using truffle develop
    // fall through
    case "development":
    // use a fake instance to test locally using ganache
    // fall through
    case "ropsten":
      await deployer.deploy(DetherToken, { gas: 6500000 });
      dth = await DetherToken.deployed();
      break;

    case "kovan-fork":
    // fall through

    case "kovan":
      dth = await DetherToken.at("0x9027e9fc4641e2991a36eaeb0347bc5b35322741"); // DTH kovan address
      break;

    case "mainnet":
      dth = await DetherToken.at("0x5adc961D6AC3f7062D2eA45FEFB8D8167d44b190"); // DTH mainnet address
      break;

    default:
      throw new Error(
        `did not specify how to deploy ExchangeRateOracle on this network (${network})`
      );
  }

  await deployer.deploy(TaxCollector, dth.address, ADDRESS_ZERO, {
    gas: 6500000
  });
  const taxCollector = await TaxCollector.deployed();

  await deployer.deploy(CertifierRegistry, { gas: 6500000 });
  const certifierRegistry = await CertifierRegistry.deployed();

  await deployer.deploy(GeoRegistry, { gas: 6500000 });
  const geo = await GeoRegistry.deployed();

  await deployer.deploy(Zone, { gas: 6700000 });
  const zoneImplementation = await Zone.deployed();

  await deployer.deploy(Teller, { gas: 6500000 });
  const tellerImplementation = await Teller.deployed();

  await deployer.deploy(Users, geo.address, certifierRegistry.address, {
    gas: 6500000
  });
  const users = await Users.deployed();

  await deployer.deploy(
    ZoneFactory,
    dth.address,
    geo.address,
    users.address,
    zoneImplementation.address,
    tellerImplementation.address,
    taxCollector.address,
    { gas: 6500000 }
  );
  const zoneFactory = await ZoneFactory.deployed();

  switch (network) {
    case "kovan":

    case "mainnet":
      await users.setZoneFactory(ZoneFactory.address, { gas: 6500000 });
      console.log("Set zone factory");
  }

  await deployer.deploy(
    Shops,
    dth.address,
    geo.address,
    users.address,
    zoneFactory.address,
    { gas: 6500000 }
  );
};
