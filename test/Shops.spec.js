/* eslint-env mocha */
/* global artifacts, contract, expect */
/* eslint-disable max-len, no-multi-spaces, object-curly-newline */

const DetherToken = artifacts.require('DetherToken');
const CertifierRegistry = artifacts.require('CertifierRegistry');
const Users = artifacts.require('Users');
const GeoRegistry = artifacts.require('GeoRegistry');
const Shops = artifacts.require('Shops');
const ShopsDispute = artifacts.require('ShopsDispute');
const AppealableArbitrator = artifacts.require('AppealableArbitrator');
const CentralizedArbitrator = artifacts.require('CentralizedArbitrator');
const ZoneFactory = artifacts.require('ZoneFactory');
const Zone = artifacts.require('Zone');
const Teller = artifacts.require('Teller');
const TaxCollector = artifacts.require('TaxCollector');

const Web3 = require('web3');
const truffleAssert = require('truffle-assertions');
const BN = require('bignumber.js');

const expect = require('./utils/chai');
const TimeTravel = require('./utils/timeTravel');
const { addCountry } = require('./utils/geo');
const { expectRevert, expectRevert2 } = require('./utils/evmErrors');
const { ethToWei, asciiToHex, remove0x } = require('./utils/convert');
const {
    BYTES16_ZERO, BYTES32_ZERO, COUNTRY_CG, VALID_CG_ZONE_GEOHASH, VALID_CG_SHOP_GEOHASH,
    VALID_CG_SHOP_GEOHASH_2, VALID_CG_SHOP_GEOHASH_3, INVALID_CG_SHOP_GEOHASH, NONEXISTING_CG_SHOP_GEOHASH,
    CG_SHOP_LICENSE_PRICE, KLEROS_ARBITRATION_PRICE, ADDRESS_ZERO, KLEROS_DISPUTE_TIMEOUT,
    KLEROS_ARBITRATOR_EXTRADATA, KLEROS_SHOP_WINS, KLEROS_CHALLENGER_WINS, KLEROS_NO_RULING,
    MIN_ZONE_DTH_STAKE, ONE_WEEK_IN_SEC, VALID_CG_SHOP_GEOHASH_4, ONE_DAY_IN_SEC
} = require('./utils/values');

const web3 = new Web3('http://localhost:8545');
const timeTravel = new TimeTravel(web3);

const createDthShopCreateDataBytes = (fnByte, shopData) => (
    `${fnByte}${Object.keys(shopData).map(k => remove0x(shopData[k])).join('')}`
);
// zoning creation helpers
const createDthZoneCreateDataWithTier = (zoneFactoryAddr, bid, countryCode, geohash) => {
    const fnSig = web3.eth.abi.encodeFunctionSignature('transfer(address,uint256,bytes)');
    const params = web3.eth.abi.encodeParameters(
        ['address', 'uint256', 'bytes'],
        [zoneFactoryAddr, ethToWei(bid), `0x${countryCode.slice(2)}${geohash.slice(2)}`],
    );
    return [fnSig, params.slice(2)].join('');
};
//
const createDthShopCreateData = (shopsAddr, dthAmount, shopData, fnByte) => {
    const fnSig = web3.eth.abi.encodeFunctionSignature('transfer(address,uint256,bytes)');
    const data = createDthShopCreateDataBytes(fnByte, shopData);
    const params = web3.eth.abi.encodeParameters(
        ['address', 'uint256', 'bytes'],
        [shopsAddr, ethToWei(dthAmount), data],
    );
    return [fnSig, params.slice(2)].join('');
};

const sendDthShopCreate = async (from, to, recipient, dthAmount, shopData, fnByte = '0x30') => {
    const tx = await web3.eth.sendTransaction({
        from,
        to,
        data: createDthShopCreateData(recipient, dthAmount, shopData, fnByte),
        value: 0,
        gas: 4700000,
    });
    return tx;
};

const calcShopTax = async (start, end, licencePrice, taxRates, staked) => {
    const tax = new BN(Number(licencePrice)).times(Number(end) - Number(start)).dividedBy(taxRates).dividedBy(86400);
    const stakedBn = new BN(Number(staked));
    if (tax.gt(Number(staked))) {
        return stakedBn;
    } else {
        console.log('staked gt than tax');
        return tax;
    }
}

contract('Shops', (accounts) => {
    let owner, user1, user2, user3, user4, user5; // eslint-disable-line

    let __rootState__; // eslint-disable-line no-underscore-dangle

    let dthInstance;
    let usersInstance;
    let geoInstance;
    let shopsInstance;
    let shopsDisputeInstance;
    let appealableArbitratorInstance;
    let centralizedArbitratorInstance;
    let certifierRegistryInstance;
    let zoneImplementationInstance;
    let tellerImplementationInstance;
    let taxCollectorInstance;


    before(async () => {
        __rootState__ = await timeTravel.saveState();
        ([owner, user1, user2, user3, user4, user5] = accounts);
    });

    beforeEach(async () => {
        await timeTravel.revertState(__rootState__); // to go back to real time
        dthInstance = await DetherToken.new({ from: owner });
        taxCollectorInstance = await TaxCollector.new(dthInstance.address, ADDRESS_ZERO, { from: owner })

        certifierRegistryInstance = await CertifierRegistry.new({ from: owner });

        zoneImplementationInstance = await Zone.new({ from: owner });
        tellerImplementationInstance = await Teller.new({ from: owner });

        geoInstance = await GeoRegistry.new({ from: owner });

        usersInstance = await Users.new(
            geoInstance.address,
            certifierRegistryInstance.address,
            { from: owner },
        );


        centralizedArbitratorInstance = await CentralizedArbitrator.new(
            ethToWei(KLEROS_ARBITRATION_PRICE),
            { from: owner },
        );

        appealableArbitratorInstance = await AppealableArbitrator.new(
            ethToWei(KLEROS_ARBITRATION_PRICE),
            centralizedArbitratorInstance.address,
            KLEROS_ARBITRATOR_EXTRADATA,
            KLEROS_DISPUTE_TIMEOUT,
            { from: owner },
        );

        await appealableArbitratorInstance.changeArbitrator(appealableArbitratorInstance.address, { from: owner });
        zoneFactoryInstance = await ZoneFactory.new(
            dthInstance.address,
            geoInstance.address,
            usersInstance.address,
            zoneImplementationInstance.address,
            tellerImplementationInstance.address,
            taxCollectorInstance.address,
            { from: owner },
        );

        shopsInstance = await Shops.new(
            dthInstance.address,
            geoInstance.address,
            usersInstance.address,
            zoneFactoryInstance.address,
            { from: owner },
        );

        // shopsDisputeInstance = await ShopsDispute.new(
        //     shopsInstance.address,
        //     usersInstance.address,
        //     appealableArbitratorInstance.address,
        //     KLEROS_ARBITRATOR_EXTRADATA,
        //     { from: owner },
        // );
        await usersInstance.setZoneFactory(zoneFactoryInstance.address, { from: owner });

        // await shopsInstance.setShopsDisputeContract(shopsDisputeInstance.address, { from: owner });
    });

    const createZone = async (from, dthAmount, countryCode, geohash) => {
        await dthInstance.mint(from, ethToWei(dthAmount), { from: owner });
        const txCreate = await web3.eth.sendTransaction({
            from,
            to: dthInstance.address,
            data: createDthZoneCreateDataWithTier(zoneFactoryInstance.address, dthAmount, asciiToHex(countryCode), asciiToHex(geohash)),
            value: 0,
            gas: 4700000,
        });
        const zoneAddress = await zoneFactoryInstance.geohashToZone(asciiToHex(geohash));
        const zoneInstance = await Zone.at(zoneAddress);
        const tellerAddress = await zoneInstance.teller();
        const tellerInstance = await Teller.at(tellerAddress);
        return { zoneInstance, tellerInstance };
    };

    const enableAndLoadCountry = async (countryCode) => {
        await addCountry(owner, web3, geoInstance, countryCode, 300);
    };

    describe('Setters', () => {
        describe('addShop(bytes2 _countryCode, bytes _position, bytes16 _category, bytes16 _name, bytes32 _description, bytes16 _opening)', () => {
            it('[error] -- can only be called by dth contract', async () => {
                await enableAndLoadCountry(COUNTRY_CG);

                await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
                const addShopData = createDthShopCreateDataBytes('0x30', {
                    country: asciiToHex(COUNTRY_CG),
                    position: asciiToHex(VALID_CG_SHOP_GEOHASH),
                    category: BYTES16_ZERO,
                    name: BYTES16_ZERO,
                    description: BYTES32_ZERO,
                    opening: BYTES16_ZERO,
                });
                await expectRevert(
                    shopsInstance.tokenFallback(user1, ethToWei(CG_SHOP_LICENSE_PRICE), addShopData, { from: user1 }),
                    'can only be called by dth contract',
                );
            });
            it('[error] -- bytes arg does not have length 95', async () => {
                await enableAndLoadCountry(COUNTRY_CG);

                await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
                await expectRevert2(
                    sendDthShopCreate(
                        user1, dthInstance.address, shopsInstance.address,
                        CG_SHOP_LICENSE_PRICE,
                        {
                            country: asciiToHex(COUNTRY_CG),
                            position: asciiToHex(VALID_CG_SHOP_GEOHASH),
                            category: BYTES16_ZERO,
                            name: BYTES32_ZERO, // <-- should be bytes16(0)
                            description: BYTES32_ZERO,
                            opening: BYTES16_ZERO,
                        },
                    ),
                    'addShop expects 95 bytes as data',
                );
            });
            it('[error] -- first byte is not 0x30', async () => {

                await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
                await expectRevert2(
                    sendDthShopCreate(
                        user1, dthInstance.address, shopsInstance.address,
                        CG_SHOP_LICENSE_PRICE,
                        {
                            country: asciiToHex(COUNTRY_CG),
                            position: asciiToHex(VALID_CG_SHOP_GEOHASH),
                            category: BYTES16_ZERO,
                            name: BYTES16_ZERO,
                            description: BYTES32_ZERO,
                            opening: BYTES16_ZERO,
                        },
                        '0x99', // <-- incorrect fn byte, should be 0x30
                    ),
                    'first byte didnt match func shop',
                );
            });
            it('[error] -- country disabled', async () => {

                await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
                await expectRevert2(
                    sendDthShopCreate(
                        user1, dthInstance.address, shopsInstance.address,
                        CG_SHOP_LICENSE_PRICE,
                        {
                            country: asciiToHex(COUNTRY_CG),
                            position: asciiToHex(VALID_CG_SHOP_GEOHASH),
                            category: BYTES16_ZERO,
                            name: BYTES16_ZERO,
                            description: BYTES32_ZERO,
                            opening: BYTES16_ZERO,
                        },
                    ),
                    'country is disabled',
                );
            });
            it('[error] -- user already has shop', async () => {
                await enableAndLoadCountry(COUNTRY_CG);


                await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
                await sendDthShopCreate(
                    user1, dthInstance.address, shopsInstance.address,
                    CG_SHOP_LICENSE_PRICE,
                    {
                        country: asciiToHex(COUNTRY_CG),
                        position: asciiToHex(VALID_CG_SHOP_GEOHASH),
                        category: BYTES16_ZERO,
                        name: BYTES16_ZERO,
                        description: BYTES32_ZERO,
                        opening: BYTES16_ZERO,
                    },
                );

                await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
                await expectRevert2(
                    sendDthShopCreate(
                        user1, dthInstance.address, shopsInstance.address,
                        CG_SHOP_LICENSE_PRICE,
                        {
                            country: asciiToHex(COUNTRY_CG),
                            position: asciiToHex(VALID_CG_SHOP_GEOHASH_2),
                            category: BYTES16_ZERO,
                            name: BYTES16_ZERO,
                            description: BYTES32_ZERO,
                            opening: BYTES16_ZERO,
                        },
                    ),
                    'caller already has shop',
                );
            });
            it('[error] -- there already is a shop at this geohash12', async () => {
                await enableAndLoadCountry(COUNTRY_CG);


                await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
                await sendDthShopCreate(
                    user1, dthInstance.address, shopsInstance.address,
                    CG_SHOP_LICENSE_PRICE,
                    {
                        country: asciiToHex(COUNTRY_CG),
                        position: asciiToHex(VALID_CG_SHOP_GEOHASH),
                        category: BYTES16_ZERO,
                        name: BYTES16_ZERO,
                        description: BYTES32_ZERO,
                        opening: BYTES16_ZERO,
                    },
                );


                await dthInstance.mint(user2, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
                await expectRevert2(
                    sendDthShopCreate(
                        user2, dthInstance.address, shopsInstance.address,
                        CG_SHOP_LICENSE_PRICE,
                        {
                            country: asciiToHex(COUNTRY_CG),
                            position: asciiToHex(VALID_CG_SHOP_GEOHASH),
                            category: BYTES16_ZERO,
                            name: BYTES16_ZERO,
                            description: BYTES32_ZERO,
                            opening: BYTES16_ZERO,
                        },
                    ),
                    'shop already exists at position',
                );
            });
            it('[error] -- invalid geohash chars', async () => {
                await enableAndLoadCountry(COUNTRY_CG);

                await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
                await expectRevert2(
                    sendDthShopCreate(
                        user1, dthInstance.address, shopsInstance.address,
                        CG_SHOP_LICENSE_PRICE,
                        {
                            country: asciiToHex(COUNTRY_CG),
                            position: asciiToHex(INVALID_CG_SHOP_GEOHASH),
                            category: BYTES16_ZERO,
                            name: BYTES16_ZERO,
                            description: BYTES32_ZERO,
                            opening: BYTES16_ZERO,
                        },
                    ),
                    'invalid geohash characters in position',
                );
            });
            it('[error] -- zone not inside country', async () => {
                await enableAndLoadCountry(COUNTRY_CG);

                await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
                await expectRevert2(
                    sendDthShopCreate(
                        user1, dthInstance.address, shopsInstance.address,
                        CG_SHOP_LICENSE_PRICE,
                        {
                            country: asciiToHex(COUNTRY_CG),
                            position: asciiToHex(NONEXISTING_CG_SHOP_GEOHASH),
                            category: BYTES16_ZERO,
                            name: BYTES16_ZERO,
                            description: BYTES32_ZERO,
                            opening: BYTES16_ZERO,
                        },
                    ),
                    'zone is not inside country',
                );
            });
            it('[error] -- dth stake less than license price', async () => {
                await enableAndLoadCountry(COUNTRY_CG);

                await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE - 1), { from: owner });
                await expectRevert2(
                    sendDthShopCreate(
                        user1, dthInstance.address, shopsInstance.address,
                        CG_SHOP_LICENSE_PRICE - 1,
                        {
                            country: asciiToHex(COUNTRY_CG),
                            position: asciiToHex(VALID_CG_SHOP_GEOHASH),
                            category: BYTES16_ZERO,
                            name: BYTES16_ZERO,
                            description: BYTES32_ZERO,
                            opening: BYTES16_ZERO,
                        },
                    ),
                    'send dth is less than shop license price',
                );
            });
            it('[success]', async () => {
                await enableAndLoadCountry(COUNTRY_CG);

                await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
                await sendDthShopCreate(
                    user1, dthInstance.address, shopsInstance.address,
                    CG_SHOP_LICENSE_PRICE,
                    {
                        country: asciiToHex(COUNTRY_CG),
                        position: asciiToHex(VALID_CG_SHOP_GEOHASH),
                        category: BYTES16_ZERO,
                        name: BYTES16_ZERO,
                        description: BYTES32_ZERO,
                        opening: BYTES16_ZERO,
                    },
                );
            });
            it('[error] -- dth stake less than license price, with a zone owned and a bigger price', async () => {
                // register zone
                await enableAndLoadCountry(COUNTRY_CG);
                await dthInstance.mint(user2, ethToWei(MIN_ZONE_DTH_STAKE), { from: owner });
                let zoneInstance, tellerInstance;
                ({ zoneInstance, tellerInstance } = await createZone(user2, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_CG_ZONE_GEOHASH));
                const tsx = await shopsInstance.setZoneLicensePrice(asciiToHex(VALID_CG_ZONE_GEOHASH), ethToWei(111), { from: user2 });

                // try the shop registration

                await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE + 1), { from: owner });
                await expectRevert2(
                    sendDthShopCreate(
                        user1, dthInstance.address, shopsInstance.address,
                        CG_SHOP_LICENSE_PRICE + 1,
                        {
                            country: asciiToHex(COUNTRY_CG),
                            position: asciiToHex(VALID_CG_SHOP_GEOHASH),
                            category: BYTES16_ZERO,
                            name: BYTES16_ZERO,
                            description: BYTES32_ZERO,
                            opening: BYTES16_ZERO,
                        },
                    ),
                    'send dth is less than shop license price',
                );
            });
            it('[succes] -- dth stake the good amount of license price, with a zone owned and a bigger price', async () => {
                // register zone
                await enableAndLoadCountry(COUNTRY_CG);
                await dthInstance.mint(user2, ethToWei(MIN_ZONE_DTH_STAKE), { from: owner });
                let zoneInstance, tellerInstance;
                ({ zoneInstance, tellerInstance } = await createZone(user2, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_CG_ZONE_GEOHASH));
                const tsx = await shopsInstance.setZoneLicensePrice(asciiToHex(VALID_CG_ZONE_GEOHASH), ethToWei(111), { from: user2 });

                // try the shop registration

                await dthInstance.mint(user1, ethToWei(111), { from: owner });
                await sendDthShopCreate(
                    user1, dthInstance.address, shopsInstance.address,
                    111,
                    {
                        country: asciiToHex(COUNTRY_CG),
                        position: asciiToHex(VALID_CG_SHOP_GEOHASH),
                        category: BYTES16_ZERO,
                        name: BYTES16_ZERO,
                        description: BYTES32_ZERO,
                        opening: BYTES16_ZERO,
                    },
                )
            });
            it('[error] -- zone modification price - error cases', async () => {
                // register zone
                await enableAndLoadCountry(COUNTRY_CG);
                await dthInstance.mint(user2, ethToWei(MIN_ZONE_DTH_STAKE), { from: owner });
                let zoneInstance, tellerInstance;
                ({ zoneInstance, tellerInstance } = await createZone(user2, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_CG_ZONE_GEOHASH));
                await expectRevert2(
                    shopsInstance.setZoneLicensePrice(asciiToHex(VALID_CG_ZONE_GEOHASH), ethToWei(111), { from: user3 }),
                    'only zone owner can modify the licence price'
                )
                await expectRevert2(
                    shopsInstance.setZoneLicensePrice(asciiToHex(VALID_CG_ZONE_GEOHASH), ethToWei(10), { from: user2 }),
                    'price should be superior to the floor price'
                )
                await expectRevert2(
                    shopsInstance.setZoneLicensePrice(asciiToHex('abcdef'), ethToWei(120), { from: user2 }),
                    'zone is not already owned'
                )
            });
        });
        describe('tax collecting from zone owner', () => {
            it('[succes] -- Zone owner should succeed to collect taxes from shop', async () => {
                // register zone
                await enableAndLoadCountry(COUNTRY_CG);
                await dthInstance.mint(user2, ethToWei(MIN_ZONE_DTH_STAKE), { from: owner });
                let zoneInstance, tellerInstance;
                ({ zoneInstance, tellerInstance } = await createZone(user2, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_CG_ZONE_GEOHASH));
                const tsx = await shopsInstance.setZoneLicensePrice(asciiToHex(VALID_CG_ZONE_GEOHASH), ethToWei(111), { from: user2 });

                // try the shop registration
                // 
                await dthInstance.mint(user1, ethToWei(111), { from: owner });
                await sendDthShopCreate(
                    user1, dthInstance.address, shopsInstance.address,
                    111,
                    {
                        country: asciiToHex(COUNTRY_CG),
                        position: asciiToHex(VALID_CG_SHOP_GEOHASH),
                        category: BYTES16_ZERO,
                        name: asciiToHex('shop111111111111'),
                        description: BYTES32_ZERO,
                        opening: BYTES16_ZERO,
                    },
                );
                let listOfShop = await shopsInstance.getShopAddressesInZone(asciiToHex(VALID_CG_ZONE_GEOHASH));
                expect(listOfShop.length).equals(1);
                await dthInstance.mint(user3, ethToWei(111), { from: owner });
                await sendDthShopCreate(
                    user3, dthInstance.address, shopsInstance.address,
                    111,
                    {
                        country: asciiToHex(COUNTRY_CG),
                        position: asciiToHex(VALID_CG_SHOP_GEOHASH_2),
                        category: BYTES16_ZERO,
                        name: asciiToHex('shop222222222222'),
                        description: BYTES32_ZERO,
                        opening: BYTES16_ZERO,
                    },
                );
                listOfShop = await shopsInstance.getShopAddressesInZone(asciiToHex(VALID_CG_ZONE_GEOHASH));
                await dthInstance.mint(user4, ethToWei(111), { from: owner });
                await sendDthShopCreate(
                    user4, dthInstance.address, shopsInstance.address,
                    111,
                    {
                        country: asciiToHex(COUNTRY_CG),
                        position: asciiToHex(VALID_CG_SHOP_GEOHASH_3),
                        category: BYTES16_ZERO,
                        name: asciiToHex('shop333333333333'),
                        description: BYTES32_ZERO,
                        opening: BYTES16_ZERO,
                    },
                );
                listOfShop = await shopsInstance.getShopAddressesInZone(asciiToHex(VALID_CG_ZONE_GEOHASH));
                expect(listOfShop.length).equals(3);
                // make a trip to the futur
                // await shopsInstance.collectTax(asciiToHex(VALID_CG_ZONE_GEOHASH), 0, listOfShop.length, { from: user2 });
                await timeTravel.inSecs(ONE_WEEK_IN_SEC);
                await shopsInstance.collectTax(asciiToHex(VALID_CG_ZONE_GEOHASH), 0, listOfShop.length, { from: user2 });

            });
            it('[success] -- Zone owner should succeed to collect taxes and delete shop, and tax the good amounts', async () => {
                // register zone
                await enableAndLoadCountry(COUNTRY_CG);
                await dthInstance.mint(user2, ethToWei(MIN_ZONE_DTH_STAKE), { from: owner });
                let zoneInstance, tellerInstance;
                ({ zoneInstance, tellerInstance } = await createZone(user2, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_CG_ZONE_GEOHASH));
                const tsx = await shopsInstance.setZoneLicensePrice(asciiToHex(VALID_CG_ZONE_GEOHASH), ethToWei(111), { from: user2 });
                let timeElapsed = 0;
                const licencePrice = ethToWei(111);
                // try the shop registration
                // 
                await dthInstance.mint(user1, ethToWei(111), { from: owner });
                await sendDthShopCreate(
                    user1, dthInstance.address, shopsInstance.address,
                    111,
                    {
                        country: asciiToHex(COUNTRY_CG),
                        position: asciiToHex(VALID_CG_SHOP_GEOHASH),
                        category: BYTES16_ZERO,
                        name: asciiToHex('shop111111111111'),
                        description: BYTES32_ZERO,
                        opening: BYTES16_ZERO,
                    },
                );
                await dthInstance.mint(user3, ethToWei(111), { from: owner });
                await sendDthShopCreate(
                    user3, dthInstance.address, shopsInstance.address,
                    111,
                    {
                        country: asciiToHex(COUNTRY_CG),
                        position: asciiToHex(VALID_CG_SHOP_GEOHASH_2),
                        category: BYTES16_ZERO,
                        name: asciiToHex('shop222222222222'),
                        description: BYTES32_ZERO,
                        opening: BYTES16_ZERO,
                    },
                );
                await timeTravel.inSecs(ONE_WEEK_IN_SEC * 4);
                timeElapsed += ONE_WEEK_IN_SEC * 4;
                // change price of the licence
                await shopsInstance.setZoneLicensePrice(asciiToHex(VALID_CG_ZONE_GEOHASH), ethToWei(222), { from: user2 });
                await dthInstance.mint(user4, ethToWei(222), { from: owner });
                await sendDthShopCreate(
                    user4, dthInstance.address, shopsInstance.address,
                    222,
                    {
                        country: asciiToHex(COUNTRY_CG),
                        position: asciiToHex(VALID_CG_SHOP_GEOHASH_3),
                        category: BYTES16_ZERO,
                        name: asciiToHex('shop333333333333'),
                        description: BYTES32_ZERO,
                        opening: BYTES16_ZERO,
                    },
                );


                await timeTravel.inSecs(ONE_WEEK_IN_SEC / 2);
                timeElapsed += ONE_WEEK_IN_SEC / 2;
                await dthInstance.mint(user5, ethToWei(222), { from: owner });

                await sendDthShopCreate(
                    user5, dthInstance.address, shopsInstance.address,
                    222,
                    {
                        country: asciiToHex(COUNTRY_CG),
                        position: asciiToHex(VALID_CG_SHOP_GEOHASH_4),
                        category: BYTES16_ZERO,
                        name: asciiToHex('shop444444444444'),
                        description: BYTES32_ZERO,
                        opening: BYTES16_ZERO,
                    },
                );
                let listOfShop = await shopsInstance.getShopAddressesInZone(asciiToHex(VALID_CG_ZONE_GEOHASH));

                // make a trip to the futur
                // await shopsInstance.collectTax(asciiToHex(VALID_CG_ZONE_GEOHASH), 0, listOfShop.length, { from: user2 });
                await timeTravel.inSecs(ONE_WEEK_IN_SEC * 4);
                timeElapsed += ONE_WEEK_IN_SEC * 4;

                const taxRates = Number(await shopsInstance.TAX());

                const shop1 = await shopsInstance.getShopByAddr(user1);
                const shop3 = await shopsInstance.getShopByAddr(user3);
                const shop4 = await shopsInstance.getShopByAddr(user4);
                const shop5 = await shopsInstance.getShopByAddr(user5);
                const timeNow = (await web3.eth.getBlock("latest")).timestamp
                let taxShop1 = await calcShopTax(shop1[8], timeNow, shop1[9], taxRates, shop1[5]);
                let taxShop3 = await calcShopTax(shop3[8], timeNow, shop3[9], taxRates, shop3[5]);
                let taxShop4 = await calcShopTax(shop4[8], timeNow, shop4[9], taxRates, shop4[5]);
                let taxShop5 = await calcShopTax(shop5[8], timeNow, shop5[9], taxRates, shop5[5]);

                const totalTaxShop = new BN(taxShop1).plus(taxShop3).plus(taxShop4).plus(taxShop5);
                // const calcShopTax = async (start, end, licencePrice, taxRates, staked) => {

                // collect taxes
                const taxSendToOwner = await shopsInstance.collectTax(asciiToHex(VALID_CG_ZONE_GEOHASH), 0, listOfShop.length, { from: user2 });

                truffleAssert.eventEmitted(taxSendToOwner, 'TaxTotalPaidTo', (ev) => {
                    const amount = new BN(ev.amount);
                    const dest = ev.address;
                    expect(Number(amount)).equals(Number(totalTaxShop));
                    return true;
                })
                // throw 'error to see event';
            });

            it('[success] -- Zone owner should succeed to collect taxes at different rates', async () => {
                // register zone
                await enableAndLoadCountry(COUNTRY_CG);
                await dthInstance.mint(user2, ethToWei(MIN_ZONE_DTH_STAKE), { from: owner });
                let zoneInstance, tellerInstance;
                ({ zoneInstance, tellerInstance } = await createZone(user2, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_CG_ZONE_GEOHASH));
                const tsx = await shopsInstance.setZoneLicensePrice(asciiToHex(VALID_CG_ZONE_GEOHASH), ethToWei(111), { from: user2 });
                let timeElapsed = 0;
                const licencePrice = ethToWei(111);
                // try the shop registration
                // 
                await dthInstance.mint(user1, ethToWei(111), { from: owner });
                await sendDthShopCreate(
                    user1, dthInstance.address, shopsInstance.address,
                    111,
                    {
                        country: asciiToHex(COUNTRY_CG),
                        position: asciiToHex(VALID_CG_SHOP_GEOHASH),
                        category: BYTES16_ZERO,
                        name: asciiToHex('shop111111111111'),
                        description: BYTES32_ZERO,
                        opening: BYTES16_ZERO,
                    },
                );

                await dthInstance.mint(user3, ethToWei(111), { from: owner });
                await sendDthShopCreate(
                    user3, dthInstance.address, shopsInstance.address,
                    111,
                    {
                        country: asciiToHex(COUNTRY_CG),
                        position: asciiToHex(VALID_CG_SHOP_GEOHASH_2),
                        category: BYTES16_ZERO,
                        name: asciiToHex('shop222222222222'),
                        description: BYTES32_ZERO,
                        opening: BYTES16_ZERO,
                    },
                );
                await timeTravel.inSecs(ONE_WEEK_IN_SEC * 4);
                timeElapsed += ONE_WEEK_IN_SEC * 4;
                await dthInstance.mint(user4, ethToWei(111), { from: owner });
                await sendDthShopCreate(
                    user4, dthInstance.address, shopsInstance.address,
                    111,
                    {
                        country: asciiToHex(COUNTRY_CG),
                        position: asciiToHex(VALID_CG_SHOP_GEOHASH_3),
                        category: BYTES16_ZERO,
                        name: asciiToHex('shop333333333333'),
                        description: BYTES32_ZERO,
                        opening: BYTES16_ZERO,
                    },
                );
                await timeTravel.inSecs(ONE_WEEK_IN_SEC / 2);
                timeElapsed += ONE_WEEK_IN_SEC / 2;

                await dthInstance.mint(user5, ethToWei(111), { from: owner });
                await sendDthShopCreate(
                    user5, dthInstance.address, shopsInstance.address,
                    111,
                    {
                        country: asciiToHex(COUNTRY_CG),
                        position: asciiToHex(VALID_CG_SHOP_GEOHASH_4),
                        category: BYTES16_ZERO,
                        name: asciiToHex('shop444444444444'),
                        description: BYTES32_ZERO,
                        opening: BYTES16_ZERO,
                    },
                );
                let listOfShop = await shopsInstance.getShopAddressesInZone(asciiToHex(VALID_CG_ZONE_GEOHASH));

                // make a trip to the futur
                // await shopsInstance.collectTax(asciiToHex(VALID_CG_ZONE_GEOHASH), 0, listOfShop.length, { from: user2 });
                await timeTravel.inSecs(ONE_WEEK_IN_SEC * 4);
                timeElapsed += ONE_WEEK_IN_SEC * 4;

                const taxRates = Number(await shopsInstance.TAX());

                const timeNow = (await web3.eth.getBlock("latest")).timestamp
                const shop1 = await shopsInstance.getShopByAddr(user1);
                let taxShop1 = await calcShopTax(shop1[8], timeNow, shop1[9], taxRates, shop1[5]);
                const shop3 = await shopsInstance.getShopByAddr(user3);
                let taxShop3 = await calcShopTax(shop3[8], timeNow, shop3[9], taxRates, shop3[5]);

                const shop4 = await shopsInstance.getShopByAddr(user4);
                let taxShop4 = await calcShopTax(shop4[8], timeNow, shop4[9], taxRates, shop4[5]);

                const shop5 = await shopsInstance.getShopByAddr(user5);
                let taxShop5 = await calcShopTax(shop5[8], timeNow, shop5[9], taxRates, shop5[5]);

                const totalTaxShop = new BN(taxShop1).plus(taxShop3).plus(taxShop4).plus(taxShop5);
                // const calcShopTax = async (start, end, licencePrice, taxRates, staked) => {

                // collect taxes
                const taxSendToOwner = await shopsInstance.collectTax(asciiToHex(VALID_CG_ZONE_GEOHASH), 0, listOfShop.length, { from: user2 });

                truffleAssert.eventEmitted(taxSendToOwner, 'TaxTotalPaidTo', (ev) => {
                    const amount = new BN(ev.amount);
                    const dest = ev.address;
                    expect(Number(amount)).equals(Number(totalTaxShop));
                    return true;
                })

                // how much should zone owner should have be paid

                // throw 'error to see event';
            });

            it('[success] -- shop when delete should pay taxes before withdraw the remaining', async () => {

            });
            it('[error] -- only zone owner should be able to collect taxes', async () => {

            });
            it('[error] -- only zone owner should be able to collect taxes', async () => {

            });
            it('[error] -- impossibe to set the taxes at zero it should be at least 1 WEI of DTH', async () => {

            });
            it('[success] -- total DTH balance should be up to date', async () => {

            });
            it('[success] -- should success to top up', async () => {

            });
        });
        describe('removeShop(bytes12 _position)', () => {
            it('[error] -- caller does not own shop', async () => {
                await enableAndLoadCountry(COUNTRY_CG);

                await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
                await sendDthShopCreate(
                    user1, dthInstance.address, shopsInstance.address,
                    CG_SHOP_LICENSE_PRICE,
                    {
                        country: asciiToHex(COUNTRY_CG),
                        position: asciiToHex(VALID_CG_SHOP_GEOHASH),
                        category: BYTES16_ZERO,
                        name: BYTES16_ZERO,
                        description: BYTES32_ZERO,
                        opening: BYTES16_ZERO,
                    },
                );

                await expectRevert(
                    shopsInstance.removeShop({ from: user2 }),
                    'caller is not shop',
                );
            });
            it('RemoveShop [success]', async () => {
                await enableAndLoadCountry(COUNTRY_CG);

                await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
                await sendDthShopCreate(
                    user1, dthInstance.address, shopsInstance.address,
                    CG_SHOP_LICENSE_PRICE,
                    {
                        country: asciiToHex(COUNTRY_CG),
                        position: asciiToHex(VALID_CG_SHOP_GEOHASH),
                        category: BYTES16_ZERO,
                        name: asciiToHex('shop333333333333'),
                        description: BYTES32_ZERO,
                        opening: BYTES16_ZERO,
                    },
                );
                const shopPreDelete = await shopsInstance.getShopByAddr(user1);
                console.log('shop pre', shopPreDelete);
                expect(shopPreDelete[0]).to.be.equal(asciiToHex(VALID_CG_SHOP_GEOHASH));
                await shopsInstance.removeShop({ from: user1 });
                
                // const shopPostDelete = await shopsInstance.getShopByAddr(user1);
                // console.log('shop post',shopPostDelete )
                // expect(shopPostDelete[0]).to.be.equal('0x000000000000000000000000');
            });
            it('Remove shop from zone owner [SUCCESS]', async () => {

                await enableAndLoadCountry(COUNTRY_CG);
                await dthInstance.mint(user2, ethToWei(MIN_ZONE_DTH_STAKE), { from: owner });
                let zoneInstance, tellerInstance;

                ({ zoneInstance, tellerInstance } = await createZone(user2, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_CG_ZONE_GEOHASH));

                const tsx = await shopsInstance.setZoneLicensePrice(asciiToHex(VALID_CG_ZONE_GEOHASH), ethToWei(111), { from: user2 });


                await dthInstance.mint(user1, ethToWei(111), { from: owner });

                await sendDthShopCreate(
                    user1, dthInstance.address, shopsInstance.address,
                    111,
                    {
                        country: asciiToHex(COUNTRY_CG),
                        position: asciiToHex(VALID_CG_SHOP_GEOHASH),
                        category: BYTES16_ZERO,
                        name: BYTES16_ZERO,
                        description: BYTES32_ZERO,
                        opening: BYTES16_ZERO,
                    },
                );
                const shopPreDelete = await shopsInstance.getShopByAddr(user1);
                expect(shopPreDelete[0]).to.be.equal(asciiToHex(VALID_CG_SHOP_GEOHASH));
                try {
                    await shopsInstance.removeShopFromZoneOwner(user1, asciiToHex(VALID_CG_ZONE_GEOHASH), { from: user2, gas: 4700000 });
                    // throw 'error temp see event';
                } catch (e) {
                    console.log('error', e);
                    throw ('Error remove shop from zone owner');
                }
                const shopPostDelete = await shopsInstance.getShopByAddr(user1);
                expect(shopPostDelete[0]).to.be.equal('0x000000000000000000000000');
            })
            it('Remove shop from zone owner [ERROR]', async () => {

                await enableAndLoadCountry(COUNTRY_CG);
                await dthInstance.mint(user2, ethToWei(MIN_ZONE_DTH_STAKE), { from: owner });
                let zoneInstance, tellerInstance;

                ({ zoneInstance, tellerInstance } = await createZone(user2, MIN_ZONE_DTH_STAKE, COUNTRY_CG, VALID_CG_ZONE_GEOHASH));

                const tsx = await shopsInstance.setZoneLicensePrice(asciiToHex(VALID_CG_ZONE_GEOHASH), ethToWei(111), { from: user2 });


                await dthInstance.mint(user1, ethToWei(111), { from: owner });

                await sendDthShopCreate(
                    user1, dthInstance.address, shopsInstance.address,
                    111,
                    {
                        country: asciiToHex(COUNTRY_CG),
                        position: asciiToHex(VALID_CG_SHOP_GEOHASH),
                        category: BYTES16_ZERO,
                        name: BYTES16_ZERO,
                        description: BYTES32_ZERO,
                        opening: BYTES16_ZERO,
                    },
                );
                await expectRevert(
                    shopsInstance.removeShopFromZoneOwner(user1, asciiToHex(VALID_CG_ZONE_GEOHASH), { from: user3, gas: 4700000 }),
                    'msg.sender is not the owner of the zone',
                );
            })
        });
        // describe('createDispute(bytes12 _position, uint _disputeTypeId, string _evidenceLink)', () => {
        //     beforeEach(async () => {
        //         await shopsInstance.enableDispute({ from: owner });
        //     });
        //     it('[error] -- dispute type does not exist', async () => {
        //         await enableAndLoadCountry(COUNTRY_CG);

        //         await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
        //         await sendDthShopCreate(
        //             user1, dthInstance.address, shopsInstance.address,
        //             CG_SHOP_LICENSE_PRICE,
        //             {
        //                 country: asciiToHex(COUNTRY_CG),
        //                 position: asciiToHex(VALID_CG_SHOP_GEOHASH),
        //                 category: BYTES16_ZERO,
        //                 name: BYTES16_ZERO,
        //                 description: BYTES32_ZERO,
        //                 opening: BYTES16_ZERO,
        //             },
        //         );

        //         await shopsDisputeInstance.addDisputeType('my first metaevidence line', { from: owner });


        //         await expectRevert(
        //             shopsDisputeInstance.createDispute(user1, 1, 'my evidence link', {
        //                 from: user2,
        //                 value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        //             }),
        //             'dispute type does not exist',
        //         );
        //     });
        //     it('[error] -- evidence link is empty', async () => {
        //         await enableAndLoadCountry(COUNTRY_CG);

        //         await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
        //         await sendDthShopCreate(
        //             user1, dthInstance.address, shopsInstance.address,
        //             CG_SHOP_LICENSE_PRICE,
        //             {
        //                 country: asciiToHex(COUNTRY_CG),
        //                 position: asciiToHex(VALID_CG_SHOP_GEOHASH),
        //                 category: BYTES16_ZERO,
        //                 name: BYTES16_ZERO,
        //                 description: BYTES32_ZERO,
        //                 opening: BYTES16_ZERO,
        //             },
        //         );

        //         await shopsDisputeInstance.addDisputeType('my first metaevidence line', { from: owner });


        //         await expectRevert(
        //             shopsDisputeInstance.createDispute(user1, 0, '', {
        //                 from: user2,
        //                 value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        //             }),
        //             'evidence link is empty',
        //         );
        //     });
        //     it('[error] -- shop does not exist', async () => {
        //         await enableAndLoadCountry(COUNTRY_CG);

        //         await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
        //         await sendDthShopCreate(
        //             user1, dthInstance.address, shopsInstance.address,
        //             CG_SHOP_LICENSE_PRICE,
        //             {
        //                 country: asciiToHex(COUNTRY_CG),
        //                 position: asciiToHex(VALID_CG_SHOP_GEOHASH),
        //                 category: BYTES16_ZERO,
        //                 name: BYTES16_ZERO,
        //                 description: BYTES32_ZERO,
        //                 opening: BYTES16_ZERO,
        //             },
        //         );

        //         await shopsDisputeInstance.addDisputeType('my first metaevidence line', { from: owner });


        //         await expectRevert(
        //             shopsDisputeInstance.createDispute(ADDRESS_ZERO, 0, 'my evidence link', {
        //                 from: user2,
        //                 value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        //             }),
        //             'shop does not exist',
        //         );
        //     });
        //     it('[error] -- shop owner cannot start dispute with his own shop', async () => {
        //         await enableAndLoadCountry(COUNTRY_CG);

        //         await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
        //         await sendDthShopCreate(
        //             user1, dthInstance.address, shopsInstance.address,
        //             CG_SHOP_LICENSE_PRICE,
        //             {
        //                 country: asciiToHex(COUNTRY_CG),
        //                 position: asciiToHex(VALID_CG_SHOP_GEOHASH),
        //                 category: BYTES16_ZERO,
        //                 name: BYTES16_ZERO,
        //                 description: BYTES32_ZERO,
        //                 opening: BYTES16_ZERO,
        //             },
        //         );

        //         await shopsDisputeInstance.addDisputeType('my first metaevidence line', { from: owner });

        //         await expectRevert(
        //             shopsDisputeInstance.createDispute(user1, 0, 'my evidence link', {
        //                 from: user1,
        //                 value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        //             }),
        //             'shop owner cannot start dispute on own shop',
        //         );
        //     });
        //     it('[error] -- cannot start dispute if shop already has dispute', async () => {
        //         await enableAndLoadCountry(COUNTRY_CG);

        //         await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
        //         await sendDthShopCreate(
        //             user1, dthInstance.address, shopsInstance.address,
        //             CG_SHOP_LICENSE_PRICE,
        //             {
        //                 country: asciiToHex(COUNTRY_CG),
        //                 position: asciiToHex(VALID_CG_SHOP_GEOHASH),
        //                 category: BYTES16_ZERO,
        //                 name: BYTES16_ZERO,
        //                 description: BYTES32_ZERO,
        //                 opening: BYTES16_ZERO,
        //             },
        //         );

        //         await shopsDisputeInstance.addDisputeType('my first metaevidence line', { from: owner });


        //         await shopsDisputeInstance.createDispute(user1, 0, 'my evidence link', {
        //             from: user2,
        //             value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        //         });

        //         await expectRevert(
        //             shopsDisputeInstance.createDispute(user1, 0, 'my evidence link', {
        //                 from: user2,
        //                 value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        //             }),
        //             'shop already has a dispute',
        //         );
        //     });
        //     it('[error] -- send eth is lower than arbitration cost', async () => {
        //         await enableAndLoadCountry(COUNTRY_CG);

        //         await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
        //         await sendDthShopCreate(
        //             user1, dthInstance.address, shopsInstance.address,
        //             CG_SHOP_LICENSE_PRICE,
        //             {
        //                 country: asciiToHex(COUNTRY_CG),
        //                 position: asciiToHex(VALID_CG_SHOP_GEOHASH),
        //                 category: BYTES16_ZERO,
        //                 name: BYTES16_ZERO,
        //                 description: BYTES32_ZERO,
        //                 opening: BYTES16_ZERO,
        //             },
        //         );

        //         await shopsDisputeInstance.addDisputeType('my first metaevidence line', { from: owner });


        //         await expectRevert(
        //             shopsDisputeInstance.createDispute(user1, 0, 'my evidence link', {
        //                 from: user2,
        //                 value: ethToWei(KLEROS_ARBITRATION_PRICE),
        //             }),
        //             'sent eth is lower than arbitration cost',
        //         );
        //     });
        //     it('[success]', async () => {
        //         await enableAndLoadCountry(COUNTRY_CG);

        //         await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
        //         await sendDthShopCreate(
        //             user1, dthInstance.address, shopsInstance.address,
        //             CG_SHOP_LICENSE_PRICE,
        //             {
        //                 country: asciiToHex(COUNTRY_CG),
        //                 position: asciiToHex(VALID_CG_SHOP_GEOHASH),
        //                 category: BYTES16_ZERO,
        //                 name: BYTES16_ZERO,
        //                 description: BYTES32_ZERO,
        //                 opening: BYTES16_ZERO,
        //             },
        //         );

        //         await shopsDisputeInstance.addDisputeType('my first metaevidence line', { from: owner });


        //         await shopsDisputeInstance.createDispute(user1, 0, 'my evidence link', {
        //             from: user2,
        //             value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        //         });

        //         const disputeBeforeRuling = await shopsDisputeInstance.getDispute(user1);
        //         const disputeBeforeRulingObj = {
        //             id: disputeBeforeRuling[0].toNumber(),
        //             shop: disputeBeforeRuling[1],
        //             challenger: disputeBeforeRuling[2],
        //             disputeType: disputeBeforeRuling[3].toNumber(),
        //             ruling: disputeBeforeRuling[4].toNumber(),
        //             status: disputeBeforeRuling[5].toNumber(),
        //         };
        //         expect(disputeBeforeRulingObj.id).equals(0);
        //         expect(disputeBeforeRulingObj.shop).equals(user1);
        //         expect(disputeBeforeRulingObj.challenger).equals(user2);
        //         expect(disputeBeforeRulingObj.disputeType).equals(0);
        //         expect(disputeBeforeRulingObj.ruling).equals(0); // no ruling yet
        //         expect(disputeBeforeRulingObj.status).equals(0); // Waiting (on ruling)
        //     });
        // });
        // describe('appealDispute(uint _disputeID, string _evidenceLink)', () => {
        //     beforeEach(async () => {
        //         await shopsInstance.enableDispute({ from: owner });
        //     });
        //     it('[error] -- empty evidence link', async () => {
        //         await enableAndLoadCountry(COUNTRY_CG);

        //         await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
        //         await sendDthShopCreate(
        //             user1, dthInstance.address, shopsInstance.address,
        //             CG_SHOP_LICENSE_PRICE,
        //             {
        //                 country: asciiToHex(COUNTRY_CG),
        //                 position: asciiToHex(VALID_CG_SHOP_GEOHASH),
        //                 category: BYTES16_ZERO,
        //                 name: BYTES16_ZERO,
        //                 description: BYTES32_ZERO,
        //                 opening: BYTES16_ZERO,
        //             },
        //         );
        //         await shopsDisputeInstance.addDisputeType('my first metaevidence line', { from: owner });


        //         const disputeId = 0;

        //         await shopsDisputeInstance.createDispute(user1, 0, 'my evidence link', {
        //             from: user2,
        //             value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        //         });

        //         await appealableArbitratorInstance.giveRuling(disputeId, KLEROS_SHOP_WINS, { from: owner }); // dispute 0, shop wins

        //         await expectRevert(
        //             shopsDisputeInstance.appealDispute(user1, '', {
        //                 from: user2, // challenger can appeal ruling that shop won
        //                 value: ethToWei(KLEROS_ARBITRATION_PRICE),
        //             }),
        //             'evidence link is empty',
        //         );
        //     });
        //     it('[error] -- dispute is not appealable', async () => {
        //         await enableAndLoadCountry(COUNTRY_CG);

        //         await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
        //         await sendDthShopCreate(
        //             user1, dthInstance.address, shopsInstance.address,
        //             CG_SHOP_LICENSE_PRICE,
        //             {
        //                 country: asciiToHex(COUNTRY_CG),
        //                 position: asciiToHex(VALID_CG_SHOP_GEOHASH),
        //                 category: BYTES16_ZERO,
        //                 name: BYTES16_ZERO,
        //                 description: BYTES32_ZERO,
        //                 opening: BYTES16_ZERO,
        //             },
        //         );
        //         await shopsDisputeInstance.addDisputeType('my first metaevidence line', { from: owner });


        //         const disputeId = 0;

        //         await shopsDisputeInstance.createDispute(user1, 0, 'my evidence link', {
        //             from: user2,
        //             value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        //         });

        //         await appealableArbitratorInstance.giveRuling(disputeId, KLEROS_SHOP_WINS, { from: owner }); // dispute 0, shop wins
        //         await timeTravel.inSecs(KLEROS_DISPUTE_TIMEOUT + 1);
        //         await appealableArbitratorInstance.giveRuling(disputeId, KLEROS_SHOP_WINS, { from: owner }); // to finalize

        //         await expectRevert(
        //             shopsDisputeInstance.appealDispute(user1, 'my evidence link', {
        //                 from: user2, // challenger can appeal ruling that shop won
        //                 value: ethToWei(KLEROS_ARBITRATION_PRICE),
        //             }),
        //             'shop has no dispute',
        //         );
        //     });

        //     it('[error] -- challenger ruled to win, challenger cannot appeal', async () => {
        //         await enableAndLoadCountry(COUNTRY_CG);

        //         await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
        //         await sendDthShopCreate(
        //             user1, dthInstance.address, shopsInstance.address,
        //             CG_SHOP_LICENSE_PRICE,
        //             {
        //                 country: asciiToHex(COUNTRY_CG),
        //                 position: asciiToHex(VALID_CG_SHOP_GEOHASH),
        //                 category: BYTES16_ZERO,
        //                 name: BYTES16_ZERO,
        //                 description: BYTES32_ZERO,
        //                 opening: BYTES16_ZERO,
        //             },
        //         );
        //         await shopsDisputeInstance.addDisputeType('my first metaevidence line', { from: owner });


        //         const disputeId = 0;

        //         await shopsDisputeInstance.createDispute(user1, 0, 'my evidence link', {
        //             from: user2,
        //             value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        //         });

        //         await appealableArbitratorInstance.giveRuling(disputeId, KLEROS_CHALLENGER_WINS, { from: owner }); // dispute 0, shop wins

        //         await expectRevert(
        //             shopsDisputeInstance.appealDispute(user1, 'my evidence link', {
        //                 from: user2,
        //                 value: ethToWei(KLEROS_ARBITRATION_PRICE),
        //             }),
        //             'challenger ruled to win, only shop can appeal',
        //         );
        //     });
        //     it('[error] -- shop ruled to win, shop cannot appeal', async () => {
        //         await enableAndLoadCountry(COUNTRY_CG);

        //         await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
        //         await sendDthShopCreate(
        //             user1, dthInstance.address, shopsInstance.address,
        //             CG_SHOP_LICENSE_PRICE,
        //             {
        //                 country: asciiToHex(COUNTRY_CG),
        //                 position: asciiToHex(VALID_CG_SHOP_GEOHASH),
        //                 category: BYTES16_ZERO,
        //                 name: BYTES16_ZERO,
        //                 description: BYTES32_ZERO,
        //                 opening: BYTES16_ZERO,
        //             },
        //         );
        //         await shopsDisputeInstance.addDisputeType('my first metaevidence line', { from: owner });


        //         const disputeId = 0;

        //         await shopsDisputeInstance.createDispute(user1, 0, 'my evidence link', {
        //             from: user2,
        //             value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        //         });

        //         await appealableArbitratorInstance.giveRuling(disputeId, KLEROS_SHOP_WINS, { from: owner }); // dispute 0, shop wins

        //         await expectRevert(
        //             shopsDisputeInstance.appealDispute(user1, 'my evidence link', {
        //                 from: user1,
        //                 value: ethToWei(KLEROS_ARBITRATION_PRICE),
        //             }),
        //             'shop ruled to win, only challenger can appeal',
        //         );
        //     });
        //     it('[error] -- no party ruled to win, only challenger can appeal', async () => {
        //         await enableAndLoadCountry(COUNTRY_CG);

        //         await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
        //         await sendDthShopCreate(
        //             user1, dthInstance.address, shopsInstance.address,
        //             CG_SHOP_LICENSE_PRICE,
        //             {
        //                 country: asciiToHex(COUNTRY_CG),
        //                 position: asciiToHex(VALID_CG_SHOP_GEOHASH),
        //                 category: BYTES16_ZERO,
        //                 name: BYTES16_ZERO,
        //                 description: BYTES32_ZERO,
        //                 opening: BYTES16_ZERO,
        //             },
        //         );
        //         await shopsDisputeInstance.addDisputeType('my first metaevidence line', { from: owner });


        //         const disputeId = 0;

        //         await shopsDisputeInstance.createDispute(user1, 0, 'my evidence link', {
        //             from: user2,
        //             value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        //         });

        //         await appealableArbitratorInstance.giveRuling(disputeId, KLEROS_NO_RULING, { from: owner }); // dispute 0, shop wins

        //         await expectRevert(
        //             shopsDisputeInstance.appealDispute(user1, 'my evidence link', {
        //                 from: user1,
        //                 value: ethToWei(KLEROS_ARBITRATION_PRICE),
        //             }),
        //             'no ruling given, only challenger can appeal',
        //         );
        //     });
        //     it('[error] -- send eth is lower than appeal cost', async () => {
        //         await enableAndLoadCountry(COUNTRY_CG);

        //         await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
        //         await sendDthShopCreate(
        //             user1, dthInstance.address, shopsInstance.address,
        //             CG_SHOP_LICENSE_PRICE,
        //             {
        //                 country: asciiToHex(COUNTRY_CG),
        //                 position: asciiToHex(VALID_CG_SHOP_GEOHASH),
        //                 category: BYTES16_ZERO,
        //                 name: BYTES16_ZERO,
        //                 description: BYTES32_ZERO,
        //                 opening: BYTES16_ZERO,
        //             },
        //         );
        //         await shopsDisputeInstance.addDisputeType('my first metaevidence line', { from: owner });


        //         const disputeId = 0;

        //         await shopsDisputeInstance.createDispute(user1, 0, 'my evidence link', {
        //             from: user2,
        //             value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        //         });

        //         await appealableArbitratorInstance.giveRuling(disputeId, KLEROS_SHOP_WINS, { from: owner }); // dispute 0, shop wins

        //         await expectRevert(
        //             shopsDisputeInstance.appealDispute(user1, 'my evidence link', {
        //                 from: user2, // challenger can appeal ruling that shop won
        //                 value: ethToWei(KLEROS_ARBITRATION_PRICE - 0.1),
        //             }),
        //             'sent eth is lower than appeal cost',
        //         );
        //     });

        //     it('[success] - challenger wins', async () => {
        //         await enableAndLoadCountry(COUNTRY_CG);

        //         await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
        //         await sendDthShopCreate(
        //             user1, dthInstance.address, shopsInstance.address,
        //             CG_SHOP_LICENSE_PRICE,
        //             {
        //                 country: asciiToHex(COUNTRY_CG),
        //                 position: asciiToHex(VALID_CG_SHOP_GEOHASH),
        //                 category: BYTES16_ZERO,
        //                 name: BYTES16_ZERO,
        //                 description: BYTES32_ZERO,
        //                 opening: BYTES16_ZERO,
        //             },
        //         );
        //         await shopsDisputeInstance.addDisputeType('my first metaevidence line', { from: owner });


        //         //
        //         // Create dispute
        //         //
        //         await shopsDisputeInstance.createDispute(user1, 0, 'my evidence link', {
        //             from: user2,
        //             value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        //         });
        //         const disputeBeforeRuling = await shopsDisputeInstance.getDispute(user1);
        //         const disputeBeforeRulingObj = {
        //             id: disputeBeforeRuling[0].toNumber(),
        //             shop: disputeBeforeRuling[1],
        //             challenger: disputeBeforeRuling[2],
        //             disputeType: disputeBeforeRuling[3].toNumber(),
        //             ruling: disputeBeforeRuling[4].toNumber(),
        //             status: disputeBeforeRuling[5].toNumber(),
        //         };
        //         expect(disputeBeforeRulingObj.id).equals(0);
        //         expect(disputeBeforeRulingObj.shop.toLowerCase()).equals(user1.toLowerCase());
        //         expect(disputeBeforeRulingObj.challenger.toLowerCase()).equals(user2.toLowerCase());
        //         expect(disputeBeforeRulingObj.disputeType).equals(0);
        //         expect(disputeBeforeRulingObj.ruling).equals(0); // no ruling yet
        //         expect(disputeBeforeRulingObj.status).equals(0); // Waiting (on ruling)

        //         //
        //         // Give ruling on dispute
        //         //
        //         await appealableArbitratorInstance.giveRuling(0, KLEROS_SHOP_WINS, { from: owner }); // dispute 0, shop wins
        //         const disputeAfterRuling = await shopsDisputeInstance.getDispute(user1);
        //         expect(disputeAfterRuling[4].toNumber()).equals(1); // shop wins
        //         expect(disputeAfterRuling[5].toNumber()).equals(1); // Appealable

        //         //
        //         // Appeal dispute ruling
        //         //
        //         await shopsDisputeInstance.appealDispute(user1, 'my appeal evidence link', {
        //             from: user2, // challenger can appeal ruling that shop won
        //             value: ethToWei(KLEROS_ARBITRATION_PRICE),
        //         });
        //         const disputeAfterAppeal = await shopsDisputeInstance.getDispute(user1);
        //         expect(disputeAfterAppeal[4].toNumber()).equals(1); // shop wins
        //         expect(disputeAfterAppeal[5].toNumber()).equals(0); // Waiting

        //         //
        //         // Give ruling on appeal
        //         //
        //         await appealableArbitratorInstance.giveRuling(0, KLEROS_CHALLENGER_WINS, { from: owner }); // dispute 0, challenger wins
        //         const withdrawableDthUser2 = await shopsInstance.withdrawableDth(user2);
        //         expect(withdrawableDthUser2.toString()).to.equal(ethToWei(CG_SHOP_LICENSE_PRICE));

        //         await shopsInstance.withdrawDth({ from: user2 });
        //         const balanceChallengerAfter = await dthInstance.balanceOf(user2);
        //         expect(balanceChallengerAfter.toString()).to.equal(ethToWei(CG_SHOP_LICENSE_PRICE));

        //         const shopHasDisputeAfter = (await shopsInstance.getShopByAddr(user1))[6];
        //         expect(shopHasDisputeAfter).to.equal(false);

        //         const shopExistsAfter = await shopsInstance.shopByAddrExists(user1);
        //         expect(shopExistsAfter).to.equal(false);
        //     });

        //     it('[success] - shop wins', async () => {
        //         await enableAndLoadCountry(COUNTRY_CG);

        //         await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
        //         await sendDthShopCreate(
        //             user1, dthInstance.address, shopsInstance.address,
        //             CG_SHOP_LICENSE_PRICE,
        //             {
        //                 country: asciiToHex(COUNTRY_CG),
        //                 position: asciiToHex(VALID_CG_SHOP_GEOHASH),
        //                 category: BYTES16_ZERO,
        //                 name: BYTES16_ZERO,
        //                 description: BYTES32_ZERO,
        //                 opening: BYTES16_ZERO,
        //             },
        //         );
        //         await shopsDisputeInstance.addDisputeType('my first metaevidence line', { from: owner });


        //         //
        //         // Create dispute
        //         //
        //         await shopsDisputeInstance.createDispute(user1, 0, 'my evidence link', {
        //             from: user2,
        //             value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
        //         });
        //         const disputeBeforeRuling = await shopsDisputeInstance.getDispute(user1);
        //         const disputeBeforeRulingObj = {
        //             id: disputeBeforeRuling[0].toNumber(),
        //             shop: disputeBeforeRuling[1],
        //             challenger: disputeBeforeRuling[2],
        //             disputeType: disputeBeforeRuling[3].toNumber(),
        //             ruling: disputeBeforeRuling[4].toNumber(),
        //             status: disputeBeforeRuling[5].toNumber(),
        //         };
        //         expect(disputeBeforeRulingObj.id).equals(0);
        //         expect(disputeBeforeRulingObj.shop).equals(user1);
        //         expect(disputeBeforeRulingObj.challenger).equals(user2);
        //         expect(disputeBeforeRulingObj.disputeType).equals(0);
        //         expect(disputeBeforeRulingObj.ruling).equals(0); // no ruling yet
        //         expect(disputeBeforeRulingObj.status).equals(0); // Waiting (on ruling)

        //         //
        //         // Give ruling on dispute
        //         //
        //         await appealableArbitratorInstance.giveRuling(0, KLEROS_CHALLENGER_WINS, { from: owner }); // dispute 0, shop wins
        //         const disputeAfterRuling = await shopsDisputeInstance.getDispute(user1);
        //         expect(disputeAfterRuling[4].toNumber()).equals(2); // challenger wins
        //         expect(disputeAfterRuling[5].toNumber()).equals(1); // Appealable

        //         //
        //         // Appeal dispute ruling
        //         //
        //         await shopsDisputeInstance.appealDispute(user1, 'my appeal evidence link', {
        //             from: user1, // shop can appeal ruling that challenger won
        //             value: ethToWei(KLEROS_ARBITRATION_PRICE),
        //         });
        //         const disputeAfterAppeal = await shopsDisputeInstance.getDispute(user1);
        //         expect(disputeAfterAppeal[4].toNumber()).equals(2); // challenger wins
        //         expect(disputeAfterAppeal[5].toNumber()).equals(0); // Waiting

        //         //
        //         // Give ruling on appeal
        //         //
        //         // we need to get the updated dispute id, only when using the development kleros contracts
        //         await appealableArbitratorInstance.giveRuling(0, KLEROS_SHOP_WINS, { from: owner }); // dispute 0, challenger wins

        //         const withdrawableDthUser2 = await shopsInstance.withdrawableDth(user2);
        //         expect(withdrawableDthUser2.toString()).to.equal(ethToWei(0));

        //         const balanceChallengerAfter = await dthInstance.balanceOf(user2);
        //         expect(balanceChallengerAfter.toNumber()).to.equal(0);

        //         const shopHasDisputeAfter = (await shopsInstance.getShopByAddr(user1))[6];
        //         expect(shopHasDisputeAfter).to.equal(false);

        //         const shopExistsAfter = await shopsInstance.shopByAddrExists(user1);
        //         expect(shopExistsAfter).to.equal(true);
        //     });
        // });
    });

    // describe('Getters', () => {
    //     describe('getDispute(address _shopAddress)', () => {
    //         beforeEach(async () => {
    //             await shopsInstance.enableDispute({ from: owner });
    //         });
    //         it('should throw if shop has no dispute', async () => {
    //             // create a shop
    //             await enableAndLoadCountry(COUNTRY_CG);

    //             await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
    //             await sendDthShopCreate(
    //                 user1, dthInstance.address, shopsInstance.address,
    //                 CG_SHOP_LICENSE_PRICE,
    //                 {
    //                     country: asciiToHex(COUNTRY_CG),
    //                     position: asciiToHex(VALID_CG_SHOP_GEOHASH),
    //                     category: BYTES16_ZERO,
    //                     name: BYTES16_ZERO,
    //                     description: BYTES32_ZERO,
    //                     opening: BYTES16_ZERO,
    //                 },
    //             );

    //             await expectRevert(
    //                 shopsDisputeInstance.getDispute(user1, {
    //                     from: user1,
    //                 }),
    //                 'shop has no dispute',
    //             );
    //         });
    //         it('should return initial dispute of shop after new dispute is created', async () => {
    //             // create a shop
    //             await enableAndLoadCountry(COUNTRY_CG);

    //             await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
    //             await sendDthShopCreate(
    //                 user1, dthInstance.address, shopsInstance.address,
    //                 CG_SHOP_LICENSE_PRICE,
    //                 {
    //                     country: asciiToHex(COUNTRY_CG),
    //                     position: asciiToHex(VALID_CG_SHOP_GEOHASH),
    //                     category: BYTES16_ZERO,
    //                     name: BYTES16_ZERO,
    //                     description: BYTES32_ZERO,
    //                     opening: BYTES16_ZERO,
    //                 },
    //             );

    //             // create a dispute
    //             await shopsDisputeInstance.addDisputeType('my first metaevidence line', { from: owner });

    //             await shopsDisputeInstance.createDispute(user1, 0, 'my evidence link', {
    //                 from: user2,
    //                 value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
    //             });

    //             const disputeBeforeRuling = await shopsDisputeInstance.getDispute(user1);
    //             const disputeBeforeRulingObj = {
    //                 id: disputeBeforeRuling[0].toNumber(),
    //                 shop: disputeBeforeRuling[1],
    //                 challenger: disputeBeforeRuling[2],
    //                 disputeType: disputeBeforeRuling[3].toNumber(),
    //                 ruling: disputeBeforeRuling[4].toNumber(),
    //                 status: disputeBeforeRuling[5].toNumber(),
    //             };

    //             expect(disputeBeforeRulingObj.id).equals(0);
    //             expect(disputeBeforeRulingObj.shop).equals(user1);
    //             expect(disputeBeforeRulingObj.challenger).equals(user2);
    //             expect(disputeBeforeRulingObj.disputeType).equals(0);
    //             expect(disputeBeforeRulingObj.ruling).equals(0); // no ruling yet
    //             expect(disputeBeforeRulingObj.status).equals(0); // Waiting (on ruling)
    //         });
    //         it('should return updated dispute of shop after ruling', async () => {
    //             // create a shop
    //             await enableAndLoadCountry(COUNTRY_CG);

    //             await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
    //             await sendDthShopCreate(
    //                 user1, dthInstance.address, shopsInstance.address,
    //                 CG_SHOP_LICENSE_PRICE,
    //                 {
    //                     country: asciiToHex(COUNTRY_CG),
    //                     position: asciiToHex(VALID_CG_SHOP_GEOHASH),
    //                     category: BYTES16_ZERO,
    //                     name: BYTES16_ZERO,
    //                     description: BYTES32_ZERO,
    //                     opening: BYTES16_ZERO,
    //                 },
    //             );

    //             // create a dispute
    //             await shopsDisputeInstance.addDisputeType('my first metaevidence line', { from: owner });

    //             await shopsDisputeInstance.createDispute(user1, 0, 'my evidence link', {
    //                 from: user2,
    //                 value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
    //             });

    //             // give ruling on dispute
    //             await appealableArbitratorInstance.giveRuling('0', KLEROS_CHALLENGER_WINS, { from: owner }); // dispute 0, shop wins

    //             const disputeAfterRuling = await shopsDisputeInstance.getDispute(user1);
    //             const disputeAfterRulingObj = {
    //                 id: disputeAfterRuling[0].toNumber(),
    //                 shop: disputeAfterRuling[1],
    //                 challenger: disputeAfterRuling[2],
    //                 disputeType: disputeAfterRuling[3].toNumber(),
    //                 ruling: disputeAfterRuling[4].toNumber(),
    //                 status: disputeAfterRuling[5].toNumber(),
    //             };

    //             expect(disputeAfterRulingObj.id).equals(0);
    //             expect(disputeAfterRulingObj.shop).equals(user1);
    //             expect(disputeAfterRulingObj.challenger).equals(user2);
    //             expect(disputeAfterRulingObj.disputeType).equals(0);
    //             expect(disputeAfterRulingObj.ruling).equals(2); // ChallengerWins
    //             expect(disputeAfterRulingObj.status).equals(1); // Appealable
    //         });
    //         it('should return updated dispute of shop after appeal', async () => {
    //             // create a shop
    //             await enableAndLoadCountry(COUNTRY_CG);

    //             await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
    //             await sendDthShopCreate(
    //                 user1, dthInstance.address, shopsInstance.address,
    //                 CG_SHOP_LICENSE_PRICE,
    //                 {
    //                     country: asciiToHex(COUNTRY_CG),
    //                     position: asciiToHex(VALID_CG_SHOP_GEOHASH),
    //                     category: BYTES16_ZERO,
    //                     name: BYTES16_ZERO,
    //                     description: BYTES32_ZERO,
    //                     opening: BYTES16_ZERO,
    //                 },
    //             );

    //             // create a dispute
    //             await shopsDisputeInstance.addDisputeType('my first metaevidence line', { from: owner });

    //             await shopsDisputeInstance.createDispute(user1, 0, 'my evidence link', {
    //                 from: user2,
    //                 value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
    //             });

    //             // give ruling on dispute
    //             await appealableArbitratorInstance.giveRuling('0', KLEROS_CHALLENGER_WINS, { from: owner }); // dispute 0, shop wins

    //             // appeal
    //             await shopsDisputeInstance.appealDispute(user1, 'my appeal evidence link', {
    //                 from: user1, // shop can appeal ruling that challenger won
    //                 value: ethToWei(KLEROS_ARBITRATION_PRICE),
    //             });

    //             const disputeAfterAppeal = await shopsDisputeInstance.getDispute(user1);
    //             const disputeAfterAppealObj = {
    //                 id: disputeAfterAppeal[0].toNumber(),
    //                 shop: disputeAfterAppeal[1],
    //                 challenger: disputeAfterAppeal[2],
    //                 disputeType: disputeAfterAppeal[3].toNumber(),
    //                 ruling: disputeAfterAppeal[4].toNumber(),
    //                 status: disputeAfterAppeal[5].toNumber(),
    //             };

    //             expect(disputeAfterAppealObj.id).equals(0);
    //             expect(disputeAfterAppealObj.shop).equals(user1);
    //             expect(disputeAfterAppealObj.challenger).equals(user2);
    //             expect(disputeAfterAppealObj.disputeType).equals(0);
    //             expect(disputeAfterAppealObj.ruling).equals(2); // ChallengerWins
    //             expect(disputeAfterAppealObj.status).equals(0); // Waiting
    //         });
    //         it('should throw after appeal ruling (shop wins) since there is no dispute', async () => {
    //             // create a shop
    //             await enableAndLoadCountry(COUNTRY_CG);

    //             await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
    //             await sendDthShopCreate(
    //                 user1, dthInstance.address, shopsInstance.address,
    //                 CG_SHOP_LICENSE_PRICE,
    //                 {
    //                     country: asciiToHex(COUNTRY_CG),
    //                     position: asciiToHex(VALID_CG_SHOP_GEOHASH),
    //                     category: BYTES16_ZERO,
    //                     name: BYTES16_ZERO,
    //                     description: BYTES32_ZERO,
    //                     opening: BYTES16_ZERO,
    //                 },
    //             );

    //             // create a dispute
    //             await shopsDisputeInstance.addDisputeType('my first metaevidence line', { from: owner });

    //             await shopsDisputeInstance.createDispute(user1, 0, 'my evidence link', {
    //                 from: user2,
    //                 value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
    //             });

    //             // give ruling on dispute
    //             await appealableArbitratorInstance.giveRuling('0', KLEROS_CHALLENGER_WINS, { from: owner }); // dispute 0, shop wins

    //             // appeal
    //             await shopsDisputeInstance.appealDispute(user1, 'my appeal evidence link', {
    //                 from: user1, // shop can appeal ruling that challenger won
    //                 value: ethToWei(KLEROS_ARBITRATION_PRICE),
    //             });

    //             // give ruling on appeal
    //             await appealableArbitratorInstance.giveRuling('0', KLEROS_SHOP_WINS, { from: owner }); // dispute 0, challenger wins

    //             await expectRevert(
    //                 shopsDisputeInstance.getDispute(user1),
    //                 'shop has no dispute',
    //             );
    //         });
    //         it('should throw after appeal ruling (challenger wins) since shop has been removed', async () => {
    //             // create a shop
    //             await enableAndLoadCountry(COUNTRY_CG);

    //             await dthInstance.mint(user1, ethToWei(CG_SHOP_LICENSE_PRICE), { from: owner });
    //             await sendDthShopCreate(
    //                 user1, dthInstance.address, shopsInstance.address,
    //                 CG_SHOP_LICENSE_PRICE,
    //                 {
    //                     country: asciiToHex(COUNTRY_CG),
    //                     position: asciiToHex(VALID_CG_SHOP_GEOHASH),
    //                     category: BYTES16_ZERO,
    //                     name: BYTES16_ZERO,
    //                     description: BYTES32_ZERO,
    //                     opening: BYTES16_ZERO,
    //                 },
    //             );

    //             // create a dispute
    //             await shopsDisputeInstance.addDisputeType('my first metaevidence line', { from: owner });

    //             await shopsDisputeInstance.createDispute(user1, 0, 'my evidence link', {
    //                 from: user2,
    //                 value: ethToWei(KLEROS_ARBITRATION_PRICE * 2),
    //             });

    //             // give ruling on dispute
    //             await appealableArbitratorInstance.giveRuling('0', KLEROS_CHALLENGER_WINS, { from: owner }); // dispute 0, shop wins

    //             // appeal
    //             await shopsDisputeInstance.appealDispute(user1, 'my appeal evidence link', {
    //                 from: user1, // shop can appeal ruling that challenger won
    //                 value: ethToWei(KLEROS_ARBITRATION_PRICE),
    //             });

    //             // give ruling on appeal
    //             await appealableArbitratorInstance.giveRuling('0', KLEROS_CHALLENGER_WINS, { from: owner }); // dispute 0, challenger wins

    //             await expectRevert(
    //                 shopsDisputeInstance.getDispute(user1),
    //                 'shop does not exist',
    //             );
    //         });
    //     });
    // });
});
