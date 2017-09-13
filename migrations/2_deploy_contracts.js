var DetherStorage = artifacts.require("./DetherStorage.sol");
var DetherInterface = artifacts.require("./DetherInterface.sol");
var DetherStorageJson = require("../build/contracts/DetherStorage.json");

module.exports = function(deployer, network) {
  console.log('Migration --', network);
  if (network == 'kovan') {
      console.log('-> kovan');
      let storagecontract;
      let interfacecontract;
      deployer.deploy(DetherStorage, {gas: 1500000})
      .then(() => deployer.deploy(DetherInterface, DetherStorage.address, {gas: 1500000}))
      .then(() => {
        return DetherStorage.at(DetherStorage.address);
      }).then((instance) => {
        storagecontract = instance;
        return DetherInterface.at(DetherInterface.address);
      }).then((instance) => {
        interfacecontract = instance;
        return storagecontract.transferOwnership(DetherInterface.address, {gas: 300000} )
      }).then(() => {
        return interfacecontract.setInit({gas: 300000} );
      })
    } else {
    console.log('=>Other')
      deployer.deploy(DetherStorage, {gas: 1500000})
      .then(() => deployer.deploy(DetherInterface, DetherStorage.address, {gas: 1500000}))
  }
};
