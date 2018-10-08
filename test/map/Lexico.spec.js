/* eslint-env mocha */
/* global artifacts, contract, web3, assert */
/* eslint-disable max-len, no-restricted-syntax, guard-for-in, no-await-in-loop */

const path = require('path');
const { getAccounts } = require('../utils');

const Lexico = artifacts.require('Lexico.sol');

const addCountry = async (lexicoContract, countryCode, countryMap) => {
  let gasCost = 0;
  for (const key in countryMap) {
    let fn;
    switch (key.length) {
      case 1: fn = lexicoContract.updateLevel0; break;
      case 2: fn = lexicoContract.updateLevel1; break;
      case 3: fn = lexicoContract.updateLevel2; break;
      default: throw new Error(`unknown country level key ${key}`);
    }
    // console.log(`adding ${key}: ${countryMap[key]}`);
    const receipt = await fn(web3.fromAscii(countryCode), web3.fromAscii(key), countryMap[key].map(web3.fromAscii));
    gasCost += receipt.receipt.gasUsed;
  }
  return gasCost;
};

const toCountryMap = (countryFile) => {
  const countryMap = {};
  for (const level0char in countryFile) {
    countryMap[`${level0char}`] = Object.keys(countryFile[level0char]);
    for (const level1char in countryFile[level0char]) {
      countryMap[`${level0char}${level1char}`] = Object.keys(countryFile[level0char][level1char]);
      for (const level2char in countryFile[level0char][level1char]) {
        countryMap[`${level0char}${level1char}${level2char}`] = Object.keys(countryFile[level0char][level1char][level2char]);
      }
    }
  }
  return countryMap;
};

const countriesToTest = [
  'AD',
  'AE',
  'AF',
  'AG',
  'AI',
  'AL',
  'AM',
  'AO',
  'AR',
  'AS',
  'AT',
  'AU',
  'AW',
  'AX',
  'AZ',
  'BA',
  'BB',
  'BD',
  'BE',
  'BF',
  'BG',
  'BH',
  'BI',
  'BJ',
  'BL',
  'BM',
  'BN',
  'BO',
  'BR',
  'BS',
  'BT',
  'BW',
  'BY',
  'BZ',
  'CA',
  'CD',
  'CF',
  'CG',
  'CH',
  'CI',
  'CK',
  'CL',
  'CM',
  'CN',
  'CO',
  'CR',
  'CU',
  'CV',
  'CW',
  'CY',
  'CZ',
  'DE',
  'DJ',
  'DK',
  'DM',
  'DO',
  'DZ',
  'EC',
  'EE',
  'EG',
  'EH',
  'ER',
  'ES',
  'ET',
  'FI',
  'FJ',
  'FK',
  'FM',
  'FO',
  'GA',
  'GB',
  'GD',
  'GE',
  'GG',
  'GH',
  'GI',
  'GL',
  'GM',
  'GN',
  'GQ',
  'GR',
  'GS',
  'GT',
  'GU',
  'GW',
  'GY',
  'HK',
  'HM',
  'HN',
  'HR',
  'HT',
  'HU',
  'ID',
  'IE',
  'IL',
  'IM',
  'IN',
  'IO',
  'IQ',
  'IR',
  'IS',
  'IT',
  'JE',
  'JM',
  'JO',
  'JP',
  'KE',
  'KG',
  'KH',
  'KI',
  'KM',
  'KN',
  'KP',
  'KR',
  'KW',
  'KY',
  'KZ',
  'LA',
  'LB',
  'LC',
  'LI',
  'LK',
  'LR',
  'LS',
  'LT',
  'LU',
  'LV',
  'LY',
  'MA',
  'MC',
  'MD',
  'ME',
  'MF',
  'MG',
  'MH',
  'MK',
  'ML',
  'MM',
  'MN',
  'MO',
  'MP',
  'MR',
  'MS',
  'MT',
  'MU',
  'MV',
  'MW',
  'MX',
  'MY',
  'MZ',
  'NA',
  'NC',
  'NE',
  'NF',
  'NG',
  'NI',
  'NL',
  'NP',
  'NR',
  'NU',
  'NZ',
  'OM',
  'PA',
  'PE',
  'PF',
  'PG',
  'PH',
  'PK',
  'PL',
  'PM',
  'PN',
  'PR',
  'PS',
  'PT',
  'PW',
  'PY',
  'QA',
  'RO',
  'RS',
  'RU',
  'RW',
  'SA',
  'SB',
  'SC',
  'SD',
  'SE',
  'SG',
  'SH',
  'SI',
  'SK',
  'SL',
  'SM',
  'SN',
  'SO',
  'SR',
  'SS',
  'ST',
  'SV',
  'SX',
  'SY',
  'SZ',
  'TC',
  'TD',
  'TF',
  'TG',
  'TH',
  'TJ',
  'TL',
  'TM',
  'TN',
  'TO',
  'TR',
  'TT',
  'TV',
  'TW',
  'TZ',
  'UA',
  'UG',
  'UM',
  'US',
  'UY',
  'UZ',
  'VA',
  'VC',
  'VE',
  'VG',
  'VI',
  'VN',
  'VU',
  'WF',
  'WS',
  'YE',
  'ZA',
  'ZM',
  'ZW',
];

contract('Lexico', () => {
  let owner;
  let lexicoContract;

  before(async () => {
    ([owner] = await getAccounts());
  });

  // Deployment of the congo : will be accessible in all tests
  beforeEach(async () => {
    lexicoContract = await Lexico.new({ from: owner });
  });

  const gasResult = [];

  after(() => {
    gasResult.sort((a, b) => b[1] - a[1]).forEach((item) => {
      console.log(`${item[1]} ${item[0]}`);
    });
  });

  // add all country codes that you want to test here
  countriesToTest.forEach((countryCode) => {
    it.only(`successfully adds country ${countryCode}`, async () => {
      const countryFile = require(path.join(__dirname, '..', '..', 'data', 'trees_countries', countryCode)); // eslint-disable-line
      const countryMap = toCountryMap(countryFile);
      const gasCost = await addCountry(lexicoContract, countryCode, countryMap);
      // console.log(`gas cost to deploy country ${countryCode} = ${gasCost}`);
      gasResult.push([countryCode, gasCost]);
      // for (const key in countryMap) {
      //   // console.log(key, web3.fromAscii(countryCode), web3.fromAscii(key));
      //   let onchainContent;
      //   switch (key.length) {
      //     case 1: onchainContent = await lexicoContract.getLevel0subArray(web3.fromAscii(countryCode), web3.fromAscii(key)); break;
      //     case 2: onchainContent = await lexicoContract.getLevel1subArray(web3.fromAscii(countryCode), web3.fromAscii(key)); break;
      //     case 3: onchainContent = await lexicoContract.getLevel2subArray(web3.fromAscii(countryCode), web3.fromAscii(key)); break;
      //     default: throw new Error(`unknown country level key ${key}`);
      //   }
      //   // console.log('here');
      //   assert.deepStrictEqual(onchainContent.map(web3.toAscii), countryMap[key], `level${key.length - 1} content for key ${key} not matches expected`);
      // }
    });
  });

  it('byteInsideArray returns correct result', async () => {
    const byteArray = ['a', 'j', 'u'].map(web3.fromAscii);
    await lexicoContract.updateLevel0(web3.fromAscii('XX'), web3.fromAscii('x'), byteArray);

    const result1 = await lexicoContract.byteInsideArray(web3.fromAscii('a'), byteArray);
    assert(result1 === true, 'byteInsideArray should have returned true');

    const result2 = await lexicoContract.byteInsideArray(web3.fromAscii('j'), byteArray);
    assert(result2 === true, 'byteInsideArray should have returned true');

    const result3 = await lexicoContract.byteInsideArray(web3.fromAscii('u'), byteArray);
    assert(result3 === true, 'byteInsideArray should have returned true');

    const result4 = await lexicoContract.byteInsideArray(web3.fromAscii('p'), byteArray);
    assert(result4 === false, 'byteInsideArray should have returned false');

    const result5 = await lexicoContract.byteInsideArray(web3.fromAscii('p'), []);
    assert(result5 === false, 'byteInsideArray should have returned false');
  });

  it('toBytes3 returns correct result', async () => {
    const asciiStr = 'ajuxbts';
    const result1 = await lexicoContract.toBytes3(web3.fromAscii(asciiStr));
    assert.equal(result1, web3.fromAscii(asciiStr.slice(0, 3)), 'toBytes3 returned incorrect result');
  });

  it('get4thBye returns correct result', async () => {
    const result1 = await lexicoContract.get4thByte(web3.fromAscii('kr0ttse'));
    assert.equal(result1, '0x74', 'get4thByte returned incorrect result');
  });

  it('zoneInsideCountry returns correct result', async () => {
    const countryCode = 'CG';
    const countryFile = require(path.join(__dirname, '..', '..', 'data', 'trees_countries', countryCode)); // eslint-disable-line
    const countryMap = toCountryMap(countryFile);
    await addCountry(lexicoContract, countryCode, countryMap);
    const countryCodeBytes = web3.fromAscii(countryCode);

    assert.equal(
      await lexicoContract.zoneInsideCountry(countryCodeBytes, web3.fromAscii('kr0ttse')),
      true,
      'should be inside',
    );

    assert.equal(
      await lexicoContract.zoneInsideCountry(countryCodeBytes, web3.fromAscii('krrrrrr')),
      false,
      'should not be inside',
    );

    assert.equal(
      await lexicoContract.zoneInsideCountry(countryCodeBytes, web3.fromAscii('kr0ttes')),
      true,
      'should not be inside',
    );

    assert.equal(
      await lexicoContract.zoneInsideCountry(countryCodeBytes, web3.fromAscii('kqgtg75')),
      false,
      'should not be inside',
    );
  });
});
