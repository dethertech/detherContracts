
const {expectThrow, waitForMined} = require('./utils');
const {teller1, teller2, teller3, shop1, shop2, shop3, shop8} = require('./mock.json');
const DetherCore = artifacts.require('./DetherCore.sol');
const DetherBank = artifacts.require('./DetherBank.sol');
const SmsCertifier = artifacts.require('./certifier/SmsCertifier.sol');
const Dth = artifacts.require('./token/DetherToken.sol');

// fix to solve truffle pblm with overloading
const web3Abi = require('web3-eth-abi');
const overloadedTransferAbi = {
    "constant": false,
    "inputs": [
        {
            "name": "_to",
            "type": "address"
        },
        {
            "name": "_value",
            "type": "uint256"
        },
        {
            "name": "_data",
            "type": "bytes"
        }
    ],
    "name": "transfer",
    "outputs": [
        {
            "name": "",
            "type": "bool"
        }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
};

let dether, smsCertifier, dthToken, detherBank ;

String.prototype.hexEncode = function(){
    var hex, i;

    var result = "";
    for (i=0; i<this.length; i++) {
        hex = this.charCodeAt(i).toString(16);
        result += (""+hex).slice(-4);
    }
    return '0x' + result
}

const toNBytes = (str, n) => {
  let buffer = '';
  for (let i = 0; i < n; i += 1) {
    buffer += str[i] ? str[i].charCodeAt(0).toString(16) : '00';
  }
  return buffer;
};

const
  [
      owner
    , user1address
    , user2address
    , user3address
    , moderator
    , cmo
    , certifier
  ] = web3.eth.accounts;

const convertTypes = x => {
  if (typeof x === 'string') return web3.toUtf8(x)
  else if (x.constructor.name === 'BigNumber') return x.toNumber()
  else return x
}

///
const convertBase = function () {
    function convertBase(baseFrom, baseTo) {
        return function (num) {
            return parseInt(num, baseFrom).toString(baseTo);
        };
    }
    // binary to decimal
    convertBase.bin2dec = convertBase(2, 10);
    // binary to hexadecimal
    convertBase.bin2hex = convertBase(2, 16);
    // decimal to binary
    convertBase.dec2bin = convertBase(10, 2);
    // decimal to hexadecimal
    convertBase.dec2hex = convertBase(10, 16);
    // hexadecimal to binary
    convertBase.hex2bin = convertBase(16, 2);
    // hexadecimal to decimal
    convertBase.hex2dec = convertBase(16, 10);
    return convertBase;
}();
///

// const intTo4bytes = function (intvalue) {
//   hexvalue = convertBase.dec2hex(intvalue);
//   let result = hexvalue;
//   for (i = 0; i + hexvalue.length< 8; i++) {
//     result = '0' + result
//   }
//   return result;
// }

const intTo5bytes = function (intvalue) {
  let hexvalue;
  let result;
  if (intvalue < 0 ) {
    intvalue *= -1;
    hexvalue = convertBase.dec2hex(intvalue);
    result = hexvalue;
    for (let i = 0; i + hexvalue.length < 8; i += 1) {
      result = `0${result}`;
    }
    result = `01${result}`;
  } else {
    hexvalue = convertBase.dec2hex(intvalue);
    result = hexvalue;
    for (let i = 0; i + hexvalue.length < 8; i += 1) {
      result = `0${result}`;
    }
    result = `00${result}`;
  }
  return result;
}

const intTo2bytes = function (intvalue) {
  hexvalue = convertBase.dec2hex(intvalue);
  let result = hexvalue;
  for (i = 0; i + hexvalue.length< 4; i++) {
    result = '0' + result
  }
  return result;
}

const intTobytes = function (intvalue) {
  hexvalue = convertBase.dec2hex(intvalue);
  let result = hexvalue;
  for (i = 0; i + hexvalue.length< 2; i++) {
    result = '0' + result
  }
  return result;
}

const shopToContract = (rawshop) => {
  const lat = intTo5bytes(parseFloat(rawshop.lat) * 100000);
  const lng = intTo5bytes(parseFloat(rawshop.lng) * 100000);

  const hexshopGeo = `0x31${lat}${lng}`;
  const hexShopAddr = `${toNBytes(rawshop.countryId, 2)}${toNBytes(rawshop.postalCode, 16)}`;
  const hexShopId = `${toNBytes(rawshop.cat, 16)}${toNBytes(rawshop.name, 16)}`;
  const hexShopDesc = `${toNBytes(rawshop.description, 32)}${toNBytes(rawshop.opening, 16)}`;

  const hexShop = `${hexshopGeo}${hexShopAddr}${hexShopId}${hexShopDesc}`;
  return hexShop;
};

const shopToContractBulk = (rawshop) => {
  const lat = intTo5bytes(parseFloat(rawshop.lat) * 100000);
  const lng = intTo5bytes(parseFloat(rawshop.lng) * 100000);

  const hexshopGeo = `0x33${lat}${lng}`;
  const hexShopAddr = `${toNBytes(rawshop.countryId, 2)}${toNBytes(rawshop.postalCode, 16)}`;
  const hexShopId = `${toNBytes(rawshop.cat, 16)}${toNBytes(rawshop.name, 16)}`;
  const hexShopDesc = `${toNBytes(rawshop.description, 32)}${toNBytes(rawshop.opening, 16)}`;

  const hexShop = `${hexshopGeo}${hexShopAddr}${hexShopId}${hexShopDesc}${rawshop.address}`;
  return hexShop;
};

const tellerToContract = (rawteller) => {
  const lat = intTo5bytes(parseFloat(rawteller.lat) * 100000);
  const lng = intTo5bytes(parseFloat(rawteller.lng) * 100000);
  const currency = intTobytes(parseInt(rawteller.currencyId));
  const avatar = intTobytes(parseInt(rawteller.avatarId));
  const rates = intTo2bytes(parseFloat(rawteller.rates) * 10);
  const hexteller = `0x32${lat}${lng}${toNBytes(rawteller.countryId, 2)}${toNBytes(rawteller.postalCode, 16)}${avatar}${currency}${toNBytes(rawteller.messenger, 16)}${rates}`
  return hexteller;
}

const shopFromContract = (rawshop) => {
  return {
    lat: rawshop[0] / 100000,
    lng: rawshop[1] / 100000,
    countryId: web3.toAscii(rawshop[2]).replace(/\0/g,''),
    postalCode: web3.toAscii(rawshop[3]).replace(/\0/g,''),
    cat: web3.toAscii(rawshop[4]).replace(/\0/g,''),
    name: web3.toAscii(rawshop[5]).replace(/\0/g,''),
    description: web3.toAscii(rawshop[6]).replace(/\0/g,''),
    opening: web3.toAscii(rawshop[7]).replace(/\0/g,''),
  }
}

const tellerFromContract = (rawTeller) => {
  const data = {
      lat: rawTeller[0] / 100000,
      lng: rawTeller[1] / 100000,
      countryId: web3.toAscii(rawTeller[2]).replace(/\0/g,''),
      postalCode: web3.toAscii(rawTeller[3]).replace(/\0/g,''),
    currencyId: rawTeller[4].toNumber(),
    messenger: web3.toAscii(rawTeller[5]).replace(/\0/g,''),
    avatarId: rawTeller[6].toNumber(),
    rates: rawTeller[7].toNumber() / 10,
    balance: web3.fromWei(rawTeller[8].toNumber(), 'ether'),
    online: rawTeller[9],
    // amount: ,
  }
  return data;
}

contract('Dether Dth', async () => {
  beforeEach( async () => {
    dthToken = await Dth.new({gas: 4700000, from: owner});
    dether = await DetherCore.new({gas: 4700000, from: owner});
    smsCertifier = await SmsCertifier.new({gas: 4000000, from: owner});
    detherBank = await DetherBank.new({gas: 4000000, from: owner});
    //
    await dether.setSmsCertifier(smsCertifier.address);
    await dether.initContract(dthToken.address, detherBank.address);
    await dether.setCMO(cmo);
    await dether.setCSO(moderator);
    await dether.setShopModerator(moderator);
    await dether.setTellerModerator(moderator);
    await detherBank.setDth(dthToken.address);
    await detherBank.transferOwnership(dether.address);
    //
    await smsCertifier.addDelegate(certifier, 'test', {gas: 4000000, from: owner});
    await smsCertifier.certify(user1address, {gas: 4000000, from: certifier});
    await smsCertifier.certify(user2address, {gas: 4000000, from: certifier});
    await smsCertifier.certify(user3address, {gas: 4000000, from: certifier});
    await smsCertifier.certify(moderator, {gas: 4000000, from: certifier});

    await dthToken.mint(owner, 1000);
    await dthToken.mint(user1address, 1000);
    await dthToken.mint(user2address, 1000);
    await dthToken.mint(user3address, 1000);
    await dthToken.mint(moderator, 1000);
    await dthToken.finishMinting();
    //
    await dether.setLicenceShopPrice(web3.toHex(shop1.countryId) ,10,{from: cmo});
    await dether.setLicenceTellerPrice(web3.toHex(shop1.countryId) ,10,{from: cmo});
    await dether.openZoneShop(web3.toHex(shop1.countryId),{from: cmo});
    await dether.openZoneShop(web3.toHex(shop2.countryId),{from: cmo});
    await dether.openZoneShop(web3.toHex(shop3.countryId),{from: cmo});
    await dether.openZoneShop(web3.toHex(shop8.countryId),{from: cmo});
    await dether.openZoneTeller(web3.toHex(teller1.countryId),{from: cmo});
    await dether.openZoneTeller(web3.toHex(teller2.countryId),{from: cmo});
    await dether.openZoneTeller(web3.toHex(teller3.countryId),{from: cmo});
  })

  contract('Add shop --', async () =>  {

    it('should be able to bulk add shop from the same address', async () => {
      console.log('ADD SHOP');
      let balance = (await dthToken.balanceOf(moderator)).toNumber();
      shop1.address = '0000000000000000000000000000000000000001';
      let transferMethodTransactionData = web3Abi.encodeFunctionCall(
          overloadedTransferAbi,
          [
              dether.address,
              20,
              shopToContractBulk(shop1)
          ]
      );
      console.log('exe bytes', shopToContractBulk(shop1));
      let tsx = await web3.eth.sendTransaction({from: moderator, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});
      let shop1value = await dether.getShop('0x0000000000000000000000000000000000000001');
      assert.equal(await dether.isShop('0x0000000000000000000000000000000000000001'), true, 'assert shop is now online');
      let formatedValue = shopFromContract(shop1value);
      assert.equal(formatedValue.lat, shop1.lat, 'verif lat');
      assert.equal(formatedValue.lng, shop1.lng, 'verif lng');
      assert.equal(formatedValue.countryId, shop1.countryId, 'verif country id');
      assert.equal(formatedValue.postalCode, shop1.postalCode, 'verif postal code');
      assert.equal(formatedValue.cat, shop1.cat, 'verif cat');
      assert.equal(formatedValue.name, shop1.name, 'verif name');
      assert.equal(formatedValue.description, shop1.description, 'verif  description');
      assert.equal(formatedValue.opening, shop1.opening, 'verif opening');

      shop2.address = '0000000000000000000000000000000000000002';
       transferMethodTransactionData = web3Abi.encodeFunctionCall(
          overloadedTransferAbi,
          [
              dether.address,
              20,
              shopToContractBulk(shop2)
          ]
      );
       tsx = await web3.eth.sendTransaction({from: moderator, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});
      let shop2value = await dether.getShop('0x0000000000000000000000000000000000000002');
      assert.equal(await dether.isShop('0x0000000000000000000000000000000000000002'), true, 'assert shop is now online');
       formatedValue = shopFromContract(shop2value);
      assert.equal(formatedValue.lat, shop2.lat, 'verif lat');
      assert.equal(formatedValue.lng, shop2.lng, 'verif lng');
      assert.equal(formatedValue.countryId, shop2.countryId, 'verif country id');
      assert.equal(formatedValue.postalCode, shop2.postalCode, 'verif postal code');
      assert.equal(formatedValue.cat, shop2.cat, 'verif cat');
      assert.equal(formatedValue.name, shop2.name, 'verif name');
      assert.equal(formatedValue.description, shop2.description, 'verif  description');
      assert.equal(formatedValue.opening, shop2.opening, 'verif opening');

      // verify when delete CSO is refund
      assert.equal((await dthToken.balanceOf(moderator)).toNumber(), 960, 'assert balance have 2 * 20 less');
      // delete
      await dether.deleteShopMods('0x0000000000000000000000000000000000000002', {from: moderator});
      assert.equal(await dether.isShop('0x0000000000000000000000000000000000000002'), false, 'assert shop is now online');
      assert.equal((await dthToken.balanceOf(moderator)).toNumber(), 980, 'assert balance have 20 more');
    })


  })
});
