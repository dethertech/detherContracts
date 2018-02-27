
const SmsCertifier = artifacts.require('./certifier/SmsCertifier.sol');


module.exports = async (callback) => {

  const sms = await SmsCertifier.deployed();

  tsx = await sms.transferOwnership('0x32BedF6609f002A591f871009C8e66D84F98d48E');
  console.log(tsx);

  callback();
};
