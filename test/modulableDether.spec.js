
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

const shopToContract = (rawshop) => {
  const hexshopGeo = `0x31${toNBytes(rawshop.lat, 16)}${toNBytes(rawshop.lng, 16)}`;
  const hexShopAddr = `${toNBytes(rawshop.countryId, 2)}${toNBytes(rawshop.postalCode, 16)}`;
  const hexShopId = `${toNBytes(rawshop.cat, 16)}${toNBytes(rawshop.name, 16)}`;
  const hexShopDesc = `${toNBytes(rawshop.description, 32)}${toNBytes(rawshop.opening, 16)}31`;

  const hexShop = `${hexshopGeo}${hexShopAddr}${hexShopId}${hexShopDesc}`;
  return hexShop;
};

const tellerToContract = (rawteller) => {
  hexteller = `0x32${toNBytes(rawteller.lat, 16)}${toNBytes(rawteller.lng, 16)}${toNBytes(rawteller.countryId, 2)}${toNBytes(rawteller.postalCode, 16)}${toNBytes(rawteller.avatarId, 2)}${toNBytes(rawteller.currencyId, 2)}${toNBytes(rawteller.messengerAddr, 16)}${toNBytes(rawteller.rate, 16)}`
  return hexteller;
}

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

// use it to convert to int8 or int16 as well
function toBytesInt32 (num) {
    arr = new ArrayBuffer(4); // an Int32 takes 4 bytes
    view = new DataView(arr);
    view.setUint32(0, num, false); // byteOffset = 0; litteEndian = false
    return arr;
}

function toBytesInt32_2 (num) {
    arr = new Uint8Array([
         (num & 0xff000000) >> 24,
         (num & 0x00ff0000) >> 16,
         (num & 0x0000ff00) >> 8,
         (num & 0x000000ff)
    ]);
    return arr.buffer;
}

function buf2hex(buffer) { // buffer is an ArrayBuffer
  return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}

function hex_to_ascii(str1)
 {
	var hex  = str1.toString();
	var str = '';
	for (var n = 0; n < hex.length; n += 2) {
		str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
	}
	return str;
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

    it.only('shoudl test temp', async () => {
      console.log('tsx', await dether.dataToInt('0x0000000000000000000000000000000000000000000000000000000000003039'));
      console.log('int', (await dether.tempInt.call()).toNumber());
      const bufvalue = toBytesInt32(18000000);
      // console.log('value', value[0]);
      const hexvalue = buf2hex(bufvalue);
      // const buffer = new Uint8Array([ 4, 8, 12, 16 ]).buffer;
      console.log('typeof ',typeof bufvalue, typeof hexvalue); // = 04080c10
      console.log('vall => ',hex_to_ascii(buf2hex(bufvalue)));
      // const bytesEvent = dether.Log({}, { fromBlock: 0, toBlock: 'latest' });
      // bytesEvent.get((error, logs) => {
      //   logs.forEach(log => {
      //     console.log('event => ', log.args);
      //     // console.log(log.args.logs, web3.toAscii(log.args.data))
      //   })
      // });
    })

    it('should parse data and register and be on the map', async () => {

      const reg = "1" + shop1.lat + shop1.lng + shop1.countryId + shop1.postalCode + shop1.cat + shop1.name + shop1.description + shop1.opening;
      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
          overloadedTransferAbi,
          [
              dether.address,
              20,
              // web3.toHex(reg)
              shopToContract(shop1)
              // web3.toHex("test")
          ]
      );
      const tsx = await web3.eth.sendTransaction({from: user1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});
      // const bytesEvent = dether.LogBytes({}, { fromBlock: 0, toBlock: 'latest' });
      // bytesEvent.get((error, logs) => {
      //   logs.forEach(log => {
      //     console.log(log.args.logs, web3.toAscii(log.args.data))
      //   })
      // });

      let shop1value = await dether.getShop(user1address);
      assert.equal(await dether.isShop(user1address), true, 'assert shop is now online');
      // assert.equal(web3.toAscii(shop1value[0]), shop1.lat, 'verif lat');
      // assert.equal(web3.toAscii(shop1value[1]), shop1.lng, 'verif lng');
      // assert.equal(web3.toAscii(shop1value[2]), shop1.countryId, 'verif country id');
      // assert.equal(web3.toAscii(shop1value[3]), shop1.postalCode, 'verif postal code');
      // assert.equal(web3.toAscii(shop1value[4]), shop1.cat, 'verif lat');
      // assert.equal(web3.toAscii(shop1value[5]), shop1.name, 'verif lng');
      // assert.equal(web3.toAscii(shop1value[6]), shop1.description, 'verif country id');
      // assert.equal(web3.toAscii(shop1value[7]), shop1.opening, 'verif postal code');
    })

    it('should not be possible to add shop in unopened zone', async () => {
      await dether.closeZoneShop(web3.toHex(shop3.countryId),{from: cmo});

      const reg = "1" + shop3.lat + shop3.lng + shop3.countryId + shop3.postalCode + shop3.cat + shop3.name + shop3.description + shop3.opening;
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

      let shop3value = await dether.getShop(user3address);
      assert.equal(await dether.isShop(user3address), false, 'assert shop is now online');
      // assert.notEqual(shop3value[0].toNumber(), web3.toHex(shop3.lat), 'verif lat');
      // assert.notEqual(shop3value[1].toNumber(), web3.toHex(shop3.lng), 'verif lng');

    })

    it('should get all shop in a zone', async () => {

      zone = await dether.getZoneShop(shop1.countryId.hexEncode(), shop1.postalCode.hexEncode());
      assert.equal(zone, '', 'verif empty zone')

      const reg = "1" + shop1.lat + shop1.lng + shop1.countryId + shop1.postalCode + shop1.cat + shop1.name + shop1.description + shop1.opening;
      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
          overloadedTransferAbi,
          [
              dether.address,
              20,
              shopToContract(shop1)
              // web3.toHex("test")
          ]
      );
      const tsx = await web3.eth.sendTransaction({from: user1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});

      let transferMethodTransactionData2 = web3Abi.encodeFunctionCall(
          overloadedTransferAbi,
          [
              dether.address,
              20,
              shopToContract(shop7)
              // web3.toHex("test")
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
              // web3.toHex("test")
          ]
      );
      await web3.eth.sendTransaction({from: user1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});

      let transferMethodTransactionData2 = web3Abi.encodeFunctionCall(
          overloadedTransferAbi,
          [
              dether.address,
              20,
              shopToContract(shop2)
              // web3.toHex("test")
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

      const reg = "1" + shop1.lat + shop1.lng + shop1.countryId + shop1.postalCode + shop1.cat + shop1.name + shop1.description + shop1.opening;
      let transferMethodTransactionData = web3Abi.encodeFunctionCall(
          overloadedTransferAbi,
          [
              dether.address,
              20,
              shopToContract(shop1)
              // web3.toHex("test")
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
      const reg = "1" + shop1.lat + shop1.lng + shop1.countryId + shop1.postalCode + shop1.cat + shop1.name + shop1.description + shop1.opening;
      let transferMethodTransactionData = web3Abi.encodeFunctionCall(
          overloadedTransferAbi,
          [
              dether.address,
              20,
              shopToContract(shop1)
              // web3.toHex("test")
          ]
      );
      await web3.eth.sendTransaction({from: user1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});

      assert.equal(await dether.isShop(user1address), true, 'assert shop is now online');
      await dether.deleteShopMods(user1address, {from: moderator, gas:4000000});
      assert.equal(await dether.isShop(user1address), false, 'assert is shop');
    })

    it('should not be be able to delete a random shop if not moderator', async () => {
      assert.equal(await dether.isShop(user1address), false, 'assert is shop pref delete');
      const reg = "1" + shop1.lat + shop1.lng + shop1.countryId + shop1.postalCode + shop1.cat + shop1.name + shop1.description + shop1.opening;
      let transferMethodTransactionData = web3Abi.encodeFunctionCall(
          overloadedTransferAbi,
          [
              dether.address,
              20,
              shopToContract(shop1)
              // web3.toHex("test")
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
        // const bytesEvent = dether.LogBytes({}, { fromBlock: 0, toBlock: 'latest' });
        // bytesEvent.get((error, logs) => {
        //   logs.forEach(log => {
        //     console.log(log.args.logs, web3.toAscii(log.args.data))
        //   })
        // });


        let teller1value = await dether.getTeller(user1address);
        console.log('teller1value', teller1value);
        assert.equal(await dether.isTeller(user1address), true, 'assert shop is now online');
        assert.equal(web3.toAscii(teller1value[0]).replace(/\0/g,''), teller1.lat, 'verif lat');
        assert.equal(web3.toAscii(teller1value[1]).replace(/\0/g,''), teller1.lng, 'verif lng');
        assert.equal(web3.toAscii(teller1value[2]).replace(/\0/g,''), teller1.countryId, 'verif country id');
        assert.equal(web3.toAscii(teller1value[3]).replace(/\0/g,''), teller1.postalCode, 'verif postal code');
        assert.equal(web3.toAscii(teller1value[4]).replace(/\0/g,''), teller1.currencyId, 'verif currency');
        assert.equal(web3.toAscii(teller1value[5]).replace(/\0/g,''), teller1.messengerAddr, 'verif messenger');
        assert.equal(web3.toAscii(teller1value[6]).replace(/\0/g,''), teller1.avatarId, 'verif avatar');
        assert.equal(web3.toAscii(teller1value[7]).replace(/\0/g,''), teller1.rate, 'verif rate');
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
        // assert.notEqual(shop3value[0].toNumber(), web3.toHex(shop3.lat), 'verif lat');
        // assert.notEqual(shop3value[1].toNumber(), web3.toHex(shop3.lng), 'verif lng');

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
                // web3.toHex("test")
            ]
        );
        const tsx = await web3.eth.sendTransaction({from: user1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});

        let transferMethodTransactionData2 = web3Abi.encodeFunctionCall(
            overloadedTransferAbi,
            [
                dether.address,
                20,
                tellerToContract(teller2)
                // web3.toHex("test")
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
        zone = await dether.getZoneTeller(shop1.countryId.hexEncode(), shop1.postalCode.hexEncode());
        assert.equal(zone, '', 'verif empty zone');
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
                // web3.toHex("test")
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
                // web3.toHex("test")
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
        // register as shop
        let transferMethodTransactionData = web3Abi.encodeFunctionCall(
            overloadedTransferAbi,
            [
                dether.address,
                20,
                tellerToContract(teller1)
                // web3.toHex("test")
            ]
        );
        await web3.eth.sendTransaction({from: user1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});
        assert.equal(await dether.isTeller(user1address), true, 'assert is teller now online');
        // Add fund
        await dether.addFunds({from: user1address, value: web3.toWei(1, "ether")});
        assert.equal(web3.fromWei(await dether.getTellerBalance(user1address), 'ether'), 1, 'verif balance pre sell teller1');

        //sell ETH
        let tsx = await dether.sellEth(moderator, web3.toWei(1, 'ether'), {from: user1address});
        // console.log('tsx ', tsx);
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
                // web3.toHex("test")
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

    })



});
