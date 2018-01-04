var Dether = artifacts.require("./Dether.sol");
var DetherInterface = artifacts.require("./DetherInterface.sol");
var DetherStorage = artifacts.require("./DetherTellerStorage.sol");

module.exports = function(deployer, network) {

  console.log('DEPLOY => ', network);
  deployer.deploy(DetherStorage, {gas: 4500000})
  .then(() => deployer.deploy(DetherInterface, DetherStorage.address, {gas: 4500000}))
  // .then(() => DetherStorage.at(DetherStorage.address).transferOwnership(DetherInterface.address, {gas: 300000} ))
  // .then(() => DetherInterface.at(DetherInterface.address).setInit({gas: 300000}))

};
