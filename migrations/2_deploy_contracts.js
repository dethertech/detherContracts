var DetherInterface = artifacts.require("./DetherInterface.sol");
var DetherStorage = artifacts.require("./DetherTellerStorage.sol");
var SmsCertifier = artifacts.require("./certifier/SmsCertifier.sol");

module.exports = function(deployer, network) {

  deployer.deploy(DetherStorage, {gas: 4500000})
  .then(() => deployer.deploy(DetherInterface, DetherStorage.address, {gas: 4500000}))
  .then(() => deployer.deploy(SmsCertifier, {gas: 4500000}));

};
