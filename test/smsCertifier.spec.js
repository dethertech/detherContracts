
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
      assert.equal(await smsCertifier.isDelegate(delegate1), false, 'verif not delegate');
      await smsCertifier.addDelegate(delegate1, 'tester', {gas: 4000000, from: owner});

      assert.equal(await smsCertifier.isDelegate(delegate1), true, 'verif delegate');
      assert.equal(await smsCertifier.isCertified(user1), false, 'verif certified');
      const tsx = await smsCertifier.certify(user1, {gas: 4000000, from: delegate1});
      assert.equal(await smsCertifier.isCertified(user1), true, 'verif certified');
    })
  })
})
