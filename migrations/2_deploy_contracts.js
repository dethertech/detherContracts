var DetherStorage = artifacts.require("./DetherStorage.sol");
var DetherInterface = artifacts.require("./DetherInterface.sol");
var DetherStorageJson = require("../build/contracts/DetherStorage.json");

module.exports = function(deployer) {
  console.log('Migration --')
  // to deploy interface with old storage
  deployer.deploy(DetherInterface, DetherStorageJson.networks[42].address);
  // to deploy interface with new storage
  //   .deploy(DetherStorage, {gas: 1500000})
  //   .then(() => deployer.deploy(DetherInterface, DetherStorage.address, {gas: 1500000}))
};
