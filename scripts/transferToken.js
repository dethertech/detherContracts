
const DetherToken = artifacts.require('./dth/DetherToken.sol');
const DetherInterface = artifacts.require('./DetherInterface');
const DetherStorage = artifacts.require('./DetherTellerStorage.sol');
const SmsCertifier = artifacts.require('./certifier/SmsCertifier.sol');
const DthRegistry = artifacts.require('./DthRegistry.sol');
const Dth = artifacts.require('./DetherInterface.sol');

module.exports = async (callback) => {

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



  const transferMethodTransactionData = web3Abi.encodeFunctionCall(
      overloadedTransferAbi,
      [
          '0x969b6C352Ef0713484d54479457685A304ac96Aa',
          10,
          web3.toHex('test')
      ]
  );
  const tsx = await web3.eth.sendTransaction({from: '0x6AAb2B0913B70270E840B14c2b23B716C0a43522', to: '0x85CAcBBCa83cE5d461e16cAF3F84c99eD5c6BE1c', data: transferMethodTransactionData, value: 0, gas: 5700000});
  console.log(tsx);
  callback();
};
