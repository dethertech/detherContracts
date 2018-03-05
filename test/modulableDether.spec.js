
const {expectThrow, waitForMined} = require('./utils');
const {shop1, shop2, shop3} = require('./mock.json');
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

const
  [
      owner
    , shop1address
    , shop2address
    , shop3address
    , moderator
    , cmo
    , certifier
  ] = web3.eth.accounts;

const convertTypes = x => {
  if (typeof x === 'string') return web3.toUtf8(x)
  else if (x.constructor.name === 'BigNumber') return x.toNumber()
  else return x
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
    await detherBank.setDth(dthToken.address);

    await smsCertifier.addDelegate(certifier, 'test', {gas: 4000000, from: owner});
    await smsCertifier.certify(shop1address, {gas: 4000000, from: certifier});
    await smsCertifier.certify(shop2address, {gas: 4000000, from: certifier});
    await smsCertifier.certify(shop3address, {gas: 4000000, from: certifier});

    await dthToken.mint(owner, 1000);
    await dthToken.mint(shop1address, 1000);
    await dthToken.mint(shop2address, 1000);
    await dthToken.mint(shop3address, 1000);
    await dthToken.finishMinting();

    await dether.openZoneShop(web3.toHex(shop1.countryId),{from: cmo});
    await dether.openZoneShop(web3.toHex(shop2.countryId),{from: cmo});
    await dether.openZoneShop(web3.toHex(shop3.countryId),{from: cmo});
  })

  contract('Add shop --', async () =>  {

    it('should parse data and register and be on the map', async () => {

      const reg = "1" + shop1.lat + shop1.lng + shop1.countryId + shop1.postalCode + shop1.cat + shop1.name + shop1.description + shop1.opening;
      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
          overloadedTransferAbi,
          [
              dether.address,
              20,
              web3.toHex(reg)
              // web3.toHex("test")
          ]
      );
      const tsx = await web3.eth.sendTransaction({from: shop1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});
      console.log('tsx gas cost', (await web3.eth.getTransactionReceipt(tsx)).gasUsed);
      // const bytesEvent = dether.LogBytes({}, { fromBlock: 0, toBlock: 'latest' });
      // bytesEvent.get((error, logs) => {
      //   logs.forEach(log => {
      //     console.log(log.args.logs, web3.toAscii(log.args.data))
      //   })
      // });

      let shop1value = await dether.getShop(shop1address);
      assert.equal(await dether.isShop(shop1address), true, 'assert shop is now online');
      assert.equal(web3.toAscii(shop1value[0]), shop1.lat, 'verif lat');
      assert.equal(web3.toAscii(shop1value[1]), shop1.lng, 'verif lng');
      assert.equal(web3.toAscii(shop1value[2]), shop1.countryId, 'verif country id');
      assert.equal(web3.toAscii(shop1value[3]), shop1.postalCode, 'verif postal code');
      assert.equal(web3.toAscii(shop1value[4]), shop1.cat, 'verif lat');
      assert.equal(web3.toAscii(shop1value[5]), shop1.name, 'verif lng');
      assert.equal(web3.toAscii(shop1value[6]), shop1.description, 'verif country id');
      assert.equal(web3.toAscii(shop1value[7]), shop1.opening, 'verif postal code');
    })

    it('should not be possible to add shop in unopened zone', async () => {
      await dether.closeZoneShop(web3.toHex(shop3.countryId),{from: cmo});

      const reg = "1" + shop3.lat + shop3.lng + shop3.countryId + shop3.postalCode + shop3.cat + shop3.name + shop3.description + shop3.opening;
      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
          overloadedTransferAbi,
          [
              dether.address,
              20,
              web3.toHex(reg)
              // web3.toHex("test")
          ]
      );
      try {
        const tsx = await web3.eth.sendTransaction({from: shop3address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});
      } catch (err) {

      }

      let shop3value = await dether.getShop(shop3address);
      assert.equal(await dether.isShop(shop3address), false, 'assert shop is now online');
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
              web3.toHex(reg)
              // web3.toHex("test")
          ]
      );
      const tsx = await web3.eth.sendTransaction({from: shop1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});
      console.log('tsx gas cost', (await web3.eth.getTransactionReceipt(tsx)).gasUsed);


      const reg2 = "1" + shop2.lat + shop2.lng + shop2.countryId + shop2.postalCode + shop2.cat + shop2.name + shop2.description + shop2.opening;
      let transferMethodTransactionData2 = web3Abi.encodeFunctionCall(
          overloadedTransferAbi,
          [
              dether.address,
              20,
              web3.toHex(reg2)
              // web3.toHex("test")
          ]
      );
      await web3.eth.sendTransaction({from: shop2address, to: dthToken.address, data: transferMethodTransactionData2, value: 0, gas: 5700000});

      zone = await dether.getZoneShop(shop1.countryId.hexEncode(), shop1.postalCode.hexEncode());
      assert.deepEqual(zone, [shop1address, shop2address], 'incorrect zone');
    })

    it('should have empty zone after delete', async () => {
      let zone = await dether.getZoneShop(web3.toHex(shop1.countryId), web3.toHex(shop1.postalCode));
      assert.equal(zone, '', 'verif empty zone');

      const reg = "1" + shop1.lat + shop1.lng + shop1.countryId + shop1.postalCode + shop1.cat + shop1.name + shop1.description + shop1.opening;
      let transferMethodTransactionData = web3Abi.encodeFunctionCall(
          overloadedTransferAbi,
          [
              dether.address,
              20,
              web3.toHex(reg)
              // web3.toHex("test")
          ]
      );
      await web3.eth.sendTransaction({from: shop1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});

      const reg2 = "1" + shop2.lat + shop2.lng + shop2.countryId + shop2.postalCode + shop2.cat + shop2.name + shop2.description + shop2.opening;
      let transferMethodTransactionData2 = web3Abi.encodeFunctionCall(
          overloadedTransferAbi,
          [
              dether.address,
              20,
              web3.toHex(reg2)
              // web3.toHex("test")
          ]
      );
      await web3.eth.sendTransaction({from: shop2address, to: dthToken.address, data: transferMethodTransactionData2, value: 0, gas: 5700000});
      assert.equal(await dether.isShop(shop1address), true, 'assert shop is now online');
      let tsx = await dether.deleteShop({from: shop2address, gas:4000000});
      await dether.deleteShop({from: shop1address, gas:4000000});
      zone = await dether.getZoneShop(shop1.countryId.hexEncode(), shop1.postalCode.hexEncode());
      assert.equal(zone, '', 'verif empty zone');
    })

    it('should have token back after delete', async () => {
      const baltoken = await dthToken.balanceOf(shop1address);
      const balstaked = await dether.getStakedShop(shop1address);
      let zone = await dether.getZoneShop(web3.toHex(shop1.countryId), web3.toHex(shop1.postalCode));
      assert.equal(zone, '', 'verif empty zone')

      const reg = "1" + shop1.lat + shop1.lng + shop1.countryId + shop1.postalCode + shop1.cat + shop1.name + shop1.description + shop1.opening;
      let transferMethodTransactionData = web3Abi.encodeFunctionCall(
          overloadedTransferAbi,
          [
              dether.address,
              20,
              web3.toHex(reg)
              // web3.toHex("test")
          ]
      );
      await web3.eth.sendTransaction({from: shop1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});

      assert.equal(await dether.isShop(shop1address), true, 'assert shop is now online');
      await dether.deleteShop({from: shop1address, gas:4000000});
      const newbaltoken = await dthToken.balanceOf(shop1address);
      const newbalstaked = await dether.getStakedShop(shop1address);
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
              web3.toHex(reg)
              // web3.toHex("test")
          ]
      );
      await web3.eth.sendTransaction({from: shop1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});

      assert.equal(await dether.isShop(shop1address), true, 'assert shop is now online');
      await dether.deleteShopMods(shop1address, {from: moderator, gas:4000000});
      assert.equal(await dether.isShop(shop1address), false, 'assert is shop');
    })

    it('should not be be able to delete a random shop if not moderator', async () => {
      assert.equal(await dether.isShop(shop1address), false, 'assert is shop pref delete');
      const reg = "1" + shop1.lat + shop1.lng + shop1.countryId + shop1.postalCode + shop1.cat + shop1.name + shop1.description + shop1.opening;
      let transferMethodTransactionData = web3Abi.encodeFunctionCall(
          overloadedTransferAbi,
          [
              dether.address,
              20,
              web3.toHex(reg)
              // web3.toHex("test")
          ]
      );
      await web3.eth.sendTransaction({from: shop1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});

      assert.equal(await dether.isShop(shop1address), true, 'assert is shop now online');
      try {
          await dether.deleteShopMods(shop1address, {from: cmo, gas:4000000});
      } catch(err) {

      }
      assert.equal(await dether.isShop(shop1address), true, 'assert is shop still online');
    })

  })

});
