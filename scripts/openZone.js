const fs = require('fs');
const Papa = require('papaparse');
const DetherCore = artifacts.require('DetherCore');
const DetherToken = artifacts.require('DetherToken');

// require message sender is certifer, CSO, ADD ENOUGH DTH
const cmo = '0x1ecb59E6EAb86eCdE351229e64E47dD6B65b9329'


const toNBytes = (str, n) => {
  let buffer = '';
  for (let i = 0; i < n; i += 1) {
    buffer += str[i] ? str[i].charCodeAt(0).toString(16) : '00';
  }
  return buffer;
};


module.exports = async (callback) => {

const dether = await DetherCore.deployed();
const dth = await DetherToken.deployed();
console.log('dth ', dth.address);
console.log('dether ', dether.address);

// await dether.openZoneShop(web3.toHex('AU'));
// await dether.setLicenceTellerPrice(web3.toHex('AU'), web3.toWei('1'));
//

console.log('Performing shop add');
let transferMethodTransactionData;
let tsx;

// const licenceprice = await dether.licenceShop(web3.toHex('AU'));

const factory = (noncestart, noncetsx, country) => {
  setTimeout( async () => {
    console.log('factory', country);
    try {
      const tsx = await dether.openZoneShop(web3.toHex(country) ,{
            from: cmo,
            nonce: noncetsx,
            gasPrice: 40000000000
          });
      console.log('tsx', tsx);
    } catch (e) {
      console.log('err', e);
    }

  }, (noncetsx - noncestart)  * 1500);
};

// check for the current nonce
// web3.eth.getTransactionCount(cso,(err, res) =>{

const csv = fs.readFileSync('./isocountrycode.csv', 'utf8');
const { data } = Papa.parse(csv, {
  header: true,
});

console.log('Performing whitelisting operations');

console.log('data', data);
const nonce =  1180;
let counter = 3;
for (let i = 0; i < data.length; i++) {
  const { ISO2 } = data[i];
  console.log('iso2', ISO2);
  if (i < counter)
    // factory(nonce,  nonce + i - counter + 1, ISO2);
    factory(nonce,  nonce + i + 1, ISO2);

}
// });

 callback();
}
