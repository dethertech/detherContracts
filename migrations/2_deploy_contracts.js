var DetherStorage = artifacts.require("./DetherStorage.sol");
var DetherInterface = artifacts.require("./DetherInterface.sol");
var DetherStorageJson = require("../build/contracts/DetherStorage.json");

module.exports = function(deployer, network) {
  console.log('Migration --')
  if (network == 42) {
    // to deploy interface with old storage
    deployer.deploy(DetherInterface, DetherStorageJson.networks[42].address, {gas: 1500000});
  } else {
    // todeploy interface with new storage
      deployer.deploy(DetherStorage, {gas: 1500000})
      .then(() => deployer.deploy(DetherInterface, DetherStorage.address, {gas: 1500000}))
  }
};
