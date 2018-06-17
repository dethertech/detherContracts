
const DetherCore = artifacts.require('./DetherCore.sol');
const DetherBank = artifacts.require('./DetherBank.sol');
const DetherToken = artifacts.require('./dth/DetherToken.sol');
const SmsCertifier = artifacts.require('./certifier/SmsCertifier.sol');
const KycCertifier = artifacts.require('./certifier/KycCertifier.sol');
const ExchangeRateOracle = artifacts.require('./ExchangeRateOracle.sol');

const ceoDether = "0x2C0Da9671c8021E48DA17aC3fAbc680d6839f3cf";
const ownerCertifier = "0x2C0Da9671c8021E48DA17aC3fAbc680d6839f3cf";
const cmoDether = "0x2C0Da9671c8021E48DA17aC3fAbc680d6839f3cf";
const cfoDether = "0x2C0Da9671c8021E48DA17aC3fAbc680d6839f3cf";
const csoDether = "0x2C0Da9671c8021E48DA17aC3fAbc680d6839f3cf";

const kycDelegate = '0xE7dFb797D9A18D62029a0EA2db40d12073928152';
const initScript = '0x2C0Da9671c8021E48DA17aC3fAbc680d6839f3cf';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const ownerdeploy = "0xE384850C8B9f1009d81C7657db179172b6C648D8"
module.exports = async (callback) => {

  //
  // Deploy all contracts
  //
  const detherCore = await DetherCore.deployed();
  console.log('address DetherCore => ', detherCore.address);
  const detherBank = await DetherBank.deployed();
  console.log('address DetherBank => ', detherBank.address);
  const detherToken = await DetherToken.deployed();
  console.log('address DetherToken => ', detherToken.address);
  const smsCertifier = await SmsCertifier.deployed();
  console.log('address SmsCertifer => ', smsCertifier.address);
  // const kycCertifier = await KycCertifier.deployed();
  // console.log('address KycCertifer => ', kycCertifier.address);
  const exchangeRateOracle = await ExchangeRateOracle.deployed();
  console.log('Address ExchangeRateOracle => ', exchangeRateOracle.address);

  //
  // [DetherCore] init
  //
  await detherCore.initContract(detherToken.address, detherBank.address);
  console.log('bank should be => ', detherBank.address, await detherCore.bank.call());
  console.log('dth should be => ', detherToken.address, await detherCore.dth.call());
  await delay(30000);
  //
  // [DetherCore] set initial user roles (will be updated at the very last step down below)
  //
  await detherCore.setCEO(ownerdeploy);
  console.log('ceo should be => ', ownerdeploy, await detherCore.ceoAddress.call());
  await delay(30000);
  await detherCore.setCFO(ownerdeploy);
  console.log('cfo should be => ', ownerdeploy, await detherCore.cfoAddress.call());
  console.log('delay');
  await delay(30000);
  await detherCore.setCSO(ownerdeploy);
  console.log('cso should be => ', ownerdeploy, await detherCore.csoAddress.call());
  console.log('delay');
  await delay(30000);
  await detherCore.setCMO(ownerdeploy);
  console.log('cmo should be => ', ownerdeploy, await detherCore.cmoAddress.call());
  console.log('delay');
  await delay(30000);
  //
  // //
  // // [DetherCore] set references (addresses) to other contracts
  // //
  await detherCore.setPriceOracle(exchangeRateOracle.address);
  console.log('priceOralce should be => ', exchangeRateOracle.address, await detherCore.priceOracle.call());
  console.log('delay');
  await delay(30000);
  await detherCore.setSmsCertifier(smsCertifier.address);
  console.log('sms certifier should be => ', smsCertifier.address, await detherCore.smsCertifier.call());
  console.log('delay');
  await delay(30000);
  // await detherCore.setKycCertifier(kycCertifier.address);
  // console.log('kyc certifier should be => ', kycCertifier.address, await detherCore.kycCertifier.call());
  // console.log('delay');
  // await delay(30000);

  //
  // [DetherCore] set moderator of shop/teller
  //
  await detherCore.setTellerModerator(kycDelegate);  //
  console.log('teller moderator should be => ', ceoDether, await detherCore.tellerModerators.call(ceoDether));
  console.log('delay');
  await delay(30000);

  //
  // [DetherBank] set DetherToken address + set owner to the be the DetherCore contract
  //
  await detherBank.setDth(detherToken.address);
  // console.log('dth inside detherBank should be => ', detherToken.address, await detherBank.detherToken.call());
  console.log('delay');
    await delay(30000);
  await detherBank.transferOwnership(detherCore.address);
  console.log('owner bank should be => ', detherCore.address, await detherBank.owner.call());
  console.log('delay');
  await delay(30000);

  // [SmsCertifier + KycCertifier] set person who can 'certify' users


  await smsCertifier.addDelegate(kycDelegate, 'smsDelegate');
  console.log('kycDelegate should be a sms delegate => ', await smsCertifier.isDelegate.call(kycDelegate));
  console.log('delay');
  await delay(30000);
  // //
  // // [DetherCore] set license prices
  // //
  await detherCore.setLicenceTellerPrice(web3.toHex('FR'), web3.toWei('50'));
  console.log('licenceteller should be => ', '10', web3.fromWei(await detherCore.licenceTeller.call(web3.toHex('FR'))));
  console.log('delay');
  await delay(30000);
  await detherCore.setLicenceShopPrice(web3.toHex('FR'), web3.toWei('50'));
  console.log('licenceshop should be => ', '10', web3.fromWei(await detherCore.licenceShop.call(web3.toHex('FR'))));
  console.log('delay');
  await delay(30000);
  await detherCore.setLicenceTellerPrice(web3.toHex('GI'), web3.toWei('50'));
  console.log('licenceteller should be => ', '10', web3.fromWei(await detherCore.licenceTeller.call(web3.toHex('FR'))));
  console.log('delay');
  await delay(30000);
  await detherCore.setLicenceShopPrice(web3.toHex('GI'), web3.toWei('50'));
  console.log('licenceshop should be => ', '10', web3.fromWei(await detherCore.licenceShop.call(web3.toHex('FR'))));
  console.log('delay');
  await delay(30000);
  // //
  // // [DetherCore] set tier1 + tier2 daily sell limit (in usd)
  // //
  await detherCore.setSellDailyLimit(1, web3.toHex('FR'), 1000);
  console.log('getSellDailyLimit tier1 FR should be => ', '1000', (await detherCore.getSellDailyLimit(1, web3.toHex('FR'))));
  console.log('delay');
  await delay(30000);
  await detherCore.setSellDailyLimit(2, web3.toHex('FR'), 5000);
  console.log('getSellDailyLimit tier2 FR should be => ', '5000', (await detherCore.getSellDailyLimit(2, web3.toHex('FR'))));
  console.log('delay');
  await delay(30000);
  await detherCore.setSellDailyLimit(1, web3.toHex('GI'), 1000);
  console.log('getSellDailyLimit tier1 GI should be => ', '1000', (await detherCore.getSellDailyLimit(1, web3.toHex('GI'))));
  console.log('delay');
  await delay(30000);
  await detherCore.setSellDailyLimit(2, web3.toHex('GI'), 5000);
  console.log('getSellDailyLimit tier2 GI should be => ', '5000', (await detherCore.getSellDailyLimit(2, web3.toHex('GI'))));
  console.log('delay');
  await delay(30000);
  // //
  // // [DetherCore] open specific zones(=countries) for shops/tellers
  // //
  await detherCore.openZoneShop(web3.toHex('FR'));
  console.log('zone FR for shop should be open', await detherCore.openedCountryShop.call(web3.toHex('FR')));
  console.log('delay');
  await delay(30000);
  await detherCore.openZoneShop(web3.toHex('GI'));
  console.log('zone AU for shop should be open', await detherCore.openedCountryShop.call(web3.toHex('AU')));
  console.log('delay');
  await delay(30000);
  await detherCore.openZoneTeller(web3.toHex('GI'));
  console.log('zone FR for teller should be open', await detherCore.openedCountryTeller.call(web3.toHex('FR')));
  console.log('delay');
  await delay(30000);
  await detherCore.openZoneTeller(web3.toHex('FR'));
  console.log('zone FR for teller should be open', await detherCore.openedCountryTeller.call(web3.toHex('FR')));
  console.log('delay');
  await delay(30000);
  //
  // [DetherCore] set roles to correct addresses
  //

  await detherCore.setCFO(ceoDether);
  console.log('cfo should be => ', cfoDether, await detherCore.cfoAddress.call());
  console.log('delay');
  await delay(30000);
  await detherCore.setCSO(ceoDether);
  console.log('cso should be => ', csoDether, await detherCore.csoAddress.call());
  console.log('delay');
  await delay(30000);
  await detherCore.setCMO(ceoDether);
  console.log('cmo should be => ', cmoDether, await detherCore.cmoAddress.call());
  console.log('delay');
  await delay(30000);
  await detherCore.setCEO(ceoDether);
  console.log('ceo should be => ', ceoDether, await detherCore.ceoAddress.call());
  console.log('delay');
  await delay(30000);

  // [DetherToken] mint some tokens
  //
  // await detherToken.mint(ceoDether, web3.toWei(10000000, 'ether'));
  // await detherToken.finishMinting();
  // console.log('balance should be 10000000 => ', await detherToken.balanceOf.call(ceoDether));

  callback();
};
