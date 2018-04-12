/* global artifacts */
const DetherCore = artifacts.require('./DetherCore.sol');
const DetherToken = artifacts.require('./dth/DetherToken.sol');
const SmsCertifier = artifacts.require('./certifier/SmsCertifier.sol');
const DetherBank = artifacts.require('./DetherBank.sol');
const ExchangeRateOracle = artifacts.require('./ExchangeRateOracle.sol');

module.exports = async (deployer, network) => {
  await deployer.deploy(DetherCore, { gas: 4700000, gasPrice: 25000000000 });
  await deployer.deploy(DetherToken, { gas: 4700000, gasPrice: 25000000000 });
  await deployer.deploy(DetherBank, { gas: 4700000, gasPrice: 25000000000 });
  await deployer.deploy(SmsCertifier, { gas: 4700000, gasPrice: 25000000000 });
  await deployer.deploy(ExchangeRateOracle, 0, { gas: 4700000, gasPrice: 25000000000 });
};
