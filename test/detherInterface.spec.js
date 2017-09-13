/* global contract it artifacts web3 assert */
const {expectThrow, waitForMined} = require('./utils');
const DetherInterfaceAbs = artifacts.require('./DetherInterface.sol');
const DetherStorageAbs = artifacts.require('./DetherStorage.sol');
let dether, detherStorage;

// todo Move to mock data file
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
    , teller3address
    , account1
    , account2
    , buyer1address
    , buyer2address
    , buyer3address
  ] = web3.eth.accounts;

contract('Dether Interface', () => {
  beforeEach(async () => {
    detherStorage = await DetherStorageAbs.new({gas: 1500000})
    dether = await DetherInterfaceAbs.new(detherStorage.address, {gas: 1500000});
    detherStorage.transferOwnership(dether.address);
  })


  contract('Registration --', () => {
    it('should register a teller and be on the map', async () => {
      // Teller 1
      await dether.registerPoint(...Object.values(teller1), {from: teller1address, value: web3.toWei(1, 'ether'), gas: 300000});
      // Check position info
      const pos1 = await dether.getTellerPos(teller1address);
      assert.equal(pos1[0].toNumber(), teller1.lat, 'verif lat');
      assert.equal(pos1[1].toNumber(), teller1.lng, 'verif lng');
      assert.equal(pos1[2].toNumber(), teller1.zoneId, 'verif zone');
      assert.equal(pos1[3].toNumber(), web3.toWei(1, 'ether'), 'verif balance');
      // Check profile info
      const profile1 = await dether.getTellerProfile(teller1address);
      assert.equal(profile1[0].toNumber(), teller1.rate, 'verif rates');
      assert.equal(web3.toUtf8(profile1[3]), teller1.name, 'verif name');
      assert.equal(profile1[4].toNumber(), teller1.currencyId, 'verif currency');
      assert.equal(profile1[5].toNumber(), teller1.avatarId, 'verif avatar');
      assert.equal(web3.toUtf8(profile1[6]), teller1.messengerAddr, 'verif telegram');

      // Teller 2
      await dether.registerPoint(...Object.values(teller2), { from: teller2address, value: web3.toWei(1, 'ether'), gas: 300000 });
      // Check position info
      const pos2 = await dether.getTellerPos(teller2address);
      assert.equal(pos2[0].toNumber(), teller2.lat, 'verif lat');
      assert.equal(pos2[1].toNumber(), teller2.lng, 'verif lng');
      assert.equal(pos2[2].toNumber(), teller2.zoneId, 'verif zone');
      assert.equal(pos2[3].toNumber(), web3.toWei(1, 'ether'), 'verif balance');
      // Check profile info
      const profile2 = await dether.getTellerProfile(teller2address);
      assert.equal(profile2[0].toNumber(), teller2.rate, 'verif rates');
      assert.equal(web3.toUtf8(profile2[3]), teller2.name, 'verif name');
      assert.equal(profile2[4].toNumber(), teller2.currencyId, 'verif currency');
      assert.equal(profile2[5].toNumber(), teller2.avatarId, 'verif avatar');
      assert.equal(web3.toUtf8(profile2[6]), teller2.messengerAddr, 'verif telegram');
    })

    it('should increment tellerIndex array', async () => {
      await dether.registerPoint(...Object.values(teller1), {from: teller1address, value: web3.toWei(1, 'ether'), gas: 300000});
      const count = await detherStorage.getTellerCount();
      assert.equal(count.toNumber(), 1, 'count not correct');
    })

    it('should get teller at index', async () => {
      await dether.registerPoint(...Object.values(teller1), {from: teller1address, value: web3.toWei(1, 'ether'), gas: 300000});
      await dether.registerPoint(...Object.values(teller2), { from: teller2address, value: web3.toWei(1, 'ether'), gas: 300000 });
      const tel1 = await detherStorage.getTellerAtIndex(0);
      const tel2 = await detherStorage.getTellerAtIndex(1);
      assert.equal(tel1, teller1address, 'address t1 not correct');
      assert.equal(tel2, teller2address, 'address t2 not correct');
    })

    it('should get all teller\'s address', async () => {
      await dether.registerPoint(...Object.values(teller1), {from: teller1address, value: web3.toWei(1, 'ether'), gas: 300000});
      await dether.registerPoint(...Object.values(teller2), { from: teller2address, value: web3.toWei(1, 'ether'), gas: 300000 });
      const tellers = await detherStorage.getAllTellers();
      assert.deepEqual(tellers, [teller1address, teller2address], 'addresses dont match');
    })

    it('should throw registering teller if value not >= 10 finney', async () => {
      await expectThrow(dether.registerPoint(...Object.values(teller1),
         {from: teller1address, value: web3.toWei(9, 'finney'), gas: 300000}));
    })

    it.skip('should register and unregister and be only on the new zone', async () => {
      // can't unregister at the moment
    })

    it.skip('should update sell point', async () => {

    })

    it('should get all tellers in a zone', async () => {
      const teller4 = Object.assign({}, teller1, {zoneId: 17, name: 'teller4'});
      await dether.registerPoint(...Object.values(teller1), {from: teller1address, value: web3.toWei(1, 'ether'), gas: 300000});
      await dether.registerPoint(...Object.values(teller2), {from: teller2address, value: web3.toWei(1, 'ether'), gas: 300000});
      await dether.registerPoint(...Object.values(teller3), {from: teller3address, value: web3.toWei(1, 'ether'), gas: 300000});
      await dether.registerPoint(...Object.values(teller4), {from: account1, value: web3.toWei(1, 'ether'), gas: 300000});

      const tellers42 = await detherStorage.getZone(42);
      const teller17 = await detherStorage.getZone(17);
      assert.deepEqual(tellers42, [teller1address, teller2address, teller3address], 'incorrect zone');
      assert.deepEqual(teller17, [account1], 'incorrect zone');
    })

  })


  contract('Money --', () => {
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

      let transferEvent = await dether.Transfer();
      transferEvent.get((err, events) => {
        if (err) assert.isNull(err, 'there was no event');
        assert.equal(events[0].args._from, teller1address, 'T1 addr incorrect in event');
        assert.equal(events[0].args._to, account1, 'A1 addr incorrect in event');
        assert.equal(web3.fromWei(events[0].args._value, 'ether').toNumber(), 1, 'value incorrect in event');
      })
    })

    it('should increase volumeTrade & nbTrade when coins are sent', async () => {
      await dether.registerPoint(...Object.values(teller1), {from: teller1address, value: web3.toWei(4, 'ether'), gas: 300000});
      let profile1 = await dether.getTellerProfile(teller1address);
      const volTrade = web3.fromWei(profile1[1], 'ether').toNumber();
      const numTrade = profile1[2].toNumber();

      await dether.sendCoin.sendTransaction(account1, web3.toWei(1, 'ether'), {from: teller1address});
      await dether.sendCoin.sendTransaction(account2, web3.toWei(2.5, 'ether'), {from: teller1address});

      profile1 = await dether.getTellerProfile(teller1address);
      assert.equal(web3.fromWei(profile1[1], 'ether').toNumber(), volTrade + 3.5, 'volume trade');
      assert.equal(profile1[2].toNumber(), numTrade + 2, 'number of trade');
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

    it('should have teller able to withdraw all funds', async () => {
      await dether.registerPoint(...Object.values(teller1), {from: teller2address, value: web3.toWei(4, 'ether'), gas: 300000});
      const balanceT1AfterReg = web3.fromWei(await dether.getTellerBalances(teller2address), 'ether').toNumber();
      assert.strictEqual(balanceT1AfterReg, 4, 'T1 balance not correct');

      const balanceT1AccountBefore = web3.fromWei(await web3.eth.getBalance(teller2address), 'ether').toNumber();
      const txHash = await dether.withdrawAll.sendTransaction({from: teller2address});
      const receipt = await waitForMined(txHash);
      const gasUsed = receipt.gasUsed;
      const balanceT1AccountAfter = web3.fromWei(await web3.eth.getBalance(teller2address), 'ether').toNumber();
      assert.strictEqual(balanceT1AccountAfter.toFixed(5), (balanceT1AccountBefore - (gasUsed/10000000) + 4).toFixed(5), 'T1 balance not correct');
    })
  })


  contract(('Ownable --'), () => {
    it('should Interface has a owner', async () => {
      assert.equal(await dether.owner(), owner, 'owner not set');
    })

    it('should Interface transfer ownership', async () => {
      await dether.transferOwnership(account1);
      assert.equal(await dether.owner(), account1, 'owner not transferred');
    })

    it('should Interface change Storage ownership', async () => {
      assert.equal(await detherStorage.owner(), await dether.address, 'storage owner not interface address');
      await dether.changeStorageOwnership(account1);
      assert.equal(await detherStorage.owner(), account1, 'owner not transferred');
    })

    it('should Storage has a owner', async () => {
      assert.equal(await detherStorage.owner(), dether.address, 'owner not set');
    })

    it('should Storage throw if transfer ownership', async () => {
      await expectThrow(detherStorage.transferOwnership(account1));
    })
  })
})
