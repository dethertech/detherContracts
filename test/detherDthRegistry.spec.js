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

contract('Dether Dth', async () => {
  beforeEach( async () => {
    detherStorage = await DetherStorageAbs.new({gas: 4000000, from: owner});
    smsCertifier = await SmsCertifierAbs.new({gas: 4000000, from: owner});
    dthToken = await DthAbs.new({gas: 4000000, from: owner});
    dthRegistry = await DthRegistryAbs.new({gas: 4000000, from: owner});

    dether = await DetherInterfaceAbs.new(detherStorage.address, smsCertifier.address, dthToken.address, dthRegistry.address  ,{gas: 4000000, from: owner});
    await dthRegistry.transferOwnership(dether.address, {gas: 4000000, from: owner});
    await detherStorage.transferOwnership(dether.address, {gas: 4000000, from: owner});
    await smsCertifier.addDelegate(certifier, 'test', {gas: 4000000, from: owner});
    await smsCertifier.certify(teller1address, {gas: 4000000, from: certifier});
    await smsCertifier.certify(teller2address, {gas: 4000000, from: certifier});
    await smsCertifier.certify(teller3address, {gas: 4000000, from: certifier});

    await dthToken.mint(owner, 1000);
    await dthToken.mint(teller1address, 1000);
    await dthToken.mint(teller2address, 1000);
    await dthToken.mint(teller3address, 1000);
    await dthToken.finishMinting();
  })

  contract('Send token and get by interface --', async () =>  {

    it('trigger token fallback and able to register', async () => {
      // tricks to solve truffle pblm with overloading
      const transferMethodTransactionData = web3Abi.encodeFunctionCall(
          overloadedTransferAbi,
          [
              dether.address,
              20,
              web3.toHex('ffbdgfndghn')
          ]
      );
      let tsx = await web3.eth.sendTransaction({from: teller1address, to: dthToken.address, data: transferMethodTransactionData, value: 0, gas: 5700000});
      // const events = dether.receiveDth({},{ fromBlock: 0, toBlock: 'latest' });
      // const res = await events.get( (err,res) => console.log(res));
      // const logs = await new Promise((resolve, reject) => {
      //   events.get((errors, logs) => {
      //     if (errors) reject(errors);
      //     resolve(logs);
      //   });
      // });
      let balanceAccount1 = await dthToken.balanceOf.call(dether.address);
      let balanceAccount2 = await dthToken.balanceOf.call(dthRegistry.address);
      assert.equal(balanceAccount1.toNumber(), 0, 'should be 0');
      assert.equal(balanceAccount2.toNumber(), 20, 'should be 20');
      console.log(await dthRegistry.registry.call(teller1address));

      tsx = await dether.registerTeller(...Object.values(teller1), {from: teller1address, gas:4000000, value: web3.toWei(1, 'ether')});
      let pos1 = await detherStorage.getTellerPositionRaw(teller1address);
      console.log('register ',tsx)
      assert.equal(pos1[0].toNumber(), teller1.lat, 'verif lat');
      assert.equal(pos1[1].toNumber(), teller1.lng, 'verif lng');
      assert.equal(pos1[2], teller1.countryCode, 'verif country code');
      assert.equal(pos1[3].toNumber(), teller1.postalCode, 'verif postal code');


    })

  })



})
