// var DetherInterface = artifacts.require("./DetherInterface.sol");
// var DetherStorage = artifacts.require("./DetherTellerStorage.sol");
// var SmsCertifier = artifacts.require("./certifier/SmsCertifier.sol");
// var DetherToken = artifacts.require("./dth/DetherToken.sol");
// var DthRegistry = artifacts.require("./DthRegistry.sol");
// var DthShop = artifacts.require("./DetherShopStorage.sol");

var DetherCore = artifacts.require("./DetherCore.sol");
var DetherToken = artifacts.require("./dth/DetherToken.sol");
var SmsCertifier = artifacts.require("./certifier/SmsCertifier.sol");
var DetherBank = artifacts.require("./DetherBank.sol");

module.exports = function(deployer, network) {

  deployer.deploy(DetherCore, {gas: 4700000, gasPrice:25000000000})
  .then(() => deployer.deploy(DetherToken, {gas: 4700000, gasPrice:25000000000}))
  .then(() => deployer.deploy(DetherBank, {gas: 4700000, gasPrice:25000000000}))
  .then(() => deployer.deploy(SmsCertifier, {gas: 4700000, gasPrice:25000000000}))

};
