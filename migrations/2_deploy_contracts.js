// var DetherInterface = artifacts.require("./DetherInterface.sol");
// var DetherStorage = artifacts.require("./DetherTellerStorage.sol");
// var SmsCertifier = artifacts.require("./certifier/SmsCertifier.sol");
// var DetherToken = artifacts.require("./dth/DetherToken.sol");
// var DthRegistry = artifacts.require("./DthRegistry.sol");
// var DthShop = artifacts.require("./DetherShopStorage.sol");

var DetherCore = artifacts.require("./DetherCore.sol");
var DetherToken = artifacts.require("./dth/DetherToken.sol");
var SmsCertifier = artifacts.require("./certifier/SmsCertifier.sol");

module.exports = function(deployer, network) {

  deployer.deploy(DetherCore, {gas: 6500000})
  .then(() => deployer.deploy(DetherToken, {gas: 5500000}))
  .then(() => deployer.deploy(SmsCertifier, {gas: 4500000}))

};
