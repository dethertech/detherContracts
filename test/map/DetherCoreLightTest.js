/* eslint-env node, mocha */
/* global artifacts, contract, web3, assert */
/* eslint-disable max-len */

const {expectThrow} = require('../utils');
const Lexico = artifacts.require('Lexico.sol');
const CSCZone = artifacts.require('CSCZone.sol');
const DetherCoreLight = artifacts.require('DetherCoreLight.sol');
const fs = require('fs');
const path = require("path");
const congotree = require('../../data/congotree.json');

const getAccounts = () => new Promise((resolve, reject) => {
  web3.eth.getAccounts((err, acc) => err ? reject(err) : resolve(acc)); // eslint-disable-line
});


let owner;
let user1;
let user2;
let user3;
let detherCoreLightContract

contract('DetherCoreLight - Deploy CSC', () => {


  // Deployment of the congo : will be accessible in all tests
  before(async () => {

    const accs = await getAccounts();
    owner = accs[0];
    user1 = accs[1];
    user2 = accs[2];
    user3 = accs[3];


    lexicoContract = await Lexico.new({ from: owner, gas: 3000000 });
    lexicoContractAddress = lexicoContract.address;

    detherCoreLightContract = await DetherCoreLight.new(lexicoContractAddress, { from: owner, gas: 3000000});
    detherCoreLightContractAddress = detherCoreLightContract.address;
  });


  it("Addzone from country", async () => {

    let totalgas = 0
    let countrycode = 'CG'

    // TODO: for each country

    for (var level0 in congotree) {

      var restOfJsonUnder0 = congotree[level0];
      var arraySubLevel0 = []

      for (var level1 in restOfJsonUnder0) {

        arraySubLevel0.push(web3.fromAscii(level1))

        var restOfJsonUnder1 = congotree[level0][level1];
        var arraySubLevel1 = [];
        for (var level2 in restOfJsonUnder1) {
          arraySubLevel1.push(web3.fromAscii(level2));

          var restOfJsonUnder2 = congotree[level0][level1][level2];
          var arraySubLevel2 = [];
          for (var level3 in restOfJsonUnder2) {
            arraySubLevel2.push(web3.fromAscii(level3));
          }
          receipt2 = await lexicoContract.updateLevel2(web3.fromAscii(countrycode), web3.fromAscii(level0+level1+level2), arraySubLevel2);
          totalgas = totalgas + receipt2.receipt.gasUsed;
        }
        receipt1 = await lexicoContract.updateLevel1(web3.fromAscii(countrycode), web3.fromAscii(level0+level1), arraySubLevel1);
        totalgas = totalgas + receipt1.receipt.gasUsed;
      }
      receipt0 = await lexicoContract.updateLevel0(web3.fromAscii(countrycode), web3.fromAscii(level0), arraySubLevel0);
      totalgas = totalgas + receipt0.receipt.gasUsed;
    }

    addZone = await detherCoreLightContract.authorizeCountry(web3.fromAscii('CG'))

    assert.equal(
      await detherCoreLightContract.isAuthorized.call(web3.fromAscii('CG')),
      true,
      'should be authorized',
    );

    assert.equal(
      await detherCoreLightContract.isAuthorized.call(web3.fromAscii('C0')),
      false,
      'should not be authorized',
    );


    // console.log('Total gas used for congo')
    // console.log(totalgas)


    let zoneAddress;
    addZone = await detherCoreLightContract.addZoneFromCountry(web3.fromAscii('kr4ze75'), web3.fromAscii('CG'), { from: user1, gas: 2000000})
    cscAddress = addZone.receipt.logs[0]['address']

    let zone;
    zone = CSCZone.at(cscAddress)


    // not in congo
    addWrongZone = await expectThrow(detherCoreLightContract.addZoneFromCountry(web3.fromAscii('s0x16zmf'), web3.fromAscii('CG'), { from: user1, gas: 2000000}))




  });





});
