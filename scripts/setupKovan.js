
const DetherInterface = artifacts.require('./DetherInterface');
const DetherStorage = artifacts.require('./DetherTellerStorage.sol');
const SmsCertifier = artifacts.require('./certifier/SmsCertifier.sol');
const DthRegistry = artifacts.require('./DthRegistry.sol');
const Dth = artifacts.require('./DetherInterface.sol');

module.exports = async (callback) => {

  const dether = await DetherInterface.deployed();
  const sms = await SmsCertifier.deployed();
  const dthRegistry = await DthRegistry.deployed();
  const tellerStorage = await DetherStorage.deployed();
  const dth = await Dth.deployed();
  let tsx = await dether.addDth(dth.address);
  console.log(tsx);
  tsx = await dthRegistry.transferOwnership(dether.address);
  console.log(tsx);
  tsx = await tellerStorage.transferOwnership(dether.address);
  console.log(tsx);


  callback();
};
