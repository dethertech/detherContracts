
const DetherCore = artifacts.require('./DetherCore.sol');
const DetherBank = artifacts.require('./DetherBank.sol');
const DetherToken = artifacts.require('./dth/DetherToken.sol');
const SmsCertifier = artifacts.require('./certifier/SmsCertifier.sol');
const KycCertifier = artifacts.require('./certifier/KycCertifier.sol');
const ExchangeRateOracle = artifacts.require('./ExchangeRateOracle.sol');

const ceoDether = "0xC5F8a06ed1CfB17d0366eF03FEDF37568B0ce246";
const ownerCertifier = "0xC5F8a06ed1CfB17d0366eF03FEDF37568B0ce246";
const cmoDether = "0xC5F8a06ed1CfB17d0366eF03FEDF37568B0ce246";
const cfoDether = "0xC5F8a06ed1CfB17d0366eF03FEDF37568B0ce246";
const csoDether = "0xC5F8a06ed1CfB17d0366eF03FEDF37568B0ce246";

const kycDelegateTestnet = '0x32BedF6609f002A591f871009C8e66D84F98d48E';
const initScript = '0x391edA1b8D31f891d1653B131779751BdeDA24D3';

const ownerdeploy = "0x6AAb2B0913B70270E840B14c2b23B716C0a43522"

module.exports = async (callback) => {

  // //
  // // Deploy all contracts
  // //
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

  // //
  // // [DetherCore] init
  // //
  await detherCore.initContract(detherToken.address, detherBank.address);
  console.log('bank should be => ', detherBank.address, await detherCore.bank.call());
  console.log('dth should be => ', detherToken.address, await detherCore.dth.call());

  // //
  // // [DetherCore] set initial user roles (will be updated at the very last step down below)
  // //
  await detherCore.setCEO(ownerdeploy);
  console.log('ceo should be => ', ownerdeploy, await detherCore.ceoAddress.call());
  await detherCore.setCFO(ownerdeploy);
  console.log('cfo should be => ', ownerdeploy, await detherCore.cfoAddress.call());
  await detherCore.setCSO(ownerdeploy);
  console.log('cso should be => ', ownerdeploy, await detherCore.csoAddress.call());
  await detherCore.setCMO(ownerdeploy);
  console.log('cmo should be => ', ownerdeploy, await detherCore.cmoAddress.call());

  // //
  // // [DetherCore] set references (addresses) to other contracts
  // //
  await detherCore.setPriceOracle(exchangeRateOracle.address);
  console.log('priceOralce should be => ', exchangeRateOracle.address, await detherCore.priceOracle.call());
  await detherCore.setSmsCertifier(smsCertifier.address);
  console.log('sms certifier should be => ', smsCertifier.address, await detherCore.smsCertifier.call());
  await detherCore.setKycCertifier(kycCertifier.address);
  console.log('kyc certifier should be => ', kycCertifier.address, await detherCore.kycCertifier.call());

  // //
  // // [DetherCore] set moderator of shop/teller
  // //
  await detherCore.setTellerModerator(kycDelegateTestnet);  //
  console.log('teller moderator should be => ', ceoDether, await detherCore.tellerModerators.call(ceoDether));

  //
  // [DetherBank] set DetherToken address + set owner to the be the DetherCore contract
  //
  await detherBank.setDth(detherToken.address);
  // console.log('dth inside detherBank should be => ', detherToken.address, await detherBank.detherToken.call());
  await detherBank.transferOwnership(detherCore.address);
  console.log('owner bank should be => ', detherCore.address, await detherBank.owner.call());

  //
  // [SmsCertifier + KycCertifier] set person who can 'certify' users
  //

  await smsCertifier.addDelegate(kycDelegateTestnet, 'smsDelegate');
  await smsCertifier.addDelegate(ownerdeploy, 'smsDelegate');
  console.log('ownerdeploy should be a sms delegate => ', await smsCertifier.isDelegate.call(ownerdeploy));
  console.log('ownerdeploy should be a sms delegate => ', await smsCertifier.isDelegate.call(kycDelegateTestnet));
  await smsCertifier.transferOwnership(ceoDether);
  await kycCertifier.transferOwnership(ceoDether);
  //
  // [DetherCore] set license prices
  //
  await detherCore.setLicenceTellerPrice(web3.toHex('FR'), web3.toWei('1'));
  console.log('licenceteller should be => ', '10', web3.fromWei(await detherCore.licenceTeller.call(web3.toHex('FR'))));
  await detherCore.setLicenceShopPrice(web3.toHex('FR'), web3.toWei('1'));
  console.log('licenceshop should be => ', '10', web3.fromWei(await detherCore.licenceShop.call(web3.toHex('FR'))));

  await detherCore.setLicenceTellerPrice(web3.toHex('GI'), web3.toWei('1'));
  console.log('licenceteller should be => ', '10', web3.fromWei(await detherCore.licenceTeller.call(web3.toHex('FR'))));
  await detherCore.setLicenceShopPrice(web3.toHex('GI'), web3.toWei('1'));
  console.log('licenceshop should be => ', '10', web3.fromWei(await detherCore.licenceShop.call(web3.toHex('FR'))));

  //

  //
  // [DetherCore] set tier1 + tier2 daily sell limit (in usd)
  //
  await detherCore.setSellDailyLimit(1, web3.toHex('FR'), 1000);
  console.log('getSellDailyLimit tier1 FR should be => ', '1000', (await detherCore.getSellDailyLimit(1, web3.toHex('FR'))));
  await detherCore.setSellDailyLimit(2, web3.toHex('FR'), 5000);
  console.log('getSellDailyLimit tier2 FR should be => ', '5000', (await detherCore.getSellDailyLimit(2, web3.toHex('FR'))));
  await detherCore.setSellDailyLimit(1, web3.toHex('GI'), 1000);
  console.log('getSellDailyLimit tier1 AU should be => ', '1000', (await detherCore.getSellDailyLimit(1, web3.toHex('GI'))));
  await detherCore.setSellDailyLimit(2, web3.toHex('GI'), 5000);
  console.log('getSellDailyLimit tier2 AU should be => ', '5000', (await detherCore.getSellDailyLimit(2, web3.toHex('GI'))));

  //
  // [DetherCore] open specific zones(=countries) for shops/tellers
  //
  await detherCore.openZoneShop(web3.toHex('FR'));
  console.log('zone FR for shop should be open', await detherCore.openedCountryShop.call(web3.toHex('FR')));
  await detherCore.openZoneShop(web3.toHex('GI'));
  console.log('zone GI for shop should be open', await detherCore.openedCountryShop.call(web3.toHex('GI')));
  await detherCore.openZoneTeller(web3.toHex('FR'));
  console.log('zone FR for teller should be open', await detherCore.openedCountryTeller.call(web3.toHex('FR')));
  await detherCore.openZoneTeller(web3.toHex('GI'));
  console.log('zone GI for teller should be open', await detherCore.openedCountryTeller.call(web3.toHex('GI')));

  //
  // [DetherCore] set roles to correct addresses
  //
  await detherCore.setCFO(ceoDether);
  console.log('cfo should be => ', cfoDether, await detherCore.cfoAddress.call());
  await detherCore.setCSO(ceoDether);
  console.log('cso should be => ', csoDether, await detherCore.csoAddress.call());
  await detherCore.setCMO(ceoDether);
  console.log('cmo should be => ', cmoDether, await detherCore.cmoAddress.call());
  await detherCore.setCEO(ceoDether);
  console.log('ceo should be => ', ceoDether, await detherCore.ceoAddress.call());
  //
  // [DetherToken] mint some tokens
  //
  // await detherToken.mint(ceoDether, web3.toWei(10000000, 'ether'));
  // await detherToken.finishMinting();
  // console.log('balance should be 10000000 => ', await detherToken.balanceOf.call(ceoDether));

  callback();
};
