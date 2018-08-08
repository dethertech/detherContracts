
const DetherCore = artifacts.require('./DetherCore.sol');
const DetherBank = artifacts.require('./DetherBank.sol');
const DetherToken = artifacts.require('./dth/DetherToken.sol');
const SmsCertifier = artifacts.require('./certifier/SmsCertifier.sol');
const KycCertifier = artifacts.require('./certifier/KycCertifier.sol');
const ExchangeRateOracle = artifacts.require('./ExchangeRateOracle.sol');

const ceoDether = "0x2C0Da9671c8021E48DA17aC3fAbc680d6839f3cf";
const cmoDether = "0x83290383aD087ca79FE13C251949B2964F5BA5da";
const cfoDether = "0x83290383aD087ca79FE13C251949B2964F5BA5da";
const csoDether = "0x83290383aD087ca79FE13C251949B2964F5BA5da";

const kycDelegate = '0xE7dFb797D9A18D62029a0EA2db40d12073928152';
const initScript = '0xE384850C8B9f1009d81C7657db179172b6C648D8';

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
  const kycCertifier = await KycCertifier.deployed();
  console.log('address KycCertifer => ', kycCertifier.address);
  const exchangeRateOracle = await ExchangeRateOracle.deployed();
  console.log('Address ExchangeRateOracle => ', exchangeRateOracle.address);

  //
  // [DetherCore] init
  //
  await detherCore.initContract(detherToken.address, detherBank.address);
  console.log('bank should be => ', detherBank.address, await detherCore.bank.call());
  console.log('dth should be => ', detherToken.address, await detherCore.dth.call());
  await delay(42000);
  //
  // [DetherCore] set initial user roles (will be updated at the very last step down below)
  //
  // await detherCore.setCEO(ownerdeploy);
  // console.log('ceo should be => ', ownerdeploy, await detherCore.ceoAddress.call());
  // await delay(42000);
  await detherCore.setCFO(ownerdeploy);
  console.log('cfo should be => ', ownerdeploy, await detherCore.cfoAddress.call());
  console.log('delay');
  await delay(42000);
  await detherCore.setCSO(ownerdeploy);
  console.log('cso should be => ', ownerdeploy, await detherCore.csoAddress.call());
  console.log('delay');
  await delay(42000);
  await detherCore.setCMO(ownerdeploy);
  console.log('cmo should be => ', ownerdeploy, await detherCore.cmoAddress.call());
  console.log('delay');
  await delay(42000);
  //
  // //
  // // [DetherCore] set references (addresses) to other contracts
  // //
  await detherCore.setPriceOracle(exchangeRateOracle.address);
  console.log('priceOralce should be => ', exchangeRateOracle.address, await detherCore.priceOracle.call());
  console.log('delay');
  await delay(42000);
  await detherCore.setSmsCertifier(smsCertifier.address);
  console.log('sms certifier should be => ', smsCertifier.address, await detherCore.smsCertifier.call());
  console.log('delay');
  await delay(42000);
  await detherCore.setKycCertifier(kycCertifier.address);
  console.log('kyc certifier should be => ', kycCertifier.address, await detherCore.kycCertifier.call());
  console.log('delay');
  await delay(42000);

  //
  // [DetherCore] set moderator of shop/teller
  //
  await detherCore.setTellerModerator(kycDelegate);  //
  console.log('teller moderator should be => ', ceoDether, await detherCore.tellerModerators.call(ceoDether));
  console.log('delay');
  await delay(42000);

  //
  // [DetherBank] set DetherToken address + set owner to the be the DetherCore contract
  //
  await detherBank.setDth(detherToken.address);
  // console.log('dth inside detherBank should be => ', detherToken.address, await detherBank.detherToken.call());
  console.log('delay');
    await delay(42000);
  await detherBank.transferOwnership(detherCore.address);
  console.log('owner bank should be => ', detherCore.address, await detherBank.owner.call());
  console.log('delay');
  await delay(42000);

  // [SmsCertifier + KycCertifier] set person who can 'certify' users


  await smsCertifier.addDelegate(kycDelegate, 'smsDelegate');
  console.log('kycDelegate should be a sms delegate => ', await smsCertifier.isDelegate.call(kycDelegate));
  console.log('delay');
  await delay(42000);
  await smsCertifier.transferOwnership(ceoDether);
  console.log('owner sms should be => ', ceoDether,  await smsCertifier.owner.call());
  console.log('delay');
  await delay(42000);

  await kycCertifier.transferOwnership(ceoDether);
  console.log('owner sms should be => ', ceoDether,  await kycCertifier.owner.call());
  console.log('delay');
  await delay(42000);
  // // //
  // // // [DetherCore] set license prices
  // // //

  //
  // [DetherCore] set roles to correct addresses
  //

  await detherCore.setCFO(cfoDether);
  console.log('cfo should be => ', cfoDether, await detherCore.cfoAddress.call());
  console.log('delay');
  await delay(42000);
  await detherCore.setCSO(csoDether);
  console.log('cso should be => ', csoDether, await detherCore.csoAddress.call());
  console.log('delay');
  await delay(42000);
  await detherCore.setCMO(cmoDether);
  console.log('cmo should be => ', cmoDether, await detherCore.cmoAddress.call());
  console.log('delay');
  await delay(42000);
  await detherCore.setCEO(ceoDether);
  console.log('ceo should be => ', ceoDether, await detherCore.ceoAddress.call());
  console.log('delay');
  await delay(42000);

  callback();
};
