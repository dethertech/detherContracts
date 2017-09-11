var DetherStorage = artifacts.require("./DetherStorage.sol");
var DetherInterface = artifacts.require("./DetherInterface.sol");

module.exports = function(deployer) {
  console.log('Migration --')
  deployer
    .deploy(DetherStorage, {gas: 1500000})
    .then(() => deployer.deploy(DetherInterface, DetherStorage.address, {gas: 1500000}))
};
