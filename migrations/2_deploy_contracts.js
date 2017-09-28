var DetherStorage = artifacts.require("./DetherStorage.sol");
var DetherInterface = artifacts.require("./DetherInterface.sol");
var DetherStorageJson = require("../build/contracts/DetherStorage.json");

module.exports = function(deployer, network) {
  console.log('Migration --', network);
  if (network == 'kovan') {
      console.log('=> kovan');
      deployer.deploy(DetherStorage, {gas: 2000000})
      .then(() => deployer.deploy(DetherInterface, DetherStorage.address, {gas: 2000000}))
      .then(() => DetherStorage.at(DetherStorage.address).transferOwnership(DetherInterface.address, {gas: 300000} ))
      .then(() => DetherInterface.at(DetherInterface.address).setInit({gas: 300000}))
    } else {
    console.log('=>Other')
      deployer.deploy(DetherStorage, {gas: 1500000})
      .then(() => deployer.deploy(DetherInterface, DetherStorage.address, {gas: 1500000}))
  }
};
