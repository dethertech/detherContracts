/* global contract it artifacts web3 assert */
const {expectThrow, waitForMined} = require('./utils');
const {teller1, teller2, teller3} = require('./mock.json');
const DetherStorageAbs = artifacts.require('./DetherStorage.sol');
let detherStorage;

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


contract('Dether Storage', () => {
  beforeEach(async () => {
    detherStorage = await DetherStorageAbs.new({gas: 1500000})
  })

  contract('Registration --', () => {
    it('should set/get teller position', async () => {
      await detherStorage.setTellerPosition(teller1address, teller1.lat, teller1.lng, teller1.zoneId);
      const pos1 = await detherStorage.getTellerPosition(teller1address);
      assert.equal(pos1[0].toNumber(), teller1.lat, 'verif lat');
      assert.equal(pos1[1].toNumber(), teller1.lng, 'verif lng');
      assert.equal(pos1[2].toNumber(), teller1.zoneId, 'verif zone');
    })

    it.skip('should setTellerZone', async () => {})

    it.skip('should getZone', async () => {})

    it.skip('should isTeller', async () => {})

    it.skip('should getTellerCount', async () => {})

    it.skip('should getTellerAtIndex', async () => {})
  })
})
