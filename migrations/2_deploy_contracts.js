/* global artifacts */
const DetherCore = artifacts.require('./DetherCore.sol');
const DetherToken = artifacts.require('./dth/DetherToken.sol');
const SmsCertifier = artifacts.require('./certifier/SmsCertifier.sol');
const KycCertifier = artifacts.require('./certifier/KycCertifier.sol');
const DetherBank = artifacts.require('./DetherBank.sol');
const ExchangeRateOracle = artifacts.require('./ExchangeRateOracle.sol');

module.exports = async (deployer) => {
  // Migrations: gas 41915

  // gas: 4,643,520
  await deployer.deploy(DetherCore, { gas: 5000000, gasPrice: 25000000000 });

  // gas 1,161,360
  await deployer.deploy(DetherToken, { gas: 5000000, gasPrice: 25000000000 });

  // gas 1,477,280
  await deployer.deploy(DetherBank, { gas: 5000000, gasPrice: 25000000000 });

  // gas 552,780
  await deployer.deploy(SmsCertifier, { gas: 5000000, gasPrice: 25000000000 });

  // gas 552,780
  await deployer.deploy(KycCertifier, { gas: 5000000, gasPrice: 25000000000 });

  // gas 1,422,974
  await deployer.deploy(ExchangeRateOracle, 0, {
    // add 1 eth to contract, needed to pay for oraclize queries
    value: '1000000000000000000',
    gas: 5000000,
    gasPrice: 25000000000,
  });
};
