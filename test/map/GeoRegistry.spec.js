/* eslint-env mocha */
/* global artifacts, contract, assert */
/* eslint-disable max-len, no-await-in-loop, guard-for-in, no-restricted-syntax, object-curly-newline */

const path = require('path');
const pretty = require('pretty-time');
const Web3 = require('web3');

const { addNumberDots } = require('../utils/output');
const { getAccounts } = require('../utils/accounts');
const { addCountry } = require('../utils/geo');
const { expectRevert, expectRevert2 } = require('../utils/evmErrors');


const Control = artifacts.require('Control.sol');
const GeoRegistry = artifacts.require('GeoRegistry.sol');

const BATCH_SIZE = 300;

const web3 = new Web3('http://localhost:8545');

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
  'FR',
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
  'NO',
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

contract('GeoRegistry', () => {
  let owner;

  let controlInstance;
  let geoRegistryContract;

  let timerStart;

  before(async () => {
    ([owner] = await getAccounts(web3));
    timerStart = process.hrtime();
  });

  beforeEach(async () => {
    controlInstance = await Control.new({ from: owner });
    geoRegistryContract = await GeoRegistry.new(controlInstance.address, { from: owner });
  });

  const results = [];
  let totalGasCost = 0;
  let totalTxCount = 0;

  after(() => {
    const time = process.hrtime(timerStart);
    console.log(`total time: ${pretty(time, 'ms')}`);
    console.log(`total gas cost: ${addNumberDots(totalGasCost)}`);
    console.log(`total tx count: ${addNumberDots(totalTxCount)}`);
    console.log(`max batch size: ${BATCH_SIZE}\n`);
    results.sort((a, b) => b.countryGasCost - a.countryGasCost).forEach((item) => {
      console.log(`country:${item.countryCode} gas:${addNumberDots(item.countryGasCost)} txs:${item.txCount} time:${item.time} mostExpensiveTrx:${addNumberDots(item.mostExpensiveTrxGasCost)}`);
    });
  });

  describe(`add all countries in batches (max batch size = ${BATCH_SIZE})`, () => {
    ['NL'].forEach((countryCode) => {
      it(`successfully adds country ${countryCode}`, async () => {
        const countryTimerStart = process.hrtime();
        const { countryGasCost, mostExpensiveTrxGasCost, txCount, countryMap } = await addCountry(owner, web3, geoRegistryContract, countryCode, BATCH_SIZE);
        const time = process.hrtime(countryTimerStart);
        results.push({ countryCode, countryGasCost, mostExpensiveTrxGasCost, txCount, time: pretty(time, 'ms') }); // eslint-disable-line
        totalGasCost += countryGasCost;
        totalTxCount += txCount;
        for (const key in countryMap) {
          const onchainContent = await geoRegistryContract.level_2(web3.utils.asciiToHex(countryCode), web3.utils.asciiToHex(key));
          assert.deepStrictEqual(onchainContent, countryMap[key], `content for key ${key} does not match expected`);
        }
      });
    });
  });

  it('zoneInsideCountry returns correct result', async () => {
    const countryCode = 'CG';
    const countryFile = require(path.join(__dirname, '..', '..', 'data', 'trees_countries', countryCode)); // eslint-disable-line
    await addCountry(owner, web3, geoRegistryContract, countryCode, BATCH_SIZE);
    const countryCodeBytes = web3.utils.asciiToHex(countryCode);
    await geoRegistryContract.endInit(countryCodeBytes);
    assert.equal(
      await geoRegistryContract.zoneInsideCountry(countryCodeBytes, web3.utils.asciiToHex('kr0ttse')),
      true,
      'should be inside',
    );

    assert.equal(
      await geoRegistryContract.zoneInsideCountry(countryCodeBytes, web3.utils.asciiToHex('krrrrrr')),
      false,
      'should not be inside',
    );

    assert.equal(
      await geoRegistryContract.zoneInsideCountry(countryCodeBytes, web3.utils.asciiToHex('kr0ttes')),
      true,
      'should not be inside',
    );

    assert.equal(
      await geoRegistryContract.zoneInsideCountry(countryCodeBytes, web3.utils.asciiToHex('kqgtg75')),
      false,
      'should not be inside',
    );
  });

  it.only('impossible to add new geohash to already filled up country', async () => {
    const countryCode = 'CG';
    const countryFile = require(path.join(__dirname, '..', '..', 'data', 'trees_countries', countryCode)); // eslint-disable-line
    await addCountry(owner, web3, geoRegistryContract, countryCode, BATCH_SIZE);
    const countryCodeBytes = web3.utils.asciiToHex(countryCode);
    await addCountry(owner, web3, geoRegistryContract, countryCode, BATCH_SIZE); // possible to add more geohash in an not filled country

    await geoRegistryContract.endInit(countryCodeBytes);

    // should be now impossible to add new one in this countryCode
    try {
      await addCountry(owner, web3, geoRegistryContract, countryCode, BATCH_SIZE)
    } catch (err) {
      if (!err.message.includes('country must not be filled'))
        throw err;
      return;
    }
    throw 'should have thrown';
  });


});
