/* global contract it artifacts web3 assert */
const {expectThrow, waitForMined} = require('./utils');
const {teller1, teller2, teller3} = require('./mock.json');
const DetherInterfaceAbs = artifacts.require('./DetherInterface.sol');
const DetherStorageAbs = artifacts.require('./DetherTellerStorage.sol');
let dether, detherStorage;

const
  [
      owner
    , teller1address
    , teller2address
    , teller3address
    , user1
    , user2
  ] = web3.eth.accounts;
        console.log('test ');
const convertTypes = x => {
  if (typeof x === 'string') return web3.toUtf8(x)
  else if (x.constructor.name === 'BigNumber') return x.toNumber()
  else return x
}

contract('Dether Interface', () => {
  beforeEach(async () => {
    console.log('Before each');
    detherStorage = await DetherStorageAbs.new({gas: 4000000, from: owner})
    dether = await DetherInterfaceAbs.new(detherStorage.address, {gas: 4000000, from: owner});
    await detherStorage.transferOwnership(dether.address, {gas: 4000000, from: owner});
  })


  contract('Registration --', () => {

    it('should register a teller and be on the map', async () => {
      await dether.registerTeller(...Object.values(teller1), {from: teller1address, gas:4000000, value: web3.toWei(1, 'ether')});
      const pos1 = await dether.getTellerPos(teller1address);
      assert.equal(pos1[0].toNumber(), teller1.lat, 'verif lat');
      assert.equal(pos1[1].toNumber(), teller1.lng, 'verif lng');
      assert.equal(web3.toUtf8(pos1[2]), teller1.countryCode, 'verif country code');
      assert.equal(pos1[3].toNumber(), teller1.postalCode, 'verif postal code');
      const profile = await dether.getTellerProfile(teller1address);
      assert.equal(profile[0].toNumber(), teller1.avatarId, 'verif avatar');
      assert.equal(profile[1].toNumber(), teller1.currencyId, 'verif currency');
      assert.equal(web3.toUtf8(profile[2]), teller1.messengerAddr, 'verif mess');
      assert.equal(web3.toUtf8(profile[3]), teller1.messengerAddr2, 'verif mess 2');
      assert.equal(profile[4].toNumber(), teller1.rate, 'verif rates');
      assert.equal(profile[5].toNumber(), 0, 'verif volume sell');
      assert.equal(profile[6].toNumber(), 0, 'verif volume buy');
      assert.equal(profile[7].toNumber(), 0, 'verif nbr trade');
      assert.equal(profile[8].toNumber(), web3.toWei(1, 'ether'), 'verif balance');
      // console.log('index -> ', await detherStorage.getGeneralIndex(teller1address));

      await dether.registerTeller(...Object.values(teller2), {from: teller2address, gas:4000000, value: web3.toWei(1, 'ether')});
      const pos2 = await dether.getTellerPos(teller2address);
      assert.equal(pos2[0].toNumber(), teller2.lat, 'verif lat');
      assert.equal(pos2[1].toNumber(), teller2.lng, 'verif lng');
      assert.equal(web3.toUtf8(pos2[2]), teller2.countryCode, 'verif country code');
      assert.equal(pos2[3].toNumber(), teller2.postalCode, 'verif postal code');
      const profile2 = await dether.getTellerProfile(teller2address);
      assert.equal(profile2[0].toNumber(), teller2.avatarId, 'verif avatar');
      assert.equal(profile2[1].toNumber(), teller2.currencyId, 'verif currency');
      assert.equal(web3.toUtf8(profile2[2]), teller2.messengerAddr, 'verif mess');
      assert.equal(web3.toUtf8(profile2[3]), teller2.messengerAddr2, 'verif mess 2');
      assert.equal(profile2[4].toNumber(), teller2.rate, 'verif rates');
      assert.equal(profile2[5].toNumber(), 0, 'verif volume sell');
      assert.equal(profile2[6].toNumber(), 0, 'verif volume buy');
      assert.equal(profile2[7].toNumber(), 0, 'verif nbr trade');
      assert.equal(profile2[8].toNumber(), web3.toWei(1, 'ether'), 'verif balance');
      // console.log('index -> ', await detherStorage.getGeneralIndex(teller2address));
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
      let onlineTeller1 = await dether.isTellerOnline(teller1address);
      const onlinetest = await dether.isTellerOnline(user1);
      assert.equal(onlineTeller1, true, 'assert online');
      assert.equal(onlinetest, false, 'assert offline');

      // assert offline, no more in the zone, but still a registered teller
      let tsx = await dether.switchTellerOffline({from: teller1address, gas:4000000});
      onlineTeller1 = await dether.isTellerOnline(teller1address);
      assert.equal(onlineTeller1, false, 'assert online');

      // should not be present in the zone array

      zone = await detherStorage.getZone(teller1.countryCode, teller1.postalCode);
      zone.map((teller) => {
        assert.notEqual(teller1address, teller, 'assert not present in zone');
      })
      // assert still exist
      let verif = await dether.isRegistered(teller1address);
      assert.equal(verif, true, 'verif still registered');

      // assert delete, no more in the zone and no more registered teller
      await dether.registerTeller(...Object.values(teller1), {from: teller1address, gas:4000000, value: web3.toWei(1, 'ether')});
      tsx = await dether.deleteMyProfile({from: teller1address, gas:4000000});
      verif = await dether.isTellerOnline(teller1address);
      assert.equal(verif , false, 'verif offline')
      verif = await dether.isRegistered(teller1address)
      assert.equal(verif, false, 'verif unvisible');
    })

    it('should update a profile', async () => {
      await dether.registerTeller(...Object.values(teller1), {from: teller1address, gas:4000000, value: web3.toWei(1, 'ether')});
      assert.equal(await dether.isTellerOnline(teller1address), true, 'assert online');
      const pos1 = await dether.getTellerPos(teller1address);
      assert.equal(pos1[0].toNumber(), teller1.lat, 'verif lat');
      assert.equal(pos1[1].toNumber(), teller1.lng, 'verif lng');
      assert.equal(web3.toUtf8(pos1[2]), teller1.countryCode, 'verif country code');
      assert.equal(pos1[3].toNumber(), teller1.postalCode, 'verif postal code');
      const zone = await detherStorage.getZone(teller1.countryCode, teller1.postalCode);
      assert.deepEqual(zone, [teller1address, ], 'verif zone zone');
      let tsx = await dether.updatePosition(1232123,1323342,"US",34278, {from: teller1address, gas:4000000});
      console.log('tsx', tsx);

    })

  })

  contract('Reputation --', () => {
    it('should be able to comment after sell', async () => {
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

    it('should be able to comment after buy', async () => {
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

    it('should be unable to comment', async () => {
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

    it('should have comment on his profile', async () => {
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
