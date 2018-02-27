/* global contract it artifacts web3 assert */
const {expectThrow, waitForMined} = require('./utils');
const {teller1, teller2, teller3} = require('./mock.json');
const DetherInterfaceAbs = artifacts.require('./DetherInterface.sol');
const DetherStorageAbs = artifacts.require('./DetherTellerStorage.sol');
const SmsCertifierAbs = artifacts.require('./certifier/SmsCertifier.sol');
const DthAbs = artifacts.require('./token/DetherToken.sol');
const DthRegistryAbs = artifacts.require('./DthRegistry.sol');

// fix to solve truffle pblm with overloading
const web3Abi = require('web3-eth-abi');
const web3 = DthAbs.web3;
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

let dether, detherStorage, smsCertifier, dthToken, dthRegistry ;

const
  [
      owner
    , teller1address
    , teller2address
    , teller3address
    , user1
    , user2
    , certifier
  ] = web3.eth.accounts;

const convertTypes = x => {
  if (typeof x === 'string') return web3.toUtf8(x)
  else if (x.constructor.name === 'BigNumber') return x.toNumber()
  else return x
}

contract('Dether Interface', async () => {
  beforeEach( async () => {
    detherStorage = await DetherStorageAbs.new({gas: 4000000, from: owner});
    smsCertifier = await SmsCertifierAbs.new({gas: 4000000, from: owner});
    dthToken = await DthAbs.new({gas: 4000000, from: owner});
    dthRegistry = await DthRegistryAbs.new(dthToken.address, {gas: 4000000, from: owner});
    dether = await DetherInterfaceAbs.new(detherStorage.address, smsCertifier.address, dthRegistry.address  ,{gas: 4000000, from: owner});
    await dthRegistry.transferOwnership(dether.address, {gas: 4000000, from: owner});
    await detherStorage.transferOwnership(dether.address, {gas: 4000000, from: owner});
    await dether.addDth(dthToken.address);
    await smsCertifier.addDelegate(certifier, 'test', {gas: 4000000, from: owner});
    await smsCertifier.certify(teller1address, {gas: 4000000, from: certifier});
    await smsCertifier.certify(teller2address, {gas: 4000000, from: certifier});
    await smsCertifier.certify(teller3address, {gas: 4000000, from: certifier});

    await dthToken.mint(owner, 1000);
    await dthToken.mint(teller1address, 1000);
    await dthToken.mint(teller2address, 1000);
    await dthToken.mint(teller3address, 1000);
    await dthToken.finishMinting();

    const transferMethodTransactionData = web3Abi.encodeFunctionCall(
        overloadedTransferAbi,
        [
            dether.address,
            20,
            web3.toHex('test')
        ]
    );
    await web3.eth.sendTransaction({from: teller1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});
    await web3.eth.sendTransaction({from: teller2address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});
    await web3.eth.sendTransaction({from: teller3address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});

  })

  contract('Registration --', async () =>  {

    it('should register a teller and be on the map', async () => {



      let tsx = await dether.registerTeller(...Object.values(teller1), {from: teller1address, gas:4000000, value: web3.toWei(1, 'ether')});
console.log(tsx);
      // let pos1 = await detherStorage.getTellerPositionRaw(teller1address);
      //
      // assert.equal(pos1[0].toNumber(), teller1.lat, 'verif lat');
      // assert.equal(pos1[1].toNumber(), teller1.lng, 'verif lng');
      // assert.equal(pos1[2], teller1.countryCode, 'verif country code');
      // assert.equal(pos1[3].toNumber(), teller1.postalCode, 'verif postal code');
      // let profile1 = await detherStorage.getTellerProfile1(teller1address);
      // let profile2 = await detherStorage.getTellerProfile2(teller1address);
      // assert.equal(profile1[0].toNumber(), teller1.avatarId, 'verif avatar');
      // assert.equal(profile1[1].toNumber(), teller1.currencyId, 'verif currency');
      // assert.equal(profile1[2], teller1.messengerAddr, 'verif mess');
      // assert.equal(profile1[3], teller1.messengerAddr2, 'verif mess 2');
      // assert.equal(profile2[0].toNumber(), teller1.rate, 'verif rates');
      // assert.equal(profile2[1].toNumber(), 0, 'verif volume sell');
      // assert.equal(profile2[2].toNumber(), 0, 'verif volume buy');
      // assert.equal(profile2[3].toNumber(), 0, 'verif nbr trade');
      // assert.equal(profile2[4].toNumber(), web3.toWei(1, 'ether'), 'verif balance');
      //
      // tsx = await dether.registerTeller(...Object.values(teller2), {from: teller2address, gas:4000000, value: web3.toWei(1, 'ether')});
      // pos1 = await detherStorage.getTellerPositionRaw(teller2address);
      // assert.equal(pos1[0].toNumber(), teller2.lat, 'verif lat');
      // assert.equal(pos1[1].toNumber(), teller2.lng, 'verif lng');
      // assert.equal(pos1[2], teller2.countryCode, 'verif country code');
      // assert.equal(pos1[3].toNumber(), teller2.postalCode, 'verif postal code');
      // profile1 = await detherStorage.getTellerProfile1(teller2address);
      // profile2 = await detherStorage.getTellerProfile2(teller2address);
      // assert.equal(profile1[0].toNumber(), teller2.avatarId, 'verif avatar');
      // assert.equal(profile1[1].toNumber(), teller2.currencyId, 'verif currency');
      // assert.equal(profile1[2], teller2.messengerAddr, 'verif mess');
      // assert.equal(profile1[3], teller2.messengerAddr2, 'verif mess 2');
      // assert.equal(profile2[0].toNumber(), teller2.rate, 'verif rates');
      // assert.equal(profile2[1].toNumber(), 0, 'verif volume sell');
      // assert.equal(profile2[2].toNumber(), 0, 'verif volume buy');
      // assert.equal(profile2[3].toNumber(), 0, 'verif nbr trade');
      // assert.equal(profile2[4].toNumber(), web3.toWei(1, 'ether'), 'verif balance');

    })

    it('should get all tellers in a zone', async () => {
      await dether.registerTeller(...Object.values(teller1), {from: teller1address, gas:4000000, value: web3.toWei(1, 'ether')});
      await dether.registerTeller(...Object.values(teller2), {from: teller2address, gas:4000000, value: web3.toWei(1, 'ether')});
      await dether.registerTeller(...Object.values(teller3), {from: teller3address, gas:4000000, value: web3.toWei(1, 'ether')});
      const zone = await detherStorage.getZone(teller1.countryCode, teller1.postalCode);
      assert.deepEqual(zone, [teller1address, teller2address, teller3address], 'incorrect zone');
    })

    it('should have empty zone', async () => {
      await dether.registerTeller(...Object.values(teller1), {from: teller1address, gas:4000000, value: web3.toWei(1, 'ether')});
      let zone = await detherStorage.getZone(teller1.countryCode, 6578);
      assert.equal(zone, '', 'verif empty zone')
      // assert online
      zone = await detherStorage.getZone(teller1.countryCode, teller1.postalCode);
      assert.deepEqual(zone, [teller1address], 'verif zone')
    })

    it('should be delete from the zone and from the global teller', async () => {
      await dether.registerTeller(...Object.values(teller1), {from: teller1address, gas:4000000, value: web3.toWei(1, 'ether')});
      await dether.registerTeller(...Object.values(teller2), {from: teller2address, gas:4000000, value: web3.toWei(1, 'ether')});
      await dether.registerTeller(...Object.values(teller3), {from: teller3address, gas:4000000, value: web3.toWei(1, 'ether')});
      // assert online
      let zone = await detherStorage.getZone(teller1.countryCode, teller1.postalCode);
      assert.deepEqual(zone, [teller1address, teller2address,teller3address], 'incorrect zone');
      let onlineTeller1 = await detherStorage.isOnline(teller1address);
      const onlinetest = await detherStorage.isOnline(user1);
      assert.equal(onlineTeller1, true, 'assert online');
      assert.equal(onlinetest, false, 'assert offline');

      // assert offline, no more in the zone, but still a registered teller
      let tsx = await dether.switchTellerOffline({from: teller1address, gas:4000000});
      onlineTeller1 = await detherStorage.isOnline(teller1address);
      assert.equal(onlineTeller1, false, 'assert online');

      // should not be present in the zone array

      zone = await detherStorage.getZone(teller1.countryCode, teller1.postalCode);
      zone.map((teller) => {
        assert.notEqual(teller1address, teller, 'assert not present in zone');
      })
      // assert still exist
      let verif = await detherStorage.isTeller(teller1address);
      assert.equal(verif, true, 'verif still registered');

      let balanceRegistry = await dthToken.balanceOf.call(dthRegistry.address);
      assert.equal(await dthRegistry.getStaked.call(teller1address) , 20, 'verif staked')
      assert.equal(await dthToken.balanceOf.call(teller1address) , 980, 'verif staked')
      assert.equal(await dthToken.balanceOf.call(teller1address) , 980, 'verif staked')
      await dether.registerTeller(...Object.values(teller1), {from: teller1address, gas:4000000, value: web3.toWei(1, 'ether')});
      tsx = await dether.deleteMyProfile({from: teller1address, gas:4000000});
      verif = await detherStorage.isOnline(teller1address);
      assert.equal(verif , false, 'verif offline')
      verif = await detherStorage.isTeller(teller1address)
      assert.equal(verif, false, 'verif unvisible');
      assert.equal(await dthRegistry.getStaked.call(teller1address) , 0, 'verif staked');
      assert.equal(await dthToken.balanceOf.call(teller1address) , 1000, 'verif staked');
      assert.equal(await dthToken.balanceOf.call(dthRegistry.address), balanceRegistry - 20, 'verif staked');

    })

    it('should send from teller', async () => {
      await dether.registerTeller(...Object.values(teller1), {from: teller1address, gas:4000000, value: web3.toWei(0.5, 'ether')});
      await dether.registerTeller(...Object.values(teller2), {from: teller2address, gas:4000000, value: web3.toWei(0.5, 'ether')});
      // assert balance = 0
      let teller1Bal = await detherStorage.getTellerBalance(teller1address);
      let user1Bal = await web3.eth.getBalance(user1);
      assert.equal(web3.fromWei(teller1Bal.toNumber(), 'ether'), 0.5, 'verif balance teller1');
      assert.equal(web3.fromWei(user1Bal.toNumber(), 'ether'), 100, 'verif balance user1');

      await dether.sendCoin(user1, web3.toWei(0.5, 'ether'), {from: teller1address, gas:4000000});
      teller1Bal = await detherStorage.getTellerBalance(teller1address);
      user1Bal = await web3.eth.getBalance(user1);
      assert.equal(teller1Bal.toNumber(), 0, 'verif balance teller1 post send');
      assert.equal( web3.fromWei(user1Bal.toNumber(), 'ether') , 100.5, 'verif balance user1 post send');
      // assert reputation

    })

    it('should update a profile', async () => {
      await dether.registerTeller(...Object.values(teller1), {from: teller1address, gas:4000000, value: web3.toWei(1, 'ether')});
      assert.equal(await detherStorage.isOnline(teller1address), true, 'assert online');
      let pos1 = await detherStorage.getTellerPositionRaw(teller1address);
      assert.equal(pos1[0].toNumber(), teller1.lat, 'verif lat');
      assert.equal(pos1[1].toNumber(), teller1.lng, 'verif lng');
      assert.equal(pos1[2], teller1.countryCode, 'verif country code');
      assert.equal(pos1[3].toNumber(), teller1.postalCode, 'verif postal code');
      let zone = await detherStorage.getZone(teller1.countryCode, teller1.postalCode);
      assert.deepEqual(zone, [teller1address], 'verif zone zone');

      teller1Bal = await detherStorage.getTellerBalance(teller1address);
      assert.equal(web3.fromWei(teller1Bal.toNumber(), 'ether'), 1, 'verif balance teller1 post send');
      let tsx = await dether.updatePosition(1232123,1323342,"US",34278, {from: teller1address, gas:4000000, value: web3.toWei(1.5, 'ether')});
      teller1Bal = await detherStorage.getTellerBalance(teller1address);
      assert.equal(web3.fromWei(teller1Bal.toNumber(), 'ether'), 2.5, 'verif balance teller1 post send');
      pos1 = await detherStorage.getTellerPositionRaw(teller1address);
      assert.equal(pos1[0].toNumber(), 1232123, 'verif lat');
      assert.equal(pos1[1].toNumber(), 1323342, 'verif lng');
      assert.equal(pos1[2], "US", 'verif country code');
      assert.equal(pos1[3].toNumber(), 34278, 'verif postal code');
      //should be on the new zone
      zone = await detherStorage.getZone("US", 34278);
      assert.deepEqual(zone, [teller1address], 'incorrect zone after update');
      zone = await detherStorage.getZone(teller1.countryCode, teller1.postalCode);
      assert.deepEqual(zone, [], 'FR should be empty');
    })

  })

  contract('Reputation --', async () => {
    it.skip('should be able to comment after sell', async () => {
      // const teller4 = Object.assign({}, teller1, {zoneId: 17, name: 'teller4'});
      // await dether.registerPoint(...Object.values(teller1), {from: teller1address, value: web3.toWei(1, 'ether'), gas: 400000});
      // await dether.registerPoint(...Object.values(teller2), {from: teller2address, value: web3.toWei(1, 'ether'), gas: 400000});
      // await dether.registerPoint(...Object.values(teller3), {from: teller3address, value: web3.toWei(1, 'ether'), gas: 400000});
      // await dether.registerPoint(...Object.values(teller4), {from: account1, value: web3.toWei(1, 'ether'), gas: 400000});
      //
      // const tellers42 = await detherStorage.getZone(42);
      // const teller17 = await detherStorage.getZone(17);
      // assert.deepEqual(tellers42, [teller1address, teller2address, teller3address], 'incorrect zone');
      // assert.deepEqual(teller17, [account1], 'incorrect zone');
    })

    it.skip('should be able to comment after buy', async () => {
      // const teller4 = Object.assign({}, teller1, {zoneId: 17, name: 'teller4'});
      // await dether.registerPoint(...Object.values(teller1), {from: teller1address, value: web3.toWei(1, 'ether'), gas: 400000});
      // await dether.registerPoint(...Object.values(teller2), {from: teller2address, value: web3.toWei(1, 'ether'), gas: 400000});
      // await dether.registerPoint(...Object.values(teller3), {from: teller3address, value: web3.toWei(1, 'ether'), gas: 400000});
      // await dether.registerPoint(...Object.values(teller4), {from: account1, value: web3.toWei(1, 'ether'), gas: 400000});
      //
      // const tellers42 = await detherStorage.getZone(42);
      // const teller17 = await detherStorage.getZone(17);
      // assert.deepEqual(tellers42, [teller1address, teller2address, teller3address], 'incorrect zone');
      // assert.deepEqual(teller17, [account1], 'incorrect zone');
    })

    it.skip('should be unable to comment', async () => {
      // const teller4 = Object.assign({}, teller1, {zoneId: 17, name: 'teller4'});
      // await dether.registerPoint(...Object.values(teller1), {from: teller1address, value: web3.toWei(1, 'ether'), gas: 400000});
      // await dether.registerPoint(...Object.values(teller2), {from: teller2address, value: web3.toWei(1, 'ether'), gas: 400000});
      // await dether.registerPoint(...Object.values(teller3), {from: teller3address, value: web3.toWei(1, 'ether'), gas: 400000});
      // await dether.registerPoint(...Object.values(teller4), {from: account1, value: web3.toWei(1, 'ether'), gas: 400000});
      //
      // const tellers42 = await detherStorage.getZone(42);
      // const teller17 = await detherStorage.getZone(17);
      // assert.deepEqual(tellers42, [teller1address, teller2address, teller3address], 'incorrect zone');
      // assert.deepEqual(teller17, [account1], 'incorrect zone');
    })

    it.skip('should have comment on his profile', async () => {
      // const teller4 = Object.assign({}, teller1, {zoneId: 17, name: 'teller4'});
      // await dether.registerPoint(...Object.values(teller1), {from: teller1address, value: web3.toWei(1, 'ether'), gas: 400000});
      // await dether.registerPoint(...Object.values(teller2), {from: teller2address, value: web3.toWei(1, 'ether'), gas: 400000});
      // await dether.registerPoint(...Object.values(teller3), {from: teller3address, value: web3.toWei(1, 'ether'), gas: 400000});
      // await dether.registerPoint(...Object.values(teller4), {from: account1, value: web3.toWei(1, 'ether'), gas: 400000});
      //
      // const tellers42 = await detherStorage.getZone(42);
      // const teller17 = await detherStorage.getZone(17);
      // assert.deepEqual(tellers42, [teller1address, teller2address, teller3address], 'incorrect zone');
      // assert.deepEqual(teller17, [account1], 'incorrect zone');
    })
  })

  contract('Import teller --', async () => {
    it.skip('should be able to import teller', async () => {
      // const teller4 = Object.assign({}, teller1, {zoneId: 17, name: 'teller4'});
      // await dether.registerPoint(...Object.values(teller1), {from: teller1address, value: web3.toWei(1, 'ether'), gas: 400000});
      // await dether.registerPoint(...Object.values(teller2), {from: teller2address, value: web3.toWei(1, 'ether'), gas: 400000});
      // await dether.registerPoint(...Object.values(teller3), {from: teller3address, value: web3.toWei(1, 'ether'), gas: 400000});
      // await dether.registerPoint(...Object.values(teller4), {from: account1, value: web3.toWei(1, 'ether'), gas: 400000});
      //
      // const tellers42 = await detherStorage.getZone(42);
      // const teller17 = await detherStorage.getZone(17);
      // assert.deepEqual(tellers42, [teller1address, teller2address, teller3address], 'incorrect zone');
      // assert.deepEqual(teller17, [account1], 'incorrect zone');
    })
  })

  contract('Staking DTH --', async () => {
    it.skip('should be able to stake DTH', async () => {
      // const teller4 = Object.assign({}, teller1, {zoneId: 17, name: 'teller4'});
      // await dether.registerPoint(...Object.values(teller1), {from: teller1address, value: web3.toWei(1, 'ether'), gas: 400000});
      // await dether.registerPoint(...Object.values(teller2), {from: teller2address, value: web3.toWei(1, 'ether'), gas: 400000});
      // await dether.registerPoint(...Object.values(teller3), {from: teller3address, value: web3.toWei(1, 'ether'), gas: 400000});
      // await dether.registerPoint(...Object.values(teller4), {from: account1, value: web3.toWei(1, 'ether'), gas: 400000});
      //
      // const tellers42 = await detherStorage.getZone(42);
      // const teller17 = await detherStorage.getZone(17);
      // assert.deepEqual(tellers42, [teller1address, teller2address, teller3address], 'incorrect zone');
      // assert.deepEqual(teller17, [account1], 'incorrect zone');
    })
  })

})
