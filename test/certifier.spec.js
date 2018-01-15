
const {expectThrow, waitForMined} = require('./utils');
const SmsCertifierAbs = artifacts.require('./certifier/SmsCertifier.sol');
let smsCertifier;
const [
  owner,
  delegate1,
  user1,
  user2
] = web3.eth.accounts;

contract('Sms certifier', () => {
  beforeEach(async () => {
    console.log('Before each');
    smsCertifier = await SmsCertifierAbs.new({gas: 4000000, from: owner});
  })

  contract('Certifier --', () => {

    it('should certify', async () => {
      // Teller 1
      //console.log('dtr contract', dethercontract);
      assert.equal(await smsCertifier.isDelegate(delegate1), false, 'verif not delegate');
      await smsCertifier.addDelegate(delegate1, 'tester', {gas: 4000000, from: owner});

      assert.equal(await smsCertifier.isDelegate(delegate1), true, 'verif delegate');
      const tsx = await smsCertifier.certify(user1, {gas: 4000000, from: delegate1});
      // console.log('tsx', tsx);
      // assert.equal(smsCertifier.isCertified(user1), true, 'verif certified');




      // const pos1 = await dether.getTellerPos(teller1address);
      // assert.equal(pos1[0].toNumber(), teller1.lat, 'verif lat');
      // assert.equal(pos1[1].toNumber(), teller1.lng, 'verif lng');
      // assert.equal(pos1[2].toNumber(), teller1.zoneId, 'verif zone');
      // assert.equal(pos1[3].toNumber(), web3.toWei(1, 'ether'), 'verif balance');
      // // Check profile info
      // const profile1 = await dether.getTellerProfile(teller1address);
      // const profile1 = await dethercontract.getTellerProfile(teller1address);
      // console.log('profile ', profile1);
      // const balance1 = await dethercontract.getTellerBalance(web3.eth.coinbase);
      // console.log('profile ', balance1);

    })

  })

})
