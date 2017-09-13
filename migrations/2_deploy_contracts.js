var DetherStorage = artifacts.require("./DetherStorage.sol");
var DetherInterface = artifacts.require("./DetherInterface.sol");
var DetherStorageJson = require("../build/contracts/DetherStorage.json");

module.exports = function(deployer, network) {
  console.log('Migration --', network);
  if (network == 'kovan') {
    // to deploy interface with old storage
    console.log('-> kovan');
    deployer.deploy(DetherInterface, DetherStorageJson.networks[42].address, {gas: 1500000});
  } else {
    // to deploy interface with new storage
    console.log('=>Other')
      deployer.deploy(DetherStorage, {gas: 1500000})
      .then(() => deployer.deploy(DetherInterface, DetherStorage.address, {gas: 1500000}))
  }
};
