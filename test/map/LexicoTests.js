/* eslint-env node, mocha */
/* global artifacts, contract, web3, assert */
/* eslint-disable max-len */

const {expectThrow} = require('./utils');
const congotree = require('../data/congotree.json');

const egCode = 'EG'
const adCode = 'AD'
const aeCode = 'AE'
const afCode = 'AF'
const agCode = 'AG'
const aiCode = 'AI'
const alCode = 'AL'
const amCode = 'AM'
const EGtree = require('../data/trees_countries/'+egCode+'.json');
const ADtree = require('../data/trees_countries/'+adCode+'.json');
const AEtree = require('../data/trees_countries/'+aeCode+'.json');
const AFtree = require('../data/trees_countries/'+afCode+'.json');
const AGtree = require('../data/trees_countries/'+agCode+'.json');
const AItree = require('../data/trees_countries/'+aiCode+'.json');
const ALtree = require('../data/trees_countries/'+alCode+'.json');
const AMtree = require('../data/trees_countries/'+amCode+'.json');
const Lexico = artifacts.require('Lexico.sol');
const CSCZone = artifacts.require('CSCZone.sol');
const fs = require('fs');
// const treeFolder = './data/trees_countries/';
const path = require("path");
const config = require('../config.json')

const getAccounts = () => new Promise((resolve, reject) => {
  web3.eth.getAccounts((err, acc) => err ? reject(err) : resolve(acc)); // eslint-disable-line
});


// TODO: Do another function which do the same, with less transactions (by updating different mapping keys in the same transaction for example)
async function insertCountry(countrycode, countryTreePath, lexicoCountryContract){

  let totalgas = 0

  console.log(countrycode)

  for (var level0 in countryTreePath) {
    var restOfJsonUnder0 = countryTreePath[level0];
    var arraySubLevel0 = []
    for (var level1 in restOfJsonUnder0) {
      arraySubLevel0.push(web3.fromAscii(level1))
      var restOfJsonUnder1 = countryTreePath[level0][level1];
      var arraySubLevel1 = [];
      for (var level2 in restOfJsonUnder1) {
        arraySubLevel1.push(web3.fromAscii(level2));
        var restOfJsonUnder2 = countryTreePath[level0][level1][level2];
        var arraySubLevel2 = [];
        for (var level3 in restOfJsonUnder2) {
          arraySubLevel2.push(web3.fromAscii(level3));
        }
        receipt2 = await lexicoCountryContract.updateLevel2(web3.fromAscii(countrycode), web3.fromAscii(level0+level1+level2), arraySubLevel2);
        totalgas = totalgas + receipt2.receipt.gasUsed;
      }
      receipt1 = await lexicoCountryContract.updateLevel1(web3.fromAscii(countrycode), web3.fromAscii(level0+level1), arraySubLevel1);
      totalgas = totalgas + receipt1.receipt.gasUsed;
    }
    receipt0 = await lexicoCountryContract.updateLevel0(web3.fromAscii(countrycode), web3.fromAscii(level0), arraySubLevel0);
    totalgas = totalgas + receipt0.receipt.gasUsed;
  }
  console.log('Total gas used for ' + countrycode)
  console.log(totalgas)
}


let owner;
let user1;
let user2;
let user3;
let lexicoContract;
let countrycode = 'CG'

contract('Lexico', () => {


  // Deployment of the congo : will be accessible in all tests
  before(async () => {

    const accs = await getAccounts();
    owner = accs[0];
    user1 = accs[1];
    user2 = accs[2];
    user3 = accs[3];


    lexicoContract = await Lexico.new({ from: owner });
    lexicoContractAddress = lexicoContract.address;

    let totalgas = 0

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

    console.log('Total gas used for congo')
    console.log(totalgas)


  });

  it("Test country geohashes", async () => {

    answer_k = await lexicoContract.getLevel0subArray(web3.fromAscii('CG'), web3.fromAscii('k'))
    assert.equal(
      answer_k.includes(web3.fromAscii('r')),
      true,
      'should be equal',
    );

    answer_s = await lexicoContract.getLevel0subArray(web3.fromAscii('CG'), web3.fromAscii('s'))
    assert.equal(
      answer_s[0],
      web3.fromAscii('2'),
      'should be equal',
    );

    answer_kr = await lexicoContract.getLevel1subArray(web3.fromAscii('CG'), web3.fromAscii('kr'))

    assert.equal(
      answer_kr.includes(web3.fromAscii('7')),
      true,
      'should be inside',
    );

    assert.equal(
      answer_kr.includes(web3.fromAscii(',')),
      false,
      'should not be inside',
    );

    assert.equal(
      answer_kr.includes(web3.fromAscii('g')),
      true,
      'should be inside',
    );

    assert.equal(
      answer_kr.includes(web3.fromAscii('/')),
      false,
      'should be inside',
    );

    assert.equal(
      answer_kr.includes(web3.fromAscii('/')),
      false,
      'should be inside',
    );

    assert.equal(
      answer_kr.length,
      15,
      'should be size 15',
    );

    answer_s2h = await lexicoContract.getLevel2subArray(web3.fromAscii('CG'), web3.fromAscii('s2h'))

    assert.equal(
      answer_s2h.length,
      29,
      'should be size 29',
    );

    assert.equal(
      answer_s2h.includes(web3.fromAscii('x')),
      true,
      'should be inside',
    );

    assert.equal(
      answer_s2h.includes(web3.fromAscii('y')),
      true,
      'should be inside',
    );

    assert.equal(
      answer_s2h.includes(web3.fromAscii('a')),
      false,
      'should be inside',
    );

    answer_kr0 = await lexicoContract.getLevel2subArray(web3.fromAscii('CG'), web3.fromAscii('kr0'))

    assert.equal(
      answer_kr0.includes(web3.fromAscii('z')),
      true,
      'should not be inside',
    );

    assert.equal(
      answer_kr0.includes(web3.fromAscii('a')),
      false,
      'should not be inside',
    );

    assert.equal(
      answer_kr0.includes(web3.fromAscii('k')),
      true,
      'should be inside',
    );

    assert.equal(
      answer_kr0.length,
      15,
      'should be size 15',
    );

  });


  it("Test byteInsideArray", async () => {

    answer_kr0 = await lexicoContract.getLevel2subArray(web3.fromAscii('CG'), web3.fromAscii('kr0'))
    console.log('test')
    web3.fromAscii('z')
    console.log(lexicoContract)


    console.log(answer_kr0)
    assert.equal(
      await lexicoContract.byteInsideArray(web3.fromAscii('z'), answer_kr0),
      true,
      'should be inside',
    );

    assert.equal(
      await lexicoContract.byteInsideArray.call(web3.fromAscii('a'), answer_kr0),
      false,
      'should not be inside',
    );

    assert.equal(
      await lexicoContract.byteInsideArray.call(web3.fromAscii('t'), answer_kr0),
      true,
      'should be inside',
    );

    assert.equal(
      await lexicoContract.byteInsideArray.call(web3.fromAscii('f'), answer_kr0),
      false,
      'should not be inside',
    );

  });


  it("Test toBytes3", async () => {

    assert.equal(
      await lexicoContract.toBytes3.call(web3.fromAscii('kr0ttse')),
      '0x6b7230',
      'should be equal',
    );

  });

  it("Test get4thByte", async () => {

    assert.equal(
      await lexicoContract.get4thByte.call(web3.fromAscii('kr0ttse')),
      '0x74',
      'should be equal',
    );

  });

  it("Test zoneInsideCountry", async () => {

    assert.equal(
      await lexicoContract.zoneInsideCountry.call(web3.fromAscii('CG'), web3.fromAscii('kr0ttse')),
      true,
      'should be inside',
    );

    assert.equal(
      await lexicoContract.zoneInsideCountry.call(web3.fromAscii('CG'), web3.fromAscii('krrrrrr')),
      false,
      'should not be inside',
    );

    assert.equal(
      await lexicoContract.zoneInsideCountry.call(web3.fromAscii('CG'), web3.fromAscii('kr0ttes')),
      true,
      'should not be inside',
    );

    assert.equal(
      await lexicoContract.zoneInsideCountry.call(web3.fromAscii('CG'), web3.fromAscii('kqgtg75')),
      false,
      'should not be inside',
    );

  });


  it("Test CSC contract", async () => {

    // 'ornano' = zone in Congo Brazzaville
    ornano = web3.fromAscii('kr4zes8')
    // cscZoneContractOwner should be the auction contract, but owner for the moment
    // user1 is the zoneOwner and this CSC contract reprensent where he can operate
    // and contains some conditions (and could be extended )
    // A CSCZone simply an identifier which represent a zone + the contract of the zone
    let cscZoneContract = await CSCZone.new(ornano, user1, owner, { from: owner });
    cscZoneContractAddress = cscZoneContract.address;


    geohash = await cscZoneContract.getGeohash.call({ from: owner })
    assert.equal(
      web3.fromAscii('kr4zes8'),
      geohash,
      'should be equal',
    );

    // test if geohash of the specified CSC is in the country
    assert.equal(
      await lexicoContract.zoneInsideCountry.call(web3.fromAscii('CG'), geohash),
      true,
      'should be inside',
    );

  });



  /*
  // 13325 TX 6.12 eth (gasPrice 2 gweis)
  it("Inserting whole world", async () => {

    assert.equal(
      true,
      true,
      'should be true',
    );

    let totalGasWorld = 0
    let countryCounter = 0

    console.log(config.treeFolder)

    fs.readdir(config.treeFolder, (err, files) => {
      files.forEach(async file =>  {
        countryPath = config.treeFolder + file;
        var country = require(countryPath)
        countryCounter = countryCounter + 1
        var localCountryGas = 0

        for (var level0 in country) {

          var restOfJsonUnder0 = country[level0];
          var arraySubLevel0 = []

          for (var level1 in restOfJsonUnder0) {

            arraySubLevel0.push(web3.fromAscii(level1))

            var restOfJsonUnder1 = country[level0][level1];
            var arraySubLevel1 = [];
            for (var level2 in restOfJsonUnder1) {
              arraySubLevel1.push(web3.fromAscii(level2));

              var restOfJsonUnder2 = country[level0][level1][level2];
              var arraySubLevel2 = [];
              for (var level3 in restOfJsonUnder2) {
                arraySubLevel2.push(web3.fromAscii(level3));
              }
              receipt2 = await lexicoContract.updateLevel2(web3.fromAscii(countrycode), web3.fromAscii(level0+level1+level2), arraySubLevel2);
              totalGasWorld = totalGasWorld + receipt2.receipt.gasUsed;
              localCountryGas = localCountryGas + receipt2.receipt.gasUsed;
            }
            receipt1 = await lexicoContract.updateLevel1(web3.fromAscii(countrycode), web3.fromAscii(level0+level1), arraySubLevel1);
            totalGasWorld = totalGasWorld + receipt1.receipt.gasUsed;
            localCountryGas = localCountryGas + receipt1.receipt.gasUsed;
          }
          receipt0 = await lexicoContract.updateLevel0(web3.fromAscii(countrycode), web3.fromAscii(level0), arraySubLevel0);
          totalGasWorld = totalGasWorld + receipt0.receipt.gasUsed;
          localCountryGas = localCountryGas + receipt0.receipt.gasUsed;
        }
        console.log('Country ' + file + ' number ' + countryCounter)
        console.log('Current country costs: ' + localCountryGas)
        console.log('Total gas used: ' + totalGasWorld)
      });
    })
  });

  */

  it("Test EG", async () => {

    await insertCountry(egCode, EGtree, lexicoContract)

    answer_ss9 = await lexicoContract.getLevel2subArray(web3.fromAscii('EG'), web3.fromAscii('ss9'))

    assert.equal(
      answer_ss9.includes(web3.fromAscii('g')),
      true,
      'should be inside',
    );

    assert.equal(
      answer_ss9.includes(web3.fromAscii('e')),
      false,
      'should not be inside',
    );

    answer_sss = await lexicoContract.getLevel2subArray(web3.fromAscii('EG'), web3.fromAscii('sss'))

    assert.equal(
      answer_sss.includes(web3.fromAscii('k')),
      true,
      'should be inside',
    );

  });

  it("Test AD", async () => {

    await insertCountry(adCode, ADtree, lexicoContract)

    answer_sp9 = await lexicoContract.getLevel2subArray(web3.fromAscii('AD'), web3.fromAscii('sp9'))

    assert.equal(
      answer_sp9.includes(web3.fromAscii('4')),
      true,
      'should be inside',
    );

    assert.equal(
      answer_sp9.includes(web3.fromAscii('1')),
      true,
      'should be inside',
    );

    assert.equal(
      answer_sp9.includes(web3.fromAscii('5')),
      false,
      'should not be inside',
    );

  });

  it("Test AE", async () => {

    await insertCountry(aeCode, AEtree, lexicoContract)

    answer_thq = await lexicoContract.getLevel2subArray(web3.fromAscii('AE'), web3.fromAscii('thq'))

    assert.equal(
      answer_thq.includes(web3.fromAscii('9')),
      true,
      'should be inside',
    );

    answer_thp = await lexicoContract.getLevel2subArray(web3.fromAscii('AE'), web3.fromAscii('thp'))

    assert.equal(
      answer_thp.includes(web3.fromAscii('m')),
      true,
      'should be inside',
    );

    assert.equal(
      answer_thp.includes(web3.fromAscii('t')),
      false,
      'should not be inside',
    );

  });


  it("Test AF", async () => {

    await insertCountry(afCode, AFtree, lexicoContract)

    answer_tmv = await lexicoContract.getLevel2subArray(web3.fromAscii('AF'), web3.fromAscii('tmv'))

    assert.equal(
      answer_tmv.includes(web3.fromAscii('7')),
      true,
      'should be inside',
    );

    answer_tmq = await lexicoContract.getLevel2subArray(web3.fromAscii('AF'), web3.fromAscii('tmq'))

    assert.equal(
      answer_tmq.includes(web3.fromAscii('k')),
      true,
      'should be inside',
    );

    assert.equal(
      answer_tmq.includes(web3.fromAscii('j')),
      true,
      'should be inside',
    );

    assert.equal(
      answer_tmq.includes(web3.fromAscii('a')),
      false,
      'should not be inside',
    );

  });


  it("Test AG", async () => {

    await insertCountry(agCode, AGtree, lexicoContract)

    answer_tmv = await lexicoContract.getLevel2subArray(web3.fromAscii('AG'), web3.fromAscii('deh'))

    assert.equal(
      answer_tmv.includes(web3.fromAscii('4')),
      false,
      'should not be inside',
    );

    assert.equal(
      answer_tmq.includes(web3.fromAscii('5')),
      true,
      'should be inside',
    );

    assert.equal(
      answer_tmq.includes(web3.fromAscii('0')),
      true,
      'should be inside',
    );

  });


  it("Test AI", async () => {

    await insertCountry(aiCode, AItree, lexicoContract)

    answer_de6 = await lexicoContract.getLevel2subArray(web3.fromAscii('AI'), web3.fromAscii('de6'))

    assert.equal(
      answer_de6.includes(web3.fromAscii('c')),
      true,
      'should be inside',
    );

    answer_de5 = await lexicoContract.getLevel2subArray(web3.fromAscii('AI'), web3.fromAscii('de5'))

    assert.equal(
      answer_de5.includes(web3.fromAscii('p')),
      true,
      'should be inside',
    );

    assert.equal(
      answer_de5.includes(web3.fromAscii('n')),
      false,
      'should not be inside',
    );

  });


  it("Test AL", async () => {

    await insertCountry(alCode, ALtree, lexicoContract)

    answer_srm = await lexicoContract.getLevel2subArray(web3.fromAscii('AL'), web3.fromAscii('srm'))

    assert.equal(
      answer_srm.includes(web3.fromAscii('c')),
      true,
      'should be inside',
    );

    answer_srp = await lexicoContract.getLevel2subArray(web3.fromAscii('AL'), web3.fromAscii('srp'))

    assert.equal(
      answer_srp.includes(web3.fromAscii('p')),
      false,
      'should not be inside',
    );

    answer_srn = await lexicoContract.getLevel2subArray(web3.fromAscii('AL'), web3.fromAscii('srn'))

    assert.equal(
      answer_srn.includes(web3.fromAscii('s')),
      true,
      'should be inside',
    );

  });



    it("Test AM", async () => {

      await insertCountry(amCode, AMtree, lexicoContract)

      answer_szp = await lexicoContract.getLevel2subArray(web3.fromAscii('AM'), web3.fromAscii('szp'))

      assert.equal(
        answer_szp.includes(web3.fromAscii('j')),
        true,
        'should be inside',
      );

      answer_szn = await lexicoContract.getLevel2subArray(web3.fromAscii('AM'), web3.fromAscii('szn'))

      assert.equal(
        answer_srp.includes(web3.fromAscii('u')),
        false,
        'should not be inside',
      );

      answer_tp0 = await lexicoContract.getLevel2subArray(web3.fromAscii('AM'), web3.fromAscii('tp0'))

      assert.equal(
        answer_tp0.includes(web3.fromAscii('v')),
        false,
        'should not be inside',
      );


  });



});
