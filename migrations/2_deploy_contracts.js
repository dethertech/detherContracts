var DetherStorage = artifacts.require("./DetherStorage.sol");
var DetherInterface = artifacts.require("./DetherInterface.sol");

module.exports = function(deployer) {
  deployer
    .deploy(DetherStorage)
    .then(() => deployer.deploy(DetherInterface, DetherStorage.address))
};
