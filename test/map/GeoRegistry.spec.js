/* eslint-env mocha */
/* global artifacts, contract, web3, assert */
/* eslint-disable max-len, no-await-in-loop, guard-for-in, no-restricted-syntax */

const path = require('path');
const ethUtil = require('ethereumjs-util');
const bignum = require('bignum');
const pretty = require('pretty-time');
const { getAccounts, addNumberDots } = require('../utils');

const GeoRegistry = artifacts.require('GeoRegistry.sol');

const toLevel3Bits = (chars) => {
  let res = bignum('0');
  chars.forEach((char) => {
    switch (char) {
      case 'v': res = res.or('2147483648'); break;
      case 'y': res = res.or('1073741824'); break;
      case 'z': res = res.or('536870912'); break;
      case 'b': res = res.or('268435456'); break;
      case 'c': res = res.or('134217728'); break;
      case 'f': res = res.or('67108864'); break;
      case 'g': res = res.or('33554432'); break;
      case 'u': res = res.or('16777216'); break;
      case 't': res = res.or('8388608'); break;
      case 'w': res = res.or('4194304'); break;
      case 'x': res = res.or('2097152'); break;
      case '8': res = res.or('1048576'); break;
      case '9': res = res.or('524288'); break;
      case 'd': res = res.or('262144'); break;
      case 'e': res = res.or('131072'); break;
      case 's': res = res.or('65536'); break;
      case 'm': res = res.or('32768'); break;
      case 'q': res = res.or('16384'); break;
      case 'r': res = res.or('8192'); break;
      case '2': res = res.or('4096'); break;
      case '3': res = res.or('2048'); break;
      case '6': res = res.or('1024'); break;
      case '7': res = res.or('512'); break;
      case 'k': res = res.or('256'); break;
      case 'j': res = res.or('128'); break;
      case 'n': res = res.or('64'); break;
      case 'p': res = res.or('32'); break;
      case '0': res = res.or('16'); break;
      case '1': res = res.or('8'); break;
      case '4': res = res.or('4'); break;
      case '5': res = res.or('2'); break;
      case 'h': res = res.or('1'); break;
      default: throw new Error(`unknown geohash char ${char}`);
    }
  });
  return ethUtil.bufferToHex(ethUtil.setLengthLeft(res.toNumber(), 4));
};

const BATCH_SIZE = 300;

const addBatch = async (geoRegistryContract, countryCode, countryMap, allKeys, level, startIdx) => {
  const keys = allKeys.slice(startIdx, startIdx + BATCH_SIZE);
  const values = keys.map(key => countryMap[key]);
  const receipt = await geoRegistryContract[`updateLevel${level}batch`](web3.fromAscii(countryCode), keys.map(web3.fromAscii), values);
  return receipt.receipt.gasUsed;
};

const addCountry = async (geoRegistryContract, countryCode, countryMap) => {
  const keysPerLevel = Object.keys(countryMap).reduce((memo, key) => {
    const level = key.length - 1;
    memo[level] = [...(memo[level] || []), key]; // eslint-disable-line no-param-reassign
    return memo;
  }, []);

  let gasCost = 0;
  let txCount = 0;

  for (let level = 0; level < 3; level += 1) {
    for (let batchStartIdx = 0; batchStartIdx < keysPerLevel[level].length; batchStartIdx += BATCH_SIZE) {
      gasCost += await addBatch(geoRegistryContract, countryCode, countryMap, keysPerLevel[level], level, batchStartIdx); // eslint-disable-line no-await-in-loop
      txCount += 1;
    }
  }

  return { gasCost, txCount };
};

const toCountryMap = (countryFile) => {
  const countryMap = {};
  for (const level0char in countryFile) {
    countryMap[`${level0char}`] = toLevel3Bits(Object.keys(countryFile[level0char]));
    for (const level1char in countryFile[level0char]) {
      countryMap[`${level0char}${level1char}`] = toLevel3Bits(Object.keys(countryFile[level0char][level1char]));
      for (const level2char in countryFile[level0char][level1char]) {
        countryMap[`${level0char}${level1char}${level2char}`] = toLevel3Bits(Object.keys(countryFile[level0char][level1char][level2char]));
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

contract.only('GeoRegistry', () => {
  let owner;
  let geoRegistryContract;
  let timerStart;
  before(async () => {
    ([owner] = await getAccounts());
    timerStart = process.hrtime();
  });

  beforeEach(async () => {
    geoRegistryContract = await GeoRegistry.new({ from: owner });
  });

  const results = [];
  let totalGasCost = 0;
  let totalTxCount = 0;

  after(() => {
    const time = process.hrtime(timerStart);
    console.log(`total time: ${pretty(time, 'ms')}`);
    console.log(`total gas cost: ${addNumberDots(totalGasCost)}`);
    console.log(`total tx count: ${addNumberDots(totalTxCount)}\n`);
    results.sort((a, b) => b.gasCost - a.gasCost).forEach((item) => {
      console.log(`country:${item.countryCode} gas:${addNumberDots(item.gasCost)} txs:${item.txCount} time:${item.time}`);
    });
  });

  describe(`add all countries in batches (max batch size = ${BATCH_SIZE})`, () => {
    countriesToTest.forEach((countryCode) => {
      it(`successfully adds country ${countryCode}`, async () => {
        const countryFile = require(path.join(__dirname, '..', '..', 'data', 'trees_countries', countryCode)); // eslint-disable-line
        const countryMap = toCountryMap(countryFile);
        const countryTimerStart = process.hrtime();
        const { gasCost, txCount } = await addCountry(geoRegistryContract, countryCode, countryMap);
        const time = process.hrtime(countryTimerStart);
        results.push({ countryCode, gasCost, txCount, time: pretty(time, 'ms') }); // eslint-disable-line
        totalGasCost += gasCost;
        totalTxCount += txCount;
        for (const key in countryMap) {
          const onchainContent = await geoRegistryContract[`level_${key.length - 1}`](web3.fromAscii(countryCode), web3.fromAscii(key));
          assert.deepStrictEqual(onchainContent, countryMap[key], `level${key.length - 1} content for key ${key} does not match expected`);
        }
      });
    });
  });

  it('zoneInsideCountry returns correct result', async () => {
    const countryCode = 'CG';
    const countryFile = require(path.join(__dirname, '..', '..', 'data', 'trees_countries', countryCode)); // eslint-disable-line
    const countryMap = toCountryMap(countryFile);
    await addCountry(geoRegistryContract, countryCode, countryMap);
    const countryCodeBytes = web3.fromAscii(countryCode);

    assert.equal(
      await geoRegistryContract.zoneInsideCountry(countryCodeBytes, web3.fromAscii('kr0ttse')),
      true,
      'should be inside',
    );

    assert.equal(
      await geoRegistryContract.zoneInsideCountry(countryCodeBytes, web3.fromAscii('krrrrrr')),
      false,
      'should not be inside',
    );

    assert.equal(
      await geoRegistryContract.zoneInsideCountry(countryCodeBytes, web3.fromAscii('kr0ttes')),
      true,
      'should not be inside',
    );

    assert.equal(
      await geoRegistryContract.zoneInsideCountry(countryCodeBytes, web3.fromAscii('kqgtg75')),
      false,
      'should not be inside',
    );
  });
});
