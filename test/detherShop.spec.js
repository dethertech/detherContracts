
const {expectThrow, waitForMined} = require('./utils');
const {shop1, shop2, shop3} = require('./mock.json');
const DetherCore = artifacts.require('./DetherCore.sol');
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

let dether, smsCertifier, dthToken ;

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

    await dether.setLicenceShopPrice(10);
    await dether.setCertifier(smsCertifier.address);
    await dether.setDth(dthToken.address);
    await dether.setCMO(cmo);
    await dether.setModerator(moderator);

    await smsCertifier.addDelegate(certifier, 'test', {gas: 4000000, from: owner});
    await smsCertifier.certify(shop1address, {gas: 4000000, from: certifier});
    await smsCertifier.certify(shop2address, {gas: 4000000, from: certifier});
    await smsCertifier.certify(shop3address, {gas: 4000000, from: certifier});

    await dthToken.mint(owner, 1000);
    await dthToken.mint(shop1address, 1000);
    await dthToken.mint(shop2address, 1000);
    await dthToken.mint(shop3address, 1000);
    await dthToken.finishMinting();

    const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [
            dether.address,
            20,
            web3.toHex('test')
        ]
    );
    await web3.eth.sendTransaction({from: shop1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});
    await web3.eth.sendTransaction({from: shop2address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});
    await web3.eth.sendTransaction({from: shop3address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});

    await dether.openZoneShop(web3.toHex(shop1.countryId),{from: cmo});
  })

  contract('Add shop --', async () =>  {
    it('should register a shop and be on the map', async () => {
      // let tsx = await dether.addShop(...Object.values(shop1), {from: shop1address, gas:4000000});
      let tsx = await dether.addShop(
        shop1.lat
        , shop1.lng
        , web3.toHex(shop1.countryId)
        , web3.toHex(shop1.postalCode)
        , web3.toHex(shop1.cat)
        , web3.toHex(shop1.name)
        , web3.toHex(shop1.description)
        , web3.toHex(shop1.opening)
        , {from: shop1address, gas:4000000}
      );
      assert.equal(await dether.isShop(shop1address), true, 'assert shop is now online');
      let shop1value = await dether.getShop(shop1address);
      assert.equal(shop1value[0].toNumber(), shop1.lat, 'verif lat');
      assert.equal(shop1value[1].toNumber(), shop1.lng, 'verif lng');
      assert.equal(shop1value[2], web3.toHex(shop1.countryId), 'verif country id');
      // assert.equal(web3.toAscii(shop1value[3]), shop1.postalCode, 'verif postal code');
      // assert.equal(shop1value[4], web3.toHex(shop1.cat), 'verif lat');
      // assert.equal(shop1value[5], web3.toHex(shop1.name), 'verif lng');
      // assert.equal(shop1value[6], web3.toHex(shop1.description), 'verif country id');
      // assert.equal(shop1value[7], web3.toHex(shop1.opening), 'verif postal code');

    })

    it('should not be possible to add shop in unopened zone', async () => {
      // let tsx = await dether.addShop(...Object.values(shop1), {from: shop1address, gas:4000000});
      await dether.closeZoneShop(web3.toHex(shop3.countryId),{from: cmo});
      try {
        await dether.addShop(
          shop3.lat
          , shop3.lng
          , web3.toHex(shop3.countryId)
          , web3.toHex(shop3.postalCode)
          , web3.toHex(shop3.cat)
          , web3.toHex(shop3.name)
          , web3.toHex(shop3.description)
          , web3.toHex(shop3.opening)
          , {from: shop3address, gas:4000000}
        )
      } catch (err) {

      }
      let shop3value = await dether.getShop(shop3address);
      assert.notEqual(shop3value[0].toNumber(), shop3.lat, 'verif lat');
      assert.notEqual(shop3value[1].toNumber(), shop3.lng, 'verif lng');
      assert.notEqual(shop3value[2], web3.toHex(shop3.countryId), 'verif country id');

    })

    it('should get all tellers in a zone', async () => {

      let zone = await dether.getZone(web3.toHex(shop1.countryId), web3.toHex(shop1.postalCode));
      assert.equal(zone, '', 'verif empty zone')
      await dether.addShop(
        shop1.lat
        , shop1.lng
        , web3.toHex(shop1.countryId)
        , web3.toHex(shop1.postalCode)
        , web3.toHex(shop1.cat)
        , web3.toHex(shop1.name)
        , web3.toHex(shop1.description)
        , web3.toHex(shop1.opening)
        , {from: shop1address, gas:4000000}
      );
      await dether.addShop(
        shop2.lat
        , shop2.lng
        , web3.toHex(shop2.countryId)
        , web3.toHex(shop2.postalCode)
        , web3.toHex(shop2.cat)
        , web3.toHex(shop2.name)
        , web3.toHex(shop2.description)
        , web3.toHex(shop2.opening)
        , {from: shop2address, gas:4000000}
      );
      assert.equal(await dether.isShop(shop1address), true, 'assert shop is now online');
      zone = await dether.getZone(web3.toHex(shop1.countryId), web3.toHex(shop1.postalCode));
      assert.deepEqual(zone, [shop1address, shop2address], 'incorrect zone');

    })

    it('should have empty zone after delete', async () => {
      let zone = await dether.getZone(web3.toHex(shop1.countryId), web3.toHex(shop1.postalCode));
      assert.equal(zone, '', 'verif empty zone')
      await dether.addShop(
        shop1.lat
        , shop1.lng
        , web3.toHex(shop1.countryId)
        , web3.toHex(shop1.postalCode)
        , web3.toHex(shop1.cat)
        , web3.toHex(shop1.name)
        , web3.toHex(shop1.description)
        , web3.toHex(shop1.opening)
        , {from: shop1address, gas:4000000}
      );
      await dether.addShop(
        shop2.lat
        , shop2.lng
        , web3.toHex(shop2.countryId)
        , web3.toHex(shop2.postalCode)
        , web3.toHex(shop2.cat)
        , web3.toHex(shop2.name)
        , web3.toHex(shop2.description)
        , web3.toHex(shop2.opening)
        , {from: shop2address, gas:4000000}
      );
      assert.equal(await dether.isShop(shop1address), true, 'assert shop is now online');
      let tsx = await dether.deleteShop({from: shop2address, gas:4000000});
      await dether.deleteShop({from: shop1address, gas:4000000});
      zone = await dether.getZone(web3.toHex(shop1.countryId), web3.toHex(shop1.postalCode));
      assert.equal(zone, '', 'verif empty zone');
    })

    it('should have token back after delete', async () => {
      const baltoken = await dthToken.balanceOf(shop1address);
      const balstaked = await dether.getStakedShop(shop1address);
      await dether.addShop(
        shop1.lat
        , shop1.lng
        , web3.toHex(shop1.countryId)
        , web3.toHex(shop1.postalCode)
        , web3.toHex(shop1.cat)
        , web3.toHex(shop1.name)
        , web3.toHex(shop1.description)
        , web3.toHex(shop1.opening)
        , {from: shop1address, gas:4000000}
      );
      assert.equal(await dether.isShop(shop1address), true, 'assert shop is now online');
      await dether.deleteShop({from: shop1address, gas:4000000});
      const newbaltoken = await dthToken.balanceOf(shop1address);
      const newbalstaked = await dether.getStakedShop(shop1address);
      assert.equal(newbaltoken.toNumber(), baltoken.add(balstaked).toNumber(), 'verif balance token');
      assert.equal(newbalstaked.toNumber(), 0, 'verif balance token');
    })

    it('should be able to delete a random shop as a moderator', async () => {
      await dether.addShop(
        shop1.lat
        , shop1.lng
        , web3.toHex(shop1.countryId)
        , web3.toHex(shop1.postalCode)
        , web3.toHex(shop1.cat)
        , web3.toHex(shop1.name)
        , web3.toHex(shop1.description)
        , web3.toHex(shop1.opening)
        , {from: shop1address, gas:4000000}
      );
      assert.equal(await dether.isShop(shop1address), true, 'assert shop is now online');
      await dether.deleteShopMods(shop1address, {from: moderator, gas:4000000});
      assert.equal(await dether.isShop(shop1address), false, 'assert is shop');
    })

    it('should not be be able to delete a random shop if not moderator', async () => {
      assert.equal(await dether.isShop(shop1address), false, 'assert is shop pref delete');
      await dether.addShop(
        shop1.lat
        , shop1.lng
        , web3.toHex(shop1.countryId)
        , web3.toHex(shop1.postalCode)
        , web3.toHex(shop1.cat)
        , web3.toHex(shop1.name)
        , web3.toHex(shop1.description)
        , web3.toHex(shop1.opening)
        , {from: shop1address, gas:4000000}
      );
      assert.equal(await dether.isShop(shop1address), true, 'assert is shop now online');
      try {
          await dether.deleteShopMods(shop1address, {from: cmo, gas:4000000});
      } catch(err) {

      }
      assert.equal(await dether.isShop(shop1address), true, 'assert is shop still online');
    })

  })

});
