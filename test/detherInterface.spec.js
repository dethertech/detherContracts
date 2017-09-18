/* global contract it artifacts web3 assert */
const {expectThrow, waitForMined} = require('./utils');
const {teller1, teller2, teller3} = require('./mock.json');
const DetherInterfaceAbs = artifacts.require('./DetherInterface.sol');
const DetherStorageAbs = artifacts.require('./DetherStorage.sol');
let dether, detherStorage;

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

const convertTypes = x => {
  if (typeof x === 'string') return web3.toUtf8(x)
  else if (x.constructor.name === 'BigNumber') return x.toNumber()
  else return x
}

contract('Dether Interface', () => {
  beforeEach(async () => {
    detherStorage = await DetherStorageAbs.new({gas: 1500000})
    dether = await DetherInterfaceAbs.new(detherStorage.address, {gas: 1500000});
    detherStorage.transferOwnership(dether.address);
  })


  contract('Registration --', () => {
    beforeEach(async () => {
      dether.setInit();
    })

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

    it('should register, sell, unregister, register and keep its reputation', async () => {
      await dether.registerPoint(...Object.values(teller1), {from: teller1address, value: web3.toWei(1, 'ether'), gas: 300000});
      await dether.sendCoin(account1, web3.toWei(0.5, 'ether'), {from: teller1address});
      await dether.withdrawAll({from: teller1address});
      await dether.registerPoint(...Object.values(teller1), {from: teller1address, value: web3.toWei(1, 'ether'), gas: 300000});
      let profile1 = await dether.getTellerProfile(teller1address);
      assert.equal(web3.fromWei(profile1[1], 'ether').toNumber(), 0.5, 'volume trade');
      assert.equal(profile1[2].toNumber(), 1, 'number of trade');
    })

    it('should get all tellers in a zone', async () => {
      const teller4 = Object.assign({}, teller1, {zoneId: 17, name: 'teller4'});
      await dether.registerPoint(...Object.values(teller1), {from: teller1address, value: web3.toWei(1, 'ether'), gas: 400000});
      await dether.registerPoint(...Object.values(teller2), {from: teller2address, value: web3.toWei(1, 'ether'), gas: 400000});
      await dether.registerPoint(...Object.values(teller3), {from: teller3address, value: web3.toWei(1, 'ether'), gas: 400000});
      await dether.registerPoint(...Object.values(teller4), {from: account1, value: web3.toWei(1, 'ether'), gas: 400000});

      const tellers42 = await detherStorage.getZone(42);
      const teller17 = await detherStorage.getZone(17);
      assert.deepEqual(tellers42, [teller1address, teller2address, teller3address], 'incorrect zone');
      assert.deepEqual(teller17, [account1], 'incorrect zone');
    })
  })

  contract('Money --', () => {
    beforeEach(async () => {
      dether.setInit();
    })

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
      await dether.registerPoint(...Object.values(teller1), {from: teller1address, value: web3.toWei(4, 'ether'), gas: 300000});
      const balanceT1AfterReg = web3.fromWei(await dether.getTellerBalances(teller1address), 'ether').toNumber();
      assert.strictEqual(balanceT1AfterReg, 4, 'T1 balance not correct');

      const balanceT1AccountBefore = web3.fromWei(await web3.eth.getBalance(teller1address), 'ether').toNumber();
      const txHash = await dether.withdrawAll.sendTransaction({from: teller1address});
      const receipt = await waitForMined(txHash);
      const gasUsed = receipt.gasUsed;
      const balanceT1AccountAfter = web3.fromWei(await web3.eth.getBalance(teller1address), 'ether').toNumber();
      assert.strictEqual(balanceT1AccountAfter.toFixed(5), (balanceT1AccountBefore - (gasUsed/10000000) + 4).toFixed(5), 'T1 balance not correct');
    })
  })


  contract(('Ownable --'), () => {
    beforeEach(async () => {
      dether.setInit();
    })

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

  contract(('Utils --'), () => {
    it('should import tellers', async () => {
      await dether.importTellers(...Object.values(teller1), web3.toWei(1, 'ether'), {gas: 300000})
      const tellers = await detherStorage.getAllTellers();
      const data = await Promise.all(tellers.map(async (address) => {
        const profile = (await dether.getTellerProfile(address)).map(convertTypes)
        const position = (await dether.getTellerPos(address)).map(convertTypes)
        return [...position, ...profile]
      }))
      assert.deepEqual(data, [[123456, 987654, 42, 1000000000000000000, 300, 0, 0, 'teller1', 1, 1, 'http://t.me/teller1']], 'data not correct')
    })

    it('should export all tellers', async () => {
            dether.setInit();
      await dether.registerPoint(...Object.values(teller1), {from: teller1address, value: web3.toWei(1, 'ether'), gas: 300000});
      const tellers = await detherStorage.getAllTellers();
      const data = await Promise.all(tellers.map(async (address) => {
        const profile = (await dether.getTellerProfile(address)).map(convertTypes)
        const position = (await dether.getTellerPos(address)).map(convertTypes)
        return [...position, ...profile]
      }))
      assert.deepEqual(data, [[123456, 987654, 42, 1000000000000000000, 300, 0, 0, 'teller1', 1, 1, 'http://t.me/teller1']], 'data not correct')
    })

  })
})
