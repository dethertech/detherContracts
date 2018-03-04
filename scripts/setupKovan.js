
const Dether = artifacts.require('./DetherCore.sol');
const SmsCertifier = artifacts.require('./certifier/SmsCertifier.sol');
const Dth = artifacts.require('./dth/DetherToken.sol');

const ceoDether = "0xC5F8a06ed1CfB17d0366eF03FEDF37568B0ce246";
const ownerCertifier = "0xB06c40B9c72231502949B33bC8b2543701C863Ef";
const cmoDether = "0x32BedF6609f002A591f871009C8e66D84F98d48E";

// dether Core need:
// dether.setCertifier()
// dether.setDth()

// smsCertifier.transferOwnership

// dth.mint()
// dth.finishMinting()

module.exports = async (callback) => {

  const dether = await Dether.deployed();
  const sms = await SmsCertifier.deployed();
  const dth = await Dth.deployed();
  // await sms.transferOwnership(ownerCertifier);
  // console.log('owner sms should be => ', ownerCertifier, await sms.owner.call());
  //
  // await dether.setCertifier(sms.address);
  // console.log('certifier should be => ',sms.address, await dether.smsCertifier.call())
  //
  // await dether.setDth(dth.address);
  // console.log('dth should be => ',dth.address, await dether.dth.call())
  // await dether.setCMO(cmoDether);
  // console.log('cmo should be => ',cmoDether, await dether.cmoAddress.call())
  // await dether.setCEO(ceoDether);
  // console.log('ceo should be => ',ceoDether, await dether.ceoAddress.call())

  await dth.mint(ceoDether, web3.toWei(10000000,'ether'));
  await dth.finishMinting();
  console.log('balance should be 10000000 => ', dth.balanceOf.call(ceoDether));

  callback();
};
