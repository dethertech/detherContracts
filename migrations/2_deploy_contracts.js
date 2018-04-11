// var DetherInterface = artifacts.require("./DetherInterface.sol");
// var DetherStorage = artifacts.require("./DetherTellerStorage.sol");
// var SmsCertifier = artifacts.require("./certifier/SmsCertifier.sol");
// var DetherToken = artifacts.require("./dth/DetherToken.sol");
// var DthRegistry = artifacts.require("./DthRegistry.sol");
// var DthShop = artifacts.require("./DetherShopStorage.sol");

const DetherCore = artifacts.require("./DetherCore.sol");
const DetherToken = artifacts.require("./dth/DetherToken.sol");
const SmsCertifier = artifacts.require("./certifier/SmsCertifier.sol");
const DetherBank = artifacts.require("./DetherBank.sol");

module.exports = async (deployer, network) => {
  await deployer.deploy(DetherCore, {gas: 4700000, gasPrice:25000000000});
  await deployer.deploy(DetherToken, {gas: 4700000, gasPrice:25000000000});
  await deployer.deploy(DetherBank, {gas: 4700000, gasPrice:25000000000});
  await deployer.deploy(SmsCertifier, {gas: 4700000, gasPrice:25000000000});
};
