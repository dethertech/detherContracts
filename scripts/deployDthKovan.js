

const Dth = artifacts.require('./token/DetherToken.sol');


module.exports = async (callback, accounts) => {

  const dthToken = await Dth.deployed();
  console.log(await dthToken.owner.call())

  await dthToken.mint('0x32BedF6609f002A591f871009C8e66D84F98d48E', web3.toWei(10000000,'ether'));
  await dthToken.finishMinting();
  console.log('address ', dthToken.address);
  console.log('balance = ', await dthToken.balanceOf.call('0x32BedF6609f002A591f871009C8e66D84F98d48E'));

  callback();
};
