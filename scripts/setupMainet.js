const Papa = require('papaparse');
const fs = require('fs');
const Bluebird = require('bluebird');

const DetherInterface = artifacts.require('./DetherInterface');
const DetherStorage = artifacts.require('./DetherTellerStorage.sol');
const SmsCertifier = artifacts.require('./certifier/SmsCertifier.sol');
const DthRegistry = artifacts.require('./DthRegistry.sol');

module.exports = async (callback) => {

  // const sale = await DetherSale.at('0x5cab11f18f08462806b22c9214353fbd26d2067f');
  const dether = await DetherInterface.deployed();

  let gas = 0;

  console.log('Initial setup ownership');
  const allocationsTx = await sale.performInitialAllocations();

  gas += allocationsTx.receipt.gasUsed;

  const start = 1518006600;
  console.log('Start time being set');
  const startTimeTx = await sale.setSaleStartTime(start);
  gas += startTimeTx.receipt.gasUsed;

  console.log('End time being set');
  const endTimeTx = await sale.setSaleEndTime(start + 7 * 24 * 60 * 60);
  gas += endTimeTx.receipt.gasUsed;

  // console.log('Sending setupDone transaction');
  // const setupDoneTx = await sale.setupDone();
  // gas += setupDoneTx.receipt.gasUsed;

  console.log('Gas used:', gas);

  callback();
};
