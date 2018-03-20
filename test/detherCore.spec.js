
const {expectThrow, waitForMined} = require('./utils');
const {teller1, teller2, teller3, shop1, shop2, shop3, shop7} = require('./mock.json');
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

const intTo4bytes = function (intvalue) {
  hexvalue = convertBase.dec2hex(intvalue);
  let result = hexvalue;
  for (i = 0; i + hexvalue.length< 8; i++) {
    result = '0' + result
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
  const lat = intTo4bytes(parseFloat(rawshop.lat) * 100000);
  const lng = intTo4bytes(parseFloat(rawshop.lng) * 100000);

  const hexshopGeo = `0x31${lat}${lng}`;
  const hexShopAddr = `${toNBytes(rawshop.countryId, 2)}${toNBytes(rawshop.postalCode, 16)}`;
  const hexShopId = `${toNBytes(rawshop.cat, 16)}${toNBytes(rawshop.name, 16)}`;
  const hexShopDesc = `${toNBytes(rawshop.description, 32)}${toNBytes(rawshop.opening, 16)}31`;

  const hexShop = `${hexshopGeo}${hexShopAddr}${hexShopId}${hexShopDesc}`;
  return hexShop;
};

const tellerToContract = (rawteller) => {
  const lat = intTo4bytes(parseFloat(rawteller.lat) * 100000);
  const lng = intTo4bytes(parseFloat(rawteller.lng) * 100000);
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
  console.log('teller from contract', rawTeller);
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
    dthToken = await Dth.new({gas: 4000000, from: owner});
    dether = await DetherCore.new({gas: 4000000, from: owner});
    smsCertifier = await SmsCertifier.new({gas: 4000000, from: owner});
    detherBank = await DetherBank.new({gas: 4000000, from: owner});

    await dether.setLicenceShopPrice(web3.toHex(shop1.countryId) ,10);
    await dether.setSmsCertifier(smsCertifier.address);
    await dether.initContract(dthToken.address, detherBank.address);
    await dether.setCMO(cmo);
    await dether.setShopModerator(moderator);
    await dether.setTellerModerator(moderator);
    await detherBank.setDth(dthToken.address);
    await detherBank.transferOwnership(dether.address);

    await smsCertifier.addDelegate(certifier, 'test', {gas: 4000000, from: owner});
    await smsCertifier.certify(user1address, {gas: 4000000, from: certifier});
    await smsCertifier.certify(user2address, {gas: 4000000, from: certifier});
    await smsCertifier.certify(user3address, {gas: 4000000, from: certifier});

    await dthToken.mint(owner, 1000);
    await dthToken.mint(user1address, 1000);
    await dthToken.mint(user2address, 1000);
    await dthToken.mint(user3address, 1000);
    await dthToken.finishMinting();

    await dether.openZoneShop(web3.toHex(shop1.countryId),{from: cmo});
    await dether.openZoneShop(web3.toHex(shop2.countryId),{from: cmo});
    await dether.openZoneShop(web3.toHex(shop3.countryId),{from: cmo});
    await dether.openZoneTeller(web3.toHex(teller1.countryId),{from: cmo});
    await dether.openZoneTeller(web3.toHex(teller2.countryId),{from: cmo});
    await dether.openZoneTeller(web3.toHex(teller3.countryId),{from: cmo});
  })

  contract('Add shop --', async () =>  {

    it('should parse data and register and be on the map', async () => {
      console.log('shop to contract', shopToContract(shop1));
      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
          overloadedTransferAbi,
          [
              dether.address,
              20,
              shopToContract(shop1)
          ]
      );
      const tsx = await web3.eth.sendTransaction({from: user1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});

      let shop1value = await dether.getShop(user1address);
      assert.equal(await dether.isShop(user1address), true, 'assert shop is now online');
      const formatedValue = shopFromContract(shop1value);
      assert.equal(formatedValue.lat, shop1.lat, 'verif lat');
      assert.equal(formatedValue.lng, shop1.lng, 'verif lng');
      assert.equal(formatedValue.countryId, shop1.countryId, 'verif country id');
      assert.equal(formatedValue.postalCode, shop1.postalCode, 'verif postal code');
      assert.equal(formatedValue.cat, shop1.cat, 'verif cat');
      assert.equal(formatedValue.name, shop1.name, 'verif name');
      assert.equal(formatedValue.description, shop1.description, 'verif  description');
      assert.equal(formatedValue.opening, shop1.opening, 'verif opening');

      const zone = await dether.getZoneShop(shop1.countryId.hexEncode(), shop1.postalCode.hexEncode());
    })

    it('should not be possible to add shop in unopened zone', async () => {
      await dether.closeZoneShop(web3.toHex(shop3.countryId),{from: cmo});

      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
          overloadedTransferAbi,
          [
              dether.address,
              20,
              shopToContract(shop3)
              // web3.toHex("test")
          ]
      );
      try {
        const tsx = await web3.eth.sendTransaction({from: user3address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});
      } catch (err) {

      }

      assert.equal(await dether.isShop(user3address), false, 'assert shop is now online');

    })

    it('should get all shop in a zone', async () => {

      zone = await dether.getZoneShop(web3.toHex(shop1.countryId), web3.toHex(shop1.postalCode));
      assert.equal(zone, '', 'verif empty zone')

      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
          overloadedTransferAbi,
          [
              dether.address,
              20,
              shopToContract(shop1)
          ]
      );
      const tsx = await web3.eth.sendTransaction({from: user1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});

      let transferMethodTransactionData2 = web3Abi.encodeFunctionCall(
          overloadedTransferAbi,
          [
              dether.address,
              20,
              shopToContract(shop7)
          ]
      );
      await web3.eth.sendTransaction({from: user2address, to: dthToken.address, data: transferMethodTransactionData2, value: 0, gas: 5700000});

      zone = await dether.getZoneShop(shop1.countryId.hexEncode(), shop1.postalCode.hexEncode());
      assert.deepEqual(zone, [user1address, user2address], 'incorrect zone');
    })

    it('should have empty zone after delete', async () => {
      let zone = await dether.getZoneShop(web3.toHex(shop1.countryId), web3.toHex(shop1.postalCode));
      assert.equal(zone, '', 'verif empty zone');

      let transferMethodTransactionData = web3Abi.encodeFunctionCall(
          overloadedTransferAbi,
          [
              dether.address,
              20,
              shopToContract(shop1)
          ]
      );
      await web3.eth.sendTransaction({from: user1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});

      let transferMethodTransactionData2 = web3Abi.encodeFunctionCall(
          overloadedTransferAbi,
          [
              dether.address,
              20,
              shopToContract(shop2)
          ]
      );
      await web3.eth.sendTransaction({from: user2address, to: dthToken.address, data: transferMethodTransactionData2, value: 0, gas: 5700000});
      assert.equal(await dether.isShop(user1address), true, 'assert shop is now online');
      let tsx = await dether.deleteShop({from: user2address, gas:4000000});
      await dether.deleteShop({from: user1address, gas:4000000});
      zone = await dether.getZoneShop(shop1.countryId.hexEncode(), shop1.postalCode.hexEncode());
      assert.equal(zone, '', 'verif empty zone');
    })

    it('should have token back after delete', async () => {
      const baltoken = await dthToken.balanceOf(user1address);
      const balstaked = await dether.getStakedShop(user1address);
      let zone = await dether.getZoneShop(web3.toHex(shop1.countryId), web3.toHex(shop1.postalCode));
      assert.equal(zone, '', 'verif empty zone')

      let transferMethodTransactionData = web3Abi.encodeFunctionCall(
          overloadedTransferAbi,
          [
              dether.address,
              20,
              shopToContract(shop1)
          ]
      );
      await web3.eth.sendTransaction({from: user1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});

      assert.equal(await dether.isShop(user1address), true, 'assert shop is now online');
      await dether.deleteShop({from: user1address, gas:4000000});
      const newbaltoken = await dthToken.balanceOf(user1address);
      const newbalstaked = await dether.getStakedShop(user1address);
      assert.equal(newbaltoken.toNumber(), baltoken.add(balstaked).toNumber(), 'verif balance token');
      assert.equal(newbalstaked.toNumber(), 0, 'verif balance token');
    })

    it('should be able to delete a random shop as a moderator', async () => {
      let transferMethodTransactionData = web3Abi.encodeFunctionCall(
          overloadedTransferAbi,
          [
              dether.address,
              20,
              shopToContract(shop1)
          ]
      );
      await web3.eth.sendTransaction({from: user1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});

      assert.equal(await dether.isShop(user1address), true, 'assert shop is now online');
      await dether.deleteShopMods(user1address, {from: moderator, gas:4000000});
      assert.equal(await dether.isShop(user1address), false, 'assert is shop');
    })

    it('should not be be able to delete a random shop if not moderator', async () => {
      assert.equal(await dether.isShop(user1address), false, 'assert is shop pref delete');
      let transferMethodTransactionData = web3Abi.encodeFunctionCall(
          overloadedTransferAbi,
          [
              dether.address,
              20,
              shopToContract(shop1)
          ]
      );
      await web3.eth.sendTransaction({from: user1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});

      assert.equal(await dether.isShop(user1address), true, 'assert is shop now online');
      try {
          await dether.deleteShopMods(user1address, {from: cmo, gas:4000000});
      } catch(err) {

      }
      assert.equal(await dether.isShop(user1address), true, 'assert is shop still online');
    })

  })

  /*
   * Teller
   */

    contract('Add Teller --', async () =>  {

      it('should parse data and register and be on the map', async () => {
        const transferMethodTransactionData = web3Abi.encodeFunctionCall(
            overloadedTransferAbi,
            [
                dether.address,
                20,
                tellerToContract(teller1)
            ]
        );
        const tsx = await web3.eth.sendTransaction({from: user1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});
        console.log('teller ', tellerToContract(teller1));
        let teller1value = await dether.getTeller(user1address);
        console.log('teller1value', teller1value);
        const valueFromContract = tellerFromContract(teller1value);
        assert.equal(await dether.isTeller(user1address), true, 'assert shop is now online');
        assert.equal(valueFromContract.lat, teller1.lat, 'verif lat');
        assert.equal(valueFromContract.lng, teller1.lng, 'verif lng');
        assert.equal(valueFromContract.countryId, teller1.countryId, 'verif country id');
        assert.equal(valueFromContract.postalCode, teller1.postalCode, 'verif postal code');
        assert.equal(valueFromContract.currencyId, teller1.currencyId, 'verif currency');
        assert.equal(valueFromContract.messenger, teller1.messenger, 'verif messenger');
        assert.equal(valueFromContract.avatarId, teller1.avatarId, 'verif avatar');
        assert.equal(valueFromContract.rates, teller1.rates, 'verif rate');
        assert.equal(valueFromContract.online,true, 'verif status')
      })

      it('should not be possible to add shop in unopened zone', async () => {
        await dether.closeZoneTeller(web3.toHex(teller3.countryId),{from: cmo});

        const transferMethodTransactionData = web3Abi.encodeFunctionCall(
            overloadedTransferAbi,
            [
                dether.address,
                20,
                tellerToContract(teller3)
            ]
        );
        try {
          const tsx = await web3.eth.sendTransaction({from: user3address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});
        } catch (err) {

        }
        assert.equal(await dether.isTeller(user3address), false, 'assert shop is now online');
      })

      it('should get all teller in a zone', async () => {

        zone = await dether.getZoneTeller(teller1.countryId.hexEncode(), teller1.postalCode.hexEncode());
        assert.equal(zone, '', 'verif empty zone')

        const transferMethodTransactionData = web3Abi.encodeFunctionCall(
            overloadedTransferAbi,
            [
                dether.address,
                20,
                tellerToContract(teller3)
            ]
        );
        const tsx = await web3.eth.sendTransaction({from: user1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});

        let transferMethodTransactionData2 = web3Abi.encodeFunctionCall(
            overloadedTransferAbi,
            [
                dether.address,
                20,
                tellerToContract(teller2)
            ]
        );
        await web3.eth.sendTransaction({from: user2address, to: dthToken.address, data: transferMethodTransactionData2, value: 0, gas: 5700000});

        zone = await dether.getZoneTeller(teller2.countryId.hexEncode(), teller2.postalCode.hexEncode());
        assert.deepEqual(zone, [user1address, user2address], 'incorrect zone');
      })

      it('should have empty zone after delete', async () => {
        let zone = await dether.getZoneTeller(web3.toHex(teller1.countryId), web3.toHex(teller1.postalCode));
        assert.equal(zone, '', 'verif empty zone');

        let transferMethodTransactionData = web3Abi.encodeFunctionCall(
            overloadedTransferAbi,
            [
                dether.address,
                20,
                tellerToContract(teller1)
            ]
        );
        await web3.eth.sendTransaction({from: user1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});

        let transferMethodTransactionData2 = web3Abi.encodeFunctionCall(
            overloadedTransferAbi,
            [
                dether.address,
                20,
                tellerToContract(teller2)
            ]
        );
        await web3.eth.sendTransaction({from: user2address, to: dthToken.address, data: transferMethodTransactionData2, value: 0, gas: 5700000});
        assert.equal(await dether.isTeller(user1address), true, 'assert shop is now online');
        let tsx = await dether.deleteTeller({from: user1address, gas:4000000});
        await dether.deleteTeller({from: user2address, gas:4000000});
        zone = await dether.getZoneTeller(teller1.countryId.hexEncode(), teller1.postalCode.hexEncode());
        assert.equal(zone, '', 'verif empty zone 1');
        zone = await dether.getZoneTeller(teller2.countryId.hexEncode(), teller2.postalCode.hexEncode());
        assert.equal(zone, '', 'verif empty zone 2');
      })

      it('should have token back after delete', async () => {
        let baltoken = await dthToken.balanceOf(user1address);
        let balstaked = await dether.getStakedTeller(user1address);

        let zone = await dether.getZoneTeller(web3.toHex(teller1.countryId), web3.toHex(teller1.postalCode));
        assert.equal(zone, '', 'verif empty zone')

        let transferMethodTransactionData = web3Abi.encodeFunctionCall(
            overloadedTransferAbi,
            [
                dether.address,
                20,
                tellerToContract(teller1)
            ]
        );
        await web3.eth.sendTransaction({from: user1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});
        baltoken = await dthToken.balanceOf(user1address);
        balstaked = await dether.getStakedTeller(user1address);
        assert.equal(await dether.isTeller(user1address), true, 'assert shop is now online');
        await dether.deleteTeller({from: user1address, gas:4000000});
        baltoken = await dthToken.balanceOf(user1address);
        balstaked = await dether.getStakedTeller(user1address);
        const newbaltoken = await dthToken.balanceOf(user1address);
        const newbalstaked = await dether.getStakedTeller(user1address);
        assert.equal(newbaltoken.toNumber(), baltoken.add(balstaked).toNumber(), 'verif balance token 1 ');
        assert.equal(newbalstaked.toNumber(), 0, 'verif balance token 2 ');
      })

      it('should be able to delete a random shop as a moderator', async () => {
        let transferMethodTransactionData = web3Abi.encodeFunctionCall(
            overloadedTransferAbi,
            [
                dether.address,
                20,
                tellerToContract(teller1)
            ]
        );
        await web3.eth.sendTransaction({from: user1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});
        assert.equal(await dether.isTeller(user1address), true, 'assert shop is now online');
        await dether.deleteTellerMods(user1address, {from: moderator, gas:4000000});
        assert.equal(await dether.isTeller(user1address), false, 'assert is shop');
      })

      it('should not be be able to delete a random shop if not moderator', async () => {
        assert.equal(await dether.isTeller(user1address), false, 'assert is shop pref delete');
        let transferMethodTransactionData = web3Abi.encodeFunctionCall(
            overloadedTransferAbi,
            [
                dether.address,
                20,
                tellerToContract(teller1)
            ]
        );
        await web3.eth.sendTransaction({from: user1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});
        assert.equal(await dether.isTeller(user1address), true, 'assert is teller now online');
        try {
            await dether.deleteTellerMods(user1address, {from: cmo, gas:4000000});
        } catch(err) {

        }
        assert.equal(await dether.isTeller(user1address), true, 'assert is teller still online');
      })

      it('should be able to send coin from contract', async () => {
        const balancereceiverpre = await web3.eth.getBalance(moderator);
        let transferMethodTransactionData = web3Abi.encodeFunctionCall(
            overloadedTransferAbi,
            [
                dether.address,
                20,
                tellerToContract(teller1)
            ]
        );
        await web3.eth.sendTransaction({from: user1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});
        assert.equal(await dether.isTeller(user1address), true, 'assert is teller now online');
        // Add fund
        await dether.addFunds({from: user1address, value: web3.toWei(1, "ether")});
        assert.equal(web3.fromWei(await dether.getTellerBalance(user1address), 'ether'), 1, 'verif balance pre sell teller1');
        //sell ETH
        let tsx = await dether.sellEth(moderator, web3.toWei(1, 'ether'), {from: user1address});
        let balance = await dether.getTellerBalance(user1address);
        assert.equal(balance.toNumber() , 0, 'verif balance post sell teller1');
        let newbal = await web3.eth.getBalance(moderator);
        assert.equal(web3.fromWei(newbal).toNumber(), web3.fromWei(balancereceiverpre).toNumber() + 1, 'verif moderator has good receive his ETH');
      })

      it('should get his ETH back when delete shop', async () => {
        const balancereceiverpre = await web3.eth.getBalance(user1address);
        // register as shop
        let transferMethodTransactionData = web3Abi.encodeFunctionCall(
            overloadedTransferAbi,
            [
                dether.address,
                20,
                tellerToContract(teller1)
            ]
        );
        await web3.eth.sendTransaction({from: user1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});
        assert.equal(await dether.isTeller(user1address), true, 'assert is teller now online');
        // Add fund
        await dether.addFunds({from: user1address, value: web3.toWei(1, "ether")});
        assert.equal(web3.fromWei(await dether.getTellerBalance(user1address), 'ether'), 1, 'verif balance pre delete');
        let balancepredelete = await web3.eth.getBalance(user1address);
        await dether.deleteTeller({from: user1address, gas:3000000});
        let balancepostdelete = await web3.eth.getBalance(user1address);
        let balancetellerpostrefund = await dether.getTellerBalance(user1address);
        assert.equal(balancetellerpostrefund.toNumber(), 0, 'verif balance post delete');
        assert.isAbove(balancepostdelete.toNumber(), balancepredelete.toNumber(), 'balance is greater after refund');
      })

      it('should update teller', async () => {
        const balancereceiverpre = await web3.eth.getBalance(user1address);
        // register as shop
        let transferMethodTransactionData = web3Abi.encodeFunctionCall(
            overloadedTransferAbi,
            [
                dether.address,
                20,
                tellerToContract(teller1)
            ]
        );
        await web3.eth.sendTransaction({from: user1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});
        assert.equal(await dether.isTeller(user1address), true, 'assert is teller now online');
        const tsxupdate = await dether.updateTeller(9, web3.toHex('mehdi_dether'),7,289, false,{from: user1address});
        let teller1value = await dether.getTeller(user1address);
        const valueFromContract = tellerFromContract(teller1value);
        assert.equal(await dether.isTeller(user1address), true, 'assert shop is now online');
        assert.equal(valueFromContract.lat, teller1.lat, 'verif lat');
        assert.equal(valueFromContract.lng, teller1.lng, 'verif lng');
        assert.equal(valueFromContract.countryId, teller1.countryId, 'verif country id');
        assert.equal(valueFromContract.postalCode, teller1.postalCode, 'verif postal code');
        assert.equal(valueFromContract.currencyId, 9, 'verif currency');
        assert.equal(valueFromContract.messenger, 'mehdi_dether', 'verif messenger');
        assert.equal(valueFromContract.avatarId, 7, 'verif avatar');
        assert.equal(valueFromContract.rates, 28.9, 'verif rate');
        assert.equal(valueFromContract.online, false, 'verif status');
      })

      it('should have his reput upgrade when sell', async () => {
        const balancereceiverpre = await web3.eth.getBalance(moderator);
        // register as shop
        let transferMethodTransactionData = web3Abi.encodeFunctionCall(
            overloadedTransferAbi,
            [
                dether.address,
                20,
                tellerToContract(teller1)
            ]
        );
        await web3.eth.sendTransaction({from: user1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});
        assert.equal(await dether.isTeller(user1address), true, 'assert is teller now online');
        await dether.addFunds({from: user1address, value: web3.toWei(1, "ether")});
        assert.equal(web3.fromWei(await dether.getTellerBalance(user1address), 'ether'), 1, 'verif balance pre sell teller1');
        let tsx = await dether.sellEth(moderator, web3.toWei(1, 'ether'), {from: user1address});
        let balance = await dether.getTellerBalance(user1address);
        assert.equal(balance.toNumber() , 0, 'verif balance post sell teller1');
        let newbal = await web3.eth.getBalance(moderator);
        assert.equal(web3.fromWei(newbal).toNumber(), web3.fromWei(balancereceiverpre).toNumber() + 1, 'verif moderator has good receive his ETH');
        const profilePostSell = await dether.getTeller(user1address);
        console.log('profile ', profilePostSell);
        assert(web3.fromWei(profilePostSell[10].toNumber()), 1, 'verif sell volume')
        const profileTeller = await dether.getReput(user1address);
        console.log('getProfile ', profileTeller);
      })
    })
});
