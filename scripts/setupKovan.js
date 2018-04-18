
const Dether = artifacts.require('./DetherCore.sol');
const SmsCertifier = artifacts.require('./certifier/SmsCertifier.sol');
const Dth = artifacts.require('./dth/DetherToken.sol');
const Bank = artifacts.require('./DetherBank.sol');

const ceoDether = "0xC5F8a06ed1CfB17d0366eF03FEDF37568B0ce246";
const ownerCertifier = "0xC5F8a06ed1CfB17d0366eF03FEDF37568B0ce246";
const cmoDether = "0xC5F8a06ed1CfB17d0366eF03FEDF37568B0ce246";

const ownerdeploy = "0x6AAb2B0913B70270E840B14c2b23B716C0a43522"
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
  const bank = await Bank.deployed();

  // await sms.addDelegate(ownerdeploy,'0x4652');
  // await sms.addDelegate('0x32BedF6609f002A591f871009C8e66D84F98d48E','0x4652'); // cert KYC
  // await sms.addDelegate('0x391edA1b8D31f891d1653B131779751BdeDA24D3','0x4652'); // cert detherJs
  // await sms.transferOwnership(ownerCertifier);
  // console.log('owner sms should be => ', ownerCertifier, await sms.owner.call());

    console.log('Address detherCore => ', dether.address);
    console.log('Address detherbank => ', bank.address);
    console.log('Address smscertifer => ', sms.address);
        console.log('Address dth => ', dth.address);
  await dether.setCSO(ownerdeploy);
  await dether.setCMO(ownerdeploy);
  console.log('cmo should be => ', ownerdeploy, await dether.cmoAddress.call());
  await dether.openZoneShop(web3.toHex('FR'));
  await dether.openZoneShop(web3.toHex('AU'));
  await dether.openZoneTeller(web3.toHex('FR'));
  console.log('zone shop should be open', await dether.openedCountryShop.call(web3.toHex('FR')));
  console.log('zone teller should be open', await dether.openedCountryTeller.call(web3.toHex('FR')));

  await bank.setDth(dth.address);
  console.log('owner sms should be => ', dth.address, await bank.dth.call());

  await bank.transferOwnership(dether.address);
  console.log('owner bank should be => ', dether.address, await bank.owner.call());

  await dether.setSmsCertifier(sms.address);
  console.log('certifier should be => ',sms.address, await dether.smsCertifier.call());

  await dether.setLicenceTellerPrice(web3.toHex('FR'), web3.toWei('1'));
  console.log('licenceteller should be => ', '10', web3.fromWei(await dether.licenceTeller.call(web3.toHex('FR'))));

  await dether.setLicenceShopPrice(web3.toHex('FR'), web3.toWei('1'));
  console.log('licenceshop should be => ', '10', web3.fromWei(await dether.licenceShop.call(web3.toHex('FR'))));

  await dether.initContract(dth.address, bank.address);
  console.log('bank should be ', bank.address, await dether.bank.call());
  console.log('dth should be ', dth.address, await dether.dth.call());

  await dether.setShopModerator(ceoDether);
  console.log('should be moderator', ceoDether, await dether.shopModerators.call(ceoDether));

  await dether.setTellerModerator(ceoDether);
  console.log('should be moderator', ceoDether, await dether.tellerModerators.call(ceoDether));

  await dether.setCMO(cmoDether);
  console.log('cmo should be => ',cmoDether, await dether.cmoAddress.call());

  await dether.setCEO(ceoDether);
  console.log('ceo should be => ',ceoDether, await dether.ceoAddress.call());

  await dth.mint(ceoDether, web3.toWei(10000000,'ether'));
  await dth.finishMinting();
  console.log('balance should be 10000000 => ', await dth.balanceOf.call(ceoDether));



  callback();
};
