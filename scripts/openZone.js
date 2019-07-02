const fs = require('fs');
const Papa = require('papaparse');
const GeoRegistry = artifacts.require('GeoRegistry');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const { addCountry } = require('../test/utils/geo');
const BATCH_SIZE = 300;
// require message sender is certifer, CSO, ADD ENOUGH DTH
const cmo = '0x1ecb59E6EAb86eCdE351229e64E47dD6B65b9329'


const toNBytes = (str, n) => {
  let buffer = '';
  for (let i = 0; i < n; i += 1) {
    buffer += str[i] ? str[i].charCodeAt(0).toString(16) : '00';
  }
  return buffer;
};
let tsx;


module.exports = async (callback) => {

  const geoRegistryInstance = await GeoRegistry.deployed();
  console.log('address geoRegistryInstance => ', geoRegistryInstance.address);



  // const factory = async (noncestart, noncetsx, country) => {

  //   console.log('factory', noncestart, noncetsx, noncetsx - noncestart);
  //   await delay(5000);
  //   console.log('hello')
  //   // setTimeout(async () => {
  //   //   console.log('factory', country, toNBytes(country, 2));
  //   //   try {
  //   //     // tsx = geoRegistryInstance.enableCountry(toNBytes(country, 2))

  //   //     // console.log('tsx', tsx);
  //   //   } catch (e) {
  //   //     console.log('err', e);
  //   //   }
  //   // }, (noncetsx - noncestart) * 1500);
  // };

  const Web3 = require('web3');
  const web3 = new Web3('https://kovan.infura.io/v3/f19f6c9d405a460f91964949efe0e78e');

  const csv = fs.readFileSync('./openedCountry.csv', 'utf8');
  const { data } = Papa.parse(csv, {
    header: true,
  });

  console.log('Performing whitelisting operations');


  const nonce = 1180;
  let counter = 10;
  console.log('data lenght', data.length);

  data.forEach(async (countryCode) => {

    console.log('add country =>', countryCode, toNBytes(country, 2));
    // await geoRegistryInstance.enableCountry(toNBytes(country, 2))
    // const { countryGasCost, mostExpensiveTrxGasCost, txCount, countryMap } = await addCountry(owner, web3, geoRegistryInstance, countryCode, BATCH_SIZE);
    // for (const key in countryMap) {
    //   await geoRegistryContract.level_2(web3.utils.asciiToHex(countryCode), web3.utils.asciiToHex(key));
    //   // assert.deepStrictEqual(onchainContent, countryMap[key], `content for key ${key} does not match expected`);
    // }
  })

  // for (let i = 0; i < data.length; i++) {
  //   const { COUNTRY } = data[i];
  //   if (i < counter) {

  //     factory(nonce, nonce + i + 1, COUNTRY);

  //   }
  // }


  callback();
}
