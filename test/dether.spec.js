/* global contract it artifacts web3 assert*/
const DetherAbs = artifacts.require('./Dether.sol');
let dether = null;

// --> TEST TO ADD:
// ADD TELLER, AND DELETE FROM ZONE
// REPUTATION

const teller1 = {
  lat: 123456,
  lng: 987654,
  zoneId: 42,
  rate: 300,
  avatarId: 1,
  currencyId: 1,
  messengerAddr: 'http://t.me/teller1',
  name: 'teller1'
}

const teller2 = {
  lat: 444444,
  lng: 5555555,
  zoneId: 42,
  rate: 123,
  avatarId: 2,
  currencyId: 2,
  messengerAddr: 'http://t.me/teller2',
  name: 'teller2'
}

const teller3 = {
  lat: 1234333,
  lng: 234535,
  zoneId: 42,
  rate: 222,
  avatarId: 3,
  currencyId: 2,
  messengerAddr: 'http://t.me/teller3',
  name: 'teller3'
}

const
  [
      owner
    , teller1address
    , teller2address
    , account1
    , account2
    , buyer1address
    , buyer2address
    , buyer3address
  ] = web3.eth.accounts;

contract('Dether', () => {
  beforeEach(async () => {
    dether = await DetherAbs.new();
  })

  contract('Registration --', () => {
    it('should register a Teller and be on the map', async () => {
      // Teller 1
      await dether.registerPoint(...Object.values(teller1), {from: teller1address, value: web3.toWei(1, 'ether'), gas: 1000000});
      // Check position info
      const pos1 = await dether.getTellerPos(teller1address);
      assert.equal(pos1[0].toNumber(), teller1.lat, 'verif lat');
      assert.equal(pos1[1].toNumber(), teller1.lng, 'verif lng');
      assert.equal(pos1[2].toNumber(), teller1.zoneId, 'verif zone');
      assert.equal(pos1[3].toNumber(), web3.toWei(1, 'ether'), 'verif balance');
      // Check profile info
      const profile1 = await dether.getTellerProfile(teller1address);
      assert.equal(profile1[0].toNumber(), teller1.rate, 'verif rates');
      assert.equal(profile1[3], teller1.name, 'verif name');
      assert.equal(profile1[4].toNumber(), teller1.currencyId, 'verif currency');
      assert.equal(profile1[5].toNumber(), teller1.avatarId, 'verif avatar');
      assert.equal(profile1[6], teller1.messengerAddr, 'verif telegram');

      // Teller 2
      await dether.registerPoint(...Object.values(teller2), { from: teller2address, value: web3.toWei(1, 'ether'), gas: 1000000 });
      // Check position info
      const pos2 = await dether.getTellerPos(teller2address);
      assert.equal(pos2[0].toNumber(), teller2.lat, 'verif lat');
      assert.equal(pos2[1].toNumber(), teller2.lng, 'verif lng');
      assert.equal(pos2[2].toNumber(), teller2.zoneId, 'verif zone');
      assert.equal(pos2[3].toNumber(), web3.toWei(1, 'ether'), 'verif balance');
      // Check profile info
      const profile2 = await dether.getTellerProfile(teller2address);
      assert.equal(profile2[0].toNumber(), teller2.rate, 'verif rates');
      assert.equal(profile2[3], teller2.name, 'verif name');
      assert.equal(profile2[4].toNumber(), teller2.currencyId, 'verif currency');
      assert.equal(profile2[5].toNumber(), teller2.avatarId, 'verif avatar');
      assert.equal(profile2[6], teller2.messengerAddr, 'verif telegram');
    })

    it.skip('should register and unregister and be only on the new zone', async () => {
      // can't unregister at the moment
    })

    it.skip('should update sell point', async () => {

    })
  })

  contract('Money transfer --', () => {
    it('should have teller able to send coins to eth addr', async () => {
      const balanceT1BeforeReg = web3.fromWei(await dether.getTellerBalances(teller1address), 'ether').toNumber();
      assert.strictEqual(balanceT1BeforeReg, 0, 'T1 balance not empty');

      await dether.registerPoint(...Object.values(teller1), {from: teller1address, value: web3.toWei(2, 'ether'), gas: 300000});
      const balanceT1AfterReg = web3.fromWei(await dether.getTellerBalances(teller1address), 'ether').toNumber();
      assert.strictEqual(balanceT1AfterReg, 2, 'T1 balance not correct');

      const balanceAccount1beforeSend = web3.fromWei(await web3.eth.getBalance(account1), 'ether').toNumber();
      await dether.sendCoin.sendTransaction(account1, web3.toWei(1, 'ether'), {from: teller1address});

      const balanceT1AfterSend = web3.fromWei(await dether.getTellerBalances(teller1address), 'ether').toNumber();
      assert.strictEqual(balanceT1AfterSend, 1, 'T1 balance not correct');

      assert.strictEqual(web3.fromWei(await web3.eth.getBalance(account1), 'ether').toNumber(), balanceAccount1beforeSend + 1, 'Account1 balance not correct');
    })

    it('should increase volumeTrade & nbTrade when coins are sent', async () => {
      await dether.registerPoint(...Object.values(teller1), {from: teller1address, value: web3.toWei(4, 'ether'), gas: 300000});
      let profile1 = await dether.getTellerProfile(teller1address);
      assert.equal(web3.fromWei(profile1[1], 'ether').toNumber(), 0, 'volume trade');
      assert.equal(profile1[2].toNumber(), 0, 'number of trade');

      await dether.sendCoin.sendTransaction(account1, web3.toWei(1, 'ether'), {from: teller1address});
      await dether.sendCoin.sendTransaction(account2, web3.toWei(2.5, 'ether'), {from: teller1address});

      profile1 = await dether.getTellerProfile(teller1address);
      assert.equal(web3.fromWei(profile1[1], 'ether').toNumber(), 3.5, 'volume trade');
      assert.equal(profile1[2].toNumber(), 2, 'number of trade');
    })

    it.skip('should not be able to send to myself and win reputation', async () => {
      await dether.registerPoint(...Object.values(teller1), {from: teller1address, value: web3.toWei(4, 'ether'), gas: 300000});
      let profile1 = await dether.getTellerProfile(teller1address);
      assert.equal(web3.fromWei(profile1[1], 'ether').toNumber(), 0, 'volume trade');
      assert.equal(profile1[2].toNumber(), 0, 'number of trade');

      await dether.sendCoin.sendTransaction(teller1address, web3.toWei(2, 'ether'), {from: teller1address});

      profile1 = await dether.getTellerProfile(teller1address);
      assert.equal(web3.fromWei(profile1[1], 'ether').toNumber(), 0, 'volume trade');
      assert.equal(profile1[2].toNumber(), 0, 'number of trade');
    })
  })
})
