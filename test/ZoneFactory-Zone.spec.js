/* eslint-env mocha */
/* global artifacts, contract */
/* eslint-disable max-len, no-multi-spaces, no-unused-expressions */

const DetherToken = artifacts.require("DetherToken");
const Users = artifacts.require("Users");
const CertifierRegistry = artifacts.require("CertifierRegistry");
const GeoRegistry = artifacts.require("GeoRegistry");
const ZoneFactory = artifacts.require("ZoneFactory");
const Zone = artifacts.require("Zone");
const Teller = artifacts.require("Teller");
const TaxCollector = artifacts.require("TaxCollector");

const Web3 = require("web3");

const expect = require("./utils/chai");
const TimeTravel = require("./utils/timeTravel");
const { addCountry } = require("./utils/geo");
const { ethToWei, asciiToHex, str, weiToEth } = require("./utils/convert");
const {
  expectRevert,
  expectRevert2,
  expectRevert3
} = require("./utils/evmErrors");
const { getRandomBytes32 } = require("./utils/ipfs");
const {
  BYTES7_ZERO,
  VALID_CG_ZONE_GEOHASH,
  INVALID_CG_ZONE_GEOHASH,
  MIN_ZONE_DTH_STAKE,
  ONE_HOUR,
  ONE_DAY,
  BID_PERIOD,
  COOLDOWN_PERIOD,
  ADDRESS_ZERO,
  ADDRESS_BURN,
  BYTES32_ZERO,
  BYTES1_ZERO,
  BYTES12_ZERO,
  BYTES16_ZERO,
  ZONE_AUCTION_STATE_STARTED,
  ZONE_AUCTION_STATE_ENDED,
  TELLER_CG_POSITION,
  TELLER_CG_CURRENCY_ID,
  TELLER_CG_MESSENGER,
  TELLER_CG_SELLRATE,
  TELLER_CG_BUYRATE,
  TELLER_CG_SETTINGS,
  TELLER_CG_REFFEE
} = require("./utils/values");

const web3 = new Web3("http://localhost:8545");
const timeTravel = new TimeTravel(web3);

const getLastBlockTimestamp = async () =>
  (await web3.eth.getBlock("latest")).timestamp;

const createDthZoneCreateData = (
  zoneFactoryAddr,
  bid,
  countryCode,
  geohash
) => {
  const fnSig = web3.eth.abi.encodeFunctionSignature(
    "transfer(address,uint256,bytes)"
  );
  const params = web3.eth.abi.encodeParameters(
    ["address", "uint256", "bytes"],
    [
      zoneFactoryAddr,
      ethToWei(bid),
      `0x${countryCode.slice(2)}${geohash.slice(2)}`
    ]
  );
  return [fnSig, params.slice(2)].join("");
};
const createDthZoneCreateDataWithTier = (
  zoneFactoryAddr,
  bid,
  countryCode,
  geohash,
  tier
) => {
  const fnSig = web3.eth.abi.encodeFunctionSignature(
    "transfer(address,uint256,bytes)"
  );
  const params = web3.eth.abi.encodeParameters(
    ["address", "uint256", "bytes"],
    [
      zoneFactoryAddr,
      ethToWei(bid),
      `0x${countryCode.slice(2)}${geohash.slice(2)}${tier}`
    ]
  );
  return [fnSig, params.slice(2)].join("");
};
const createDthZoneClaimFreeData = (zoneFactoryAddr, dthAmount) => {
  const fnSig = web3.eth.abi.encodeFunctionSignature(
    "transfer(address,uint256,bytes)"
  );
  const params = web3.eth.abi.encodeParameters(
    ["address", "uint256", "bytes"],
    [zoneFactoryAddr, ethToWei(dthAmount), "0x41"]
  );
  return [fnSig, params.slice(2)].join("");
};
const createDthZoneBidData = (zoneAddr, bid) => {
  const fnSig = web3.eth.abi.encodeFunctionSignature(
    "transfer(address,uint256,bytes)"
  );
  const params = web3.eth.abi.encodeParameters(
    ["address", "uint256", "bytes"],
    [zoneAddr, ethToWei(bid), "0x42"]
  );
  return [fnSig, params.slice(2)].join("");
};
const createDthZoneTopUpData = (zoneAddr, dthAmount) => {
  const fnSig = web3.eth.abi.encodeFunctionSignature(
    "transfer(address,uint256,bytes)"
  );
  const params = web3.eth.abi.encodeParameters(
    ["address", "uint256", "bytes"],
    [zoneAddr, ethToWei(dthAmount), "0x43"]
  );
  return [fnSig, params.slice(2)].join("");
};

const COUNTRY_CG = "CG";

const zoneOwnerToObj = zoneOwnerArr => ({
  addr: zoneOwnerArr[0],
  startTime: zoneOwnerArr[1],
  staked: zoneOwnerArr[2],
  balance: zoneOwnerArr[3],
  lastTaxTime: zoneOwnerArr[4],
  auctionId: zoneOwnerArr[5]
});
const zoneOwnerToObjPretty = zoneOwnerArr => ({
  addr: zoneOwnerArr[0],
  startTime: zoneOwnerArr[1].toString(),
  staked: zoneOwnerArr[2].toString(),
  balance: zoneOwnerArr[3].toString(),
  lastTaxTime: zoneOwnerArr[4].toString(),
  auctionId: zoneOwnerArr[5].toString()
});

const tellerToObj = tellerArr => ({
  address: tellerArr[0],
  currencyId: tellerArr[1],
  messenger: tellerArr[2],
  position: tellerArr[3],
  settings: tellerArr[4],
  buyRate: tellerArr[5],
  sellRate: tellerArr[6],
  // funds: tellerArr[7],
  referrer: tellerArr[7]
});

const auctionToObj = auctionArr => ({
  id: auctionArr[0],
  state: auctionArr[1],
  startTime: auctionArr[2],
  endTime: auctionArr[3],
  highestBidder: auctionArr[4],
  highestBid: auctionArr[5]
});
const auctionToObjPretty = auctionArr => ({
  id: auctionArr[0].toString(),
  state: auctionArr[1].toString(),
  startTime: auctionArr[2].toString(),
  endTime: auctionArr[3].toString(),
  highestBidder: auctionArr[4],
  highestBid: auctionArr[5].toString()
});

contract("ZoneFactory + Zone", accounts => {
  let owner;
  let user1;
  let user2;
  let user3;
  let user4;
  let user5;

  let __rootState__; // eslint-disable-line no-underscore-dangle

  let dthInstance;
  let usersInstance;
  let geoInstance;
  let zoneFactoryInstance;
  let zoneImplementationInstance;
  let tellerImplementationInstance;
  let certifierRegistryInstance;
  let taxCollectorInstance;

  before(async () => {
    __rootState__ = await timeTravel.saveState();
    [owner, user1, user2, user3, user4, user5] = accounts;
  });

  beforeEach(async () => {
    await timeTravel.revertState(__rootState__); // to go back to real time
    dthInstance = await DetherToken.new({ from: owner });
    taxCollectorInstance = await TaxCollector.new(
      dthInstance.address,
      ADDRESS_BURN,
      { from: owner }
    );
    certifierRegistryInstance = await CertifierRegistry.new({ from: owner });
    geoInstance = await GeoRegistry.new({ from: owner });
    zoneImplementationInstance = await Zone.new({ from: owner });
    tellerImplementationInstance = await Teller.new({ from: owner });
    usersInstance = await Users.new(
      geoInstance.address,
      certifierRegistryInstance.address,
      { from: owner }
    );
    zoneFactoryInstance = await ZoneFactory.new(
      dthInstance.address,
      geoInstance.address,
      usersInstance.address,
      zoneImplementationInstance.address,
      tellerImplementationInstance.address,
      taxCollectorInstance.address,
      { from: owner }
    );

    await usersInstance.setZoneFactory(zoneFactoryInstance.address, {
      from: owner
    });
  });

  const createZone = async (from, dthAmount, countryCode, geohash) => {
    await dthInstance.mint(from, ethToWei(dthAmount), { from: owner });
    const txCreate = await web3.eth.sendTransaction({
      from,
      to: dthInstance.address,
      data: createDthZoneCreateData(
        zoneFactoryInstance.address,
        dthAmount,
        asciiToHex(countryCode),
        asciiToHex(geohash)
      ),
      value: 0,
      gas: 4700000
    });
    const zoneAddress = await zoneFactoryInstance.geohashToZone(
      asciiToHex(geohash)
    );
    const zoneInstance = await Zone.at(zoneAddress);
    const tellerAddress = await zoneInstance.teller();
    const tellerInstance = await Teller.at(tellerAddress);
    return { zoneInstance, tellerInstance };
  };

  const placeBid = async (from, dthAmount, zoneAddress) => {
    await dthInstance.mint(from, ethToWei(dthAmount), { from: owner });
    const tx = await web3.eth.sendTransaction({
      from,
      to: dthInstance.address,
      data: createDthZoneBidData(zoneAddress, dthAmount),
      value: 0,
      gas: 4700000
    });
    return tx;
  };

  const claimFreeZone = async (from, dthAmount, zoneAddress) => {
    await dthInstance.mint(from, ethToWei(dthAmount), { from: owner });
    const tx = await web3.eth.sendTransaction({
      from,
      to: dthInstance.address,
      data: createDthZoneClaimFreeData(zoneAddress, dthAmount),
      value: 0,
      gas: 4700000
    });
    return tx;
  };

  const topUp = async (from, dthAmount, zoneAddress) => {
    await dthInstance.mint(from, ethToWei(dthAmount), { from: owner });
    const tx = await web3.eth.sendTransaction({
      from,
      to: dthInstance.address,
      data: createDthZoneTopUpData(zoneAddress, dthAmount),
      value: 0,
      gas: 4700000
    });
    return tx;
  };

  const enableAndLoadCountry = async countryCode => {
    await addCountry(owner, web3, geoInstance, countryCode, 300);
  };

  describe(">>> deploying a Zone", () => {
    describe("[ERC223] ZoneFactory.createAndClaim(bytes2 _country, bytes7 _geohash, uint _dthAmount)", () => {
      it("should revert if country is disabled", async () => {
        await expectRevert2(
          createZone(
            user1,
            MIN_ZONE_DTH_STAKE,
            COUNTRY_CG,
            VALID_CG_ZONE_GEOHASH
          ),
          "country is disabled"
        );
      });
      it("should revert if creating a zone with geohash 0x0", async () => {
        const res = await enableAndLoadCountry(COUNTRY_CG);
        await expectRevert2(
          createZone(user1, MIN_ZONE_DTH_STAKE, COUNTRY_CG, BYTES1_ZERO),
          "createAndClaim expects 8 bytes as data"
        );
      });
      it("should revert if zone is not inside country", async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        await expectRevert2(
          createZone(
            user1,
            MIN_ZONE_DTH_STAKE,
            COUNTRY_CG,
            INVALID_CG_ZONE_GEOHASH
          ),
          "zone is not inside country"
        );
      });
      it("should revert if zone already exists", async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        await createZone(
          user1,
          MIN_ZONE_DTH_STAKE,
          COUNTRY_CG,
          VALID_CG_ZONE_GEOHASH
        );
        await expectRevert2(
          createZone(
            user1,
            MIN_ZONE_DTH_STAKE,
            COUNTRY_CG,
            VALID_CG_ZONE_GEOHASH
          ),
          "zone already exists"
        );
      });
      it(`should revert if creating a zone with dthAmount minimum - 1 (${MIN_ZONE_DTH_STAKE -
        1} DTH)`, async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        await expectRevert2(
          createZone(
            user1,
            MIN_ZONE_DTH_STAKE - 1,
            COUNTRY_CG,
            VALID_CG_ZONE_GEOHASH
          ),
          "zone dth stake shoulld be at least minimum (100DTH)"
        );
      });
      it("should succeed otherwise", async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        await dthInstance.mint(user1, ethToWei(MIN_ZONE_DTH_STAKE), {
          from: owner
        });
        await web3.eth.sendTransaction({
          from: user1,
          to: dthInstance.address,
          data: createDthZoneCreateData(
            zoneFactoryInstance.address,
            MIN_ZONE_DTH_STAKE,
            asciiToHex(COUNTRY_CG),
            asciiToHex(VALID_CG_ZONE_GEOHASH)
          ),
          value: 0,
          gas: 4700000
        });
        const zoneAddress = await zoneFactoryInstance.geohashToZone(
          asciiToHex(VALID_CG_ZONE_GEOHASH)
        );
        const zoneInstance = await Zone.at(zoneAddress);

        expect(dthInstance.balanceOf(user1)).to.eventually.be.bignumber.equal(
          "0"
        );
        expect(
          dthInstance.balanceOf(zoneFactoryInstance.address)
        ).to.eventually.be.bignumber.equal("0");
        expect(
          dthInstance.balanceOf(zoneInstance.address)
        ).to.eventually.be.bignumber.equal(ethToWei(MIN_ZONE_DTH_STAKE));

        expect(
          zoneFactoryInstance.geohashToZone(asciiToHex(VALID_CG_ZONE_GEOHASH))
        ).to.eventually.equal(zoneInstance.address);
        expect(
          zoneFactoryInstance.zoneToGeohash(zoneInstance.address)
        ).to.eventually.equal(asciiToHex(VALID_CG_ZONE_GEOHASH));
        expect(
          zoneFactoryInstance.zoneExists(asciiToHex(VALID_CG_ZONE_GEOHASH))
        ).to.eventually.be.true;

        expect(zoneInstance.auctionExists("0")).to.eventually.be.false;
        expect(zoneInstance.auctionExists("1")).to.eventually.be.false;

        const zoneOwner = zoneOwnerToObj(await zoneInstance.getZoneOwner());
        const zoneFactoryGeohashZoneOwner = await zoneFactoryInstance.ownerToZone(
          zoneOwner.addr
        );
        const lastBlockTimestamp = await getLastBlockTimestamp();

        expect(zoneAddress).to.equal(zoneFactoryGeohashZoneOwner);
        expect(zoneOwner.addr).to.equal(user1);
        expect(zoneOwner.startTime).to.be.bignumber.equal(
          str(lastBlockTimestamp)
        );
        expect(zoneOwner.lastTaxTime).to.be.bignumber.equal(
          str(lastBlockTimestamp)
        );
        expect(zoneOwner.staked).to.be.bignumber.equal(
          ethToWei(MIN_ZONE_DTH_STAKE)
        );
        expect(zoneOwner.balance).to.be.bignumber.equal(
          ethToWei(MIN_ZONE_DTH_STAKE)
        );
        expect(zoneOwner.auctionId).to.be.bignumber.equal("0");
      });
    });
  });

  describe("Setters", () => {
    let zoneInstance;
    let tellerInstance;
    beforeEach(async () => {
      // create a zone with a zone owner
      await enableAndLoadCountry(COUNTRY_CG);
      ({ zoneInstance, tellerInstance } = await createZone(
        user1,
        MIN_ZONE_DTH_STAKE,
        COUNTRY_CG,
        VALID_CG_ZONE_GEOHASH
      ));
      // await geoInstance.setCountryTierDailyLimit(asciiToHex(COUNTRY_CG), '0', '1000', { from: owner });
    });
    describe("AUCTION", () => {
      describe("[ERC223] Zone.claimFreeZone(address _from, uint _dthAmount)", () => {
        it("should revert if cannot claim zone which has an owner", async () => {
          await expectRevert2(
            claimFreeZone(user2, MIN_ZONE_DTH_STAKE + 1, zoneInstance.address),
            "can not claim zone with owner"
          );
        });
        it("should revert if cannot claim free zone for minimum stake - 1", async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + 1);
          await zoneInstance.release({ from: user1 });
          await expectRevert2(
            claimFreeZone(user1, MIN_ZONE_DTH_STAKE - 1, zoneInstance.address),
            "need at least minimum zone stake amount (100 DTH)"
          );
        });

        it("should succeed if can claim free zone for minimum stake", async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + 1);
          const zoneAddress = await zoneFactoryInstance.geohashToZone(
            asciiToHex(VALID_CG_ZONE_GEOHASH)
          );
          const zoneFactoryGeohashZoneAddress = await zoneFactoryInstance.ownerToZone(
            user1
          );
          expect(zoneFactoryGeohashZoneAddress).to.equal(zoneAddress);
          await zoneInstance.release({ from: user1 });
          const zoneFactoryGeohashZoneAddress2 = await zoneFactoryInstance.ownerToZone(
            user1
          );
          expect(zoneFactoryGeohashZoneAddress2).to.equal(
            "0x0000000000000000000000000000000000000000"
          );

          const zoneFactoryGeohashZoneAddress3 = await zoneFactoryInstance.ownerToZone(
            user2
          );
          expect(zoneFactoryGeohashZoneAddress3).to.equal(
            "0x0000000000000000000000000000000000000000"
          );
          await claimFreeZone(user2, MIN_ZONE_DTH_STAKE, zoneInstance.address);
          const zoneFactoryGeohashZoneAddress4 = await zoneFactoryInstance.ownerToZone(
            user2
          );
          expect(zoneFactoryGeohashZoneAddress4).to.equal(zoneAddress);
          expect(dthInstance.balanceOf(user2)).to.eventually.be.bignumber.equal(
            "0"
          );
          expect(
            dthInstance.balanceOf(zoneFactoryInstance.address)
          ).to.eventually.be.bignumber.equal("0");
          expect(
            dthInstance.balanceOf(zoneInstance.address)
          ).to.eventually.be.bignumber.equal(ethToWei(MIN_ZONE_DTH_STAKE));

          expect(
            zoneFactoryInstance.geohashToZone(asciiToHex(VALID_CG_ZONE_GEOHASH))
          ).to.eventually.equal(zoneInstance.address);
          expect(
            zoneFactoryInstance.zoneToGeohash(zoneInstance.address)
          ).to.eventually.equal(asciiToHex(VALID_CG_ZONE_GEOHASH));
          expect(
            zoneFactoryInstance.zoneExists(asciiToHex(VALID_CG_ZONE_GEOHASH))
          ).to.eventually.be.true;

          expect(zoneInstance.auctionExists("0")).to.eventually.be.false;
          expect(zoneInstance.auctionExists("1")).to.eventually.be.false;

          const zoneOwner = zoneOwnerToObj(await zoneInstance.getZoneOwner());

          const lastBlockTimestamp = await getLastBlockTimestamp();

          expect(zoneOwner.addr).to.equal(user2);
          expect(zoneOwner.startTime).to.be.bignumber.equal(
            str(lastBlockTimestamp)
          );
          expect(zoneOwner.lastTaxTime).to.be.bignumber.equal(
            str(lastBlockTimestamp)
          );
          expect(zoneOwner.staked).to.be.bignumber.equal(
            ethToWei(MIN_ZONE_DTH_STAKE)
          );
          expect(zoneOwner.balance).to.be.bignumber.equal(
            ethToWei(MIN_ZONE_DTH_STAKE)
          );
          expect(zoneOwner.auctionId).to.be.bignumber.equal("0");
        });
      });

      describe("[ERC223] Zone.bid(address _from, uint _dthAmount)", () => {
        it("should revert if cooldown period not yet ended", async () => {
          await expectRevert2(
            placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address),
            "cooldown period did not end yet"
          );
        });
        it("should revert if called by current zone owner", async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + 1);
          await expectRevert2(
            placeBid(user1, 10, zoneInstance.address),
            "sender own already a zone"
          );
        });
        it("should revert if bid (minus burn fee) amount is less than current stake", async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + 1);
          await expectRevert2(
            placeBid(user2, MIN_ZONE_DTH_STAKE, zoneInstance.address),
            "bid is lower than current zone stake"
          );
        });
        it("should succeed if bid (minus burn fee) is higher than current zone stake and referrer should be paid", async () => {
          await tellerInstance.addTeller(
            asciiToHex(TELLER_CG_POSITION),
            TELLER_CG_CURRENCY_ID,
            "0x00000000000000000000000000000000",
            TELLER_CG_SELLRATE,
            TELLER_CG_BUYRATE,
            TELLER_CG_SETTINGS,
            user5,
            TELLER_CG_REFFEE,
            asciiToHex("ETH-BTC"),
            { from: user1 }
          );

          const oldRefDthBalance = await dthInstance.balanceOf(user5);

          await timeTravel.inSecs(COOLDOWN_PERIOD + 1);
          const oldZoneDthBalance = await dthInstance.balanceOf(
            zoneInstance.address
          );
          const bidAmount = MIN_ZONE_DTH_STAKE + 10;
          await placeBid(user2, bidAmount, zoneInstance.address);

          expect(
            dthInstance.balanceOf(zoneFactoryInstance.address)
          ).to.eventually.be.bignumber.equal("0");
          expect(dthInstance.balanceOf(user2)).to.eventually.be.bignumber.equal(
            "0"
          );
          expect(
            dthInstance.balanceOf(zoneInstance.address)
          ).to.eventually.be.bignumber.above(oldZoneDthBalance);

          expect(
            zoneFactoryInstance.geohashToZone(asciiToHex(VALID_CG_ZONE_GEOHASH))
          ).to.eventually.equal(zoneInstance.address);
          expect(
            zoneFactoryInstance.zoneToGeohash(zoneInstance.address)
          ).to.eventually.equal(asciiToHex(VALID_CG_ZONE_GEOHASH));
          expect(
            zoneFactoryInstance.zoneExists(asciiToHex(VALID_CG_ZONE_GEOHASH))
          ).to.eventually.be.true;

          expect(zoneInstance.auctionExists("0")).to.eventually.be.false;
          expect(zoneInstance.auctionExists("1")).to.eventually.be.true;
          expect(zoneInstance.auctionExists("2")).to.eventually.be.false;

          const zoneOwner = zoneOwnerToObj(await zoneInstance.getZoneOwner());
          const lastAuction = auctionToObj(await zoneInstance.getLastAuction());

          const lastBlockTimestamp = await getLastBlockTimestamp();

          expect(zoneOwner.addr).to.equal(user1);
          expect(zoneOwner.lastTaxTime).to.be.bignumber.equal(
            str(lastBlockTimestamp)
          );
          expect(zoneOwner.staked).to.be.bignumber.equal(
            ethToWei(MIN_ZONE_DTH_STAKE)
          );
          expect(zoneOwner.balance).to.be.bignumber.below(zoneOwner.staked);
          expect(zoneOwner.auctionId).to.be.bignumber.equal("0");

          expect(lastAuction.id).to.be.bignumber.equal("1");
          expect(lastAuction.state).to.be.bignumber.equal(
            ZONE_AUCTION_STATE_STARTED
          );
          expect(lastAuction.startTime).to.be.bignumber.equal(
            str(lastBlockTimestamp)
          );
          expect(lastAuction.endTime).to.be.bignumber.equal(
            str(lastBlockTimestamp + BID_PERIOD)
          );
          expect(lastAuction.highestBidder).to.equal(user2);
          const bidMinusEntryFee = (await zoneInstance.calcEntryFee(
            ethToWei(bidAmount)
          )).bidAmount;
          expect(lastAuction.highestBid).to.be.bignumber.equal(
            bidMinusEntryFee
          );
          // ref should be paid
          // TO DO ADD MORE TEST
          const newRefDthBalance = await dthInstance.balanceOf(user5);
          expect(newRefDthBalance).to.be.bignumber.above(oldRefDthBalance);
        });
        it("should be possible for a 2nd bidder or the zoneOwner to overbid bidder 1", async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + 1);
          const oldZoneDthBalance1 = await dthInstance.balanceOf(
            zoneInstance.address
          );
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address);
          const oldZoneDthBalance2 = await dthInstance.balanceOf(
            zoneInstance.address
          );
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address);
          const oldZoneDthBalance3 = await dthInstance.balanceOf(
            zoneInstance.address
          );
          await placeBid(user1, 30, zoneInstance.address);

          expect(
            dthInstance.balanceOf(zoneFactoryInstance.address)
          ).to.eventually.be.bignumber.equal("0");
          expect(dthInstance.balanceOf(user1)).to.eventually.be.bignumber.equal(
            "0"
          );
          expect(dthInstance.balanceOf(user2)).to.eventually.be.bignumber.equal(
            "0"
          );
          expect(dthInstance.balanceOf(user3)).to.eventually.be.bignumber.equal(
            "0"
          );
          expect(oldZoneDthBalance1).to.be.bignumber.below(oldZoneDthBalance2);
          expect(oldZoneDthBalance2).to.be.bignumber.below(oldZoneDthBalance3);
          expect(
            dthInstance.balanceOf(zoneInstance.address)
          ).to.eventually.be.bignumber.above(oldZoneDthBalance3);

          expect(
            zoneFactoryInstance.geohashToZone(asciiToHex(VALID_CG_ZONE_GEOHASH))
          ).to.eventually.equal(zoneInstance.address);
          expect(
            zoneFactoryInstance.zoneToGeohash(zoneInstance.address)
          ).to.eventually.equal(asciiToHex(VALID_CG_ZONE_GEOHASH));
          expect(
            zoneFactoryInstance.zoneExists(asciiToHex(VALID_CG_ZONE_GEOHASH))
          ).to.eventually.be.true;

          expect(zoneInstance.auctionExists("0")).to.eventually.be.false;
          expect(zoneInstance.auctionExists("1")).to.eventually.be.true;
          expect(zoneInstance.auctionExists("2")).to.eventually.be.false;

          const zoneOwner = zoneOwnerToObj(await zoneInstance.getZoneOwner());
          const lastAuction = auctionToObj(await zoneInstance.getLastAuction());

          const lastBlockTimestamp = await getLastBlockTimestamp();

          expect(zoneOwner.addr).to.equal(user1);
          expect(zoneOwner.lastTaxTime).to.be.bignumber.equal(
            lastAuction.startTime
          );
          expect(zoneOwner.staked).to.be.bignumber.equal(
            ethToWei(MIN_ZONE_DTH_STAKE)
          );
          expect(zoneOwner.balance).to.be.bignumber.below(zoneOwner.staked);
          expect(zoneOwner.auctionId).to.be.bignumber.equal("0");

          expect(lastAuction.id).to.be.bignumber.equal("1");
          expect(lastAuction.state).to.be.bignumber.equal(
            ZONE_AUCTION_STATE_STARTED
          );
          expect(lastAuction.startTime).to.be.bignumber.equal(
            str(lastBlockTimestamp)
          );
          expect(lastAuction.endTime).to.be.bignumber.equal(
            str(lastBlockTimestamp + BID_PERIOD)
          );
          expect(lastAuction.highestBidder).to.equal(user1);
          expect(lastAuction.highestBid).to.be.bignumber.equal(
            ethToWei(MIN_ZONE_DTH_STAKE + 30)
          );
        });
      });

      describe("[ERC223] Zone.topUp(address _from, uint _dthAmount)", () => {
        it("should revert if there is no zone owner", async () => {
          await zoneInstance.release({ from: user1 });
          await expectRevert2(
            topUp(user1, 10, zoneInstance.address),
            "zone has no owner"
          );
        });
        it("should revert if can not topUp while running auction", async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + 1);
          await placeBid(user2, 110, zoneInstance.address);
          await expectRevert2(
            topUp(user1, 110, zoneInstance.address),
            "cannot top up while auction running"
          );
        });
        it("should succeed if there is no running auction", async () => {
          const oldZoneDthBalance = await dthInstance.balanceOf(
            zoneInstance.address
          );
          await topUp(user1, 10, zoneInstance.address);

          expect(
            dthInstance.balanceOf(zoneFactoryInstance.address)
          ).to.eventually.be.bignumber.equal("0");
          expect(dthInstance.balanceOf(user1)).to.eventually.be.bignumber.equal(
            "0"
          );
          expect(
            dthInstance.balanceOf(zoneInstance.address)
          ).to.eventually.be.bignumber.above(oldZoneDthBalance);

          expect(
            zoneFactoryInstance.geohashToZone(asciiToHex(VALID_CG_ZONE_GEOHASH))
          ).to.eventually.equal(zoneInstance.address);
          expect(
            zoneFactoryInstance.zoneToGeohash(zoneInstance.address)
          ).to.eventually.equal(asciiToHex(VALID_CG_ZONE_GEOHASH));
          expect(
            zoneFactoryInstance.zoneExists(asciiToHex(VALID_CG_ZONE_GEOHASH))
          ).to.eventually.be.true;

          expect(zoneInstance.auctionExists("0")).to.eventually.be.false;
          expect(zoneInstance.auctionExists("1")).to.eventually.be.false;
          expect(zoneInstance.auctionExists("2")).to.eventually.be.false;

          const zoneOwner = zoneOwnerToObj(await zoneInstance.getZoneOwner());

          const lastBlockTimestamp = await getLastBlockTimestamp();

          expect(zoneOwner.addr).to.equal(user1);
          expect(zoneOwner.lastTaxTime).to.be.bignumber.equal(
            str(lastBlockTimestamp)
          );
          expect(zoneOwner.staked).to.be.bignumber.equal(
            ethToWei(MIN_ZONE_DTH_STAKE)
          );
          expect(zoneOwner.balance).to.be.bignumber.lte(
            ethToWei(MIN_ZONE_DTH_STAKE + 10)
          );
          expect(zoneOwner.auctionId).to.be.bignumber.equal("0");
        });
      });

      describe("Zone.release()", () => {
        it("should revert if caller is not the zone owner", async () => {
          await expectRevert(
            zoneInstance.release({ from: user2 }),
            "caller is not zoneowner"
          );
        });
        it("should revert if can not release while running auction", async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + 1);
          await placeBid(user2, 110, zoneInstance.address);
          await expectRevert(
            zoneInstance.release({ from: user1 }),
            "cannot release while auction running"
          );
        });
        it("should succeed if there is no running auction and country is enabled", async () => {
          await zoneInstance.release({ from: user1 });

          expect(
            dthInstance.balanceOf(zoneFactoryInstance.address)
          ).to.eventually.be.bignumber.equal("0");
          expect(dthInstance.balanceOf(user1)).to.eventually.be.bignumber.above(
            "0"
          );
          expect(
            dthInstance.balanceOf(zoneInstance.address)
          ).to.eventually.be.bignumber.equal("0");

          expect(
            zoneFactoryInstance.geohashToZone(asciiToHex(VALID_CG_ZONE_GEOHASH))
          ).to.eventually.equal(zoneInstance.address);
          expect(
            zoneFactoryInstance.zoneToGeohash(zoneInstance.address)
          ).to.eventually.equal(asciiToHex(VALID_CG_ZONE_GEOHASH));
          expect(
            zoneFactoryInstance.zoneExists(asciiToHex(VALID_CG_ZONE_GEOHASH))
          ).to.eventually.be.true;

          expect(zoneInstance.auctionExists("0")).to.eventually.be.false;
          expect(zoneInstance.auctionExists("1")).to.eventually.be.false;
          expect(zoneInstance.auctionExists("2")).to.eventually.be.false;

          const zoneOwner = zoneOwnerToObj(await zoneInstance.getZoneOwner());

          expect(zoneOwner.addr).to.equal(ADDRESS_ZERO);
          expect(zoneOwner.lastTaxTime).to.be.bignumber.equal("0");
          expect(zoneOwner.staked).to.be.bignumber.equal("0");
          expect(zoneOwner.balance).to.be.bignumber.equal("0");
          expect(zoneOwner.auctionId).to.be.bignumber.equal("0");
        });
      });

      describe("Zone.withdrawFromAuction(uint _auctionId)", () => {
        it("should revert if auction does not exist", async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address); // loser, can withdraw
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
          await expectRevert(
            zoneInstance.withdrawFromAuction("2", { from: user2 }),
            "auctionId does not exist"
          );
        });
        it("should revert if auction is still running", async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address); // loser, can withdraw
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address); // winner
          await expectRevert(
            zoneInstance.withdrawFromAuction("1", { from: user2 }),
            "cannot withdraw while auction is active"
          );
        });
        it("should revert if winning bidder tries to withdraw", async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address); // loser, can withdraw
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
          await expectRevert(
            zoneInstance.withdrawFromAuction("1", { from: user3 }),
            "auction winner can not withdraw"
          );
        });
        it("should revert if nothing to withdraw", async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address); // loser, can withdraw
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
          await zoneInstance.withdrawFromAuction("1", { from: user2 });
          await expectRevert(
            zoneInstance.withdrawFromAuction("1", { from: user2 }),
            "nothing to withdraw"
          );
        });
        it("should succeed while country is enabled", async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address); // loser, can withdraw
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 20, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
          await zoneInstance.withdrawFromAuction("1", { from: user2 });
        });
        describe("when succeeds after bid period ended", () => {
          let user1dthBalanceBefore;
          let user2dthBalanceBefore;
          let user3dthBalanceBefore;
          let user2bidAmount;
          let auctionBefore;
          let withdrawTxTimestamp;
          beforeEach(async () => {
            await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
            let zoneOwnerAfter = zoneOwnerToObjPretty(
              await zoneInstance.getZoneOwner()
            );
            await placeBid(
              user2,
              MIN_ZONE_DTH_STAKE + 10,
              zoneInstance.address
            ); // loser, can withdraw
            await placeBid(user1, 20, zoneInstance.address);
            await placeBid(
              user4,
              MIN_ZONE_DTH_STAKE + 40,
              zoneInstance.address
            ); // loser, can withdraw
            await placeBid(
              user3,
              MIN_ZONE_DTH_STAKE + 60,
              zoneInstance.address
            ); // winner

            zoneOwnerAfter = zoneOwnerToObjPretty(
              await zoneInstance.getZoneOwner()
            );
            auctionLive = auctionToObjPretty(
              await zoneInstance.getLastAuction()
            );
            await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
            user1dthBalanceBefore = await dthInstance.balanceOf(user1);
            user2dthBalanceBefore = await dthInstance.balanceOf(user2);
            user3dthBalanceBefore = await dthInstance.balanceOf(user3);
            user2bidAmount = await zoneInstance.auctionBids("1", user2);
            auctionBefore = auctionToObj(await zoneInstance.getLastAuction());
            const tx = await zoneInstance.withdrawFromAuction("1", {
              from: user2
            });

            zoneOwnerAfter = zoneOwnerToObjPretty(
              await zoneInstance.getZoneOwner()
            );
            auctionLive = auctionToObjPretty(
              await zoneInstance.getLastAuction()
            );

            withdrawTxTimestamp = (await web3.eth.getBlock(
              tx.receipt.blockNumber
            )).timestamp;
          });
          it.skip("after current bid and release zone, zoneOwner stake + balance should be updated to good amount", async () => {
            let zoneOwnerAfter = zoneOwnerToObjPretty(
              await zoneInstance.getZoneOwner()
            );
            // const tx = await zoneInstance.withdrawDth({
            //   from: user1
            // });
            console.log(
              "\n\n----->zone owner before release by user 3 and after user1 withdrawDth \n",
              zoneOwnerAfter,
              "zone DTH balance",
              weiToEth(
                (await dthInstance.balanceOf(zoneInstance.address)).toString()
              )
            );
            // OWNERTOGEOHASH
            console.log(
              "\n\n%%% USER 3 %%%",
              await zoneFactoryInstance.ownerToZone(user3),
              "\n DTH BALANCE\n",
              weiToEth((await dthInstance.balanceOf(user3)).toString()),
              "\n%%% Active bidder to zone %%%\n",
              await zoneFactoryInstance.activeBidderToZone(user3),
              "\nwithdrawableDth (owner)\n",
              weiToEth((await zoneInstance.withdrawableDth(user3)).toString()),
              "\nbid amount form this auction\n",
              weiToEth((await zoneInstance.auctionBids(1, user3)).toString())
            );
            // user 3 delete its zone
            await zoneInstance.release({ from: user3 });
            await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
            zoneOwnerAfter = zoneOwnerToObjPretty(
              await zoneInstance.getZoneOwner()
            );
            console.log(
              "\n\n----->zone owner after release by user 3 \n",
              zoneOwnerAfter,
              "zone DTH balance",
              weiToEth(
                (await dthInstance.balanceOf(zoneInstance.address)).toString()
              )
            );
            // OWNERTOGEOHASH
            console.log(
              "\n\n%%% USER 3 AFTER RELEASE %%%",
              await zoneFactoryInstance.ownerToZone(user3),
              "\n DTH BALANCE\n",
              weiToEth((await dthInstance.balanceOf(user3)).toString()),
              "\n%%% Active bidder to zone %%%\n",
              await zoneFactoryInstance.activeBidderToZone(user3),
              "\nwithdrawableDth (owner)\n",
              weiToEth((await zoneInstance.withdrawableDth(user3)).toString()),
              "\nbid amount form this auction\n",
              weiToEth((await zoneInstance.auctionBids(1, user3)).toString())
            );

            /*
             ********************
             * Was possible with the old implementation on release() to withdraw a second time in this case
             */
            // user withdraw a second time
            await zoneInstance.withdrawDth({ from: user3 });
            console.log(
              "\n\n----->zone owner after release by user 3 \n",
              zoneOwnerAfter,
              "zone DTH balance",
              weiToEth(
                (await dthInstance.balanceOf(zoneInstance.address)).toString()
              )
            );
            // OWNERTOGEOHASH
            console.log(
              "\n\n%%% USER 3 AFTER RELEASE %%%",
              await zoneFactoryInstance.ownerToZone(user3),
              "\n DTH BALANCE\n",
              weiToEth((await dthInstance.balanceOf(user3)).toString()),
              "\n%%% Active bidder to zone %%%\n",
              await zoneFactoryInstance.activeBidderToZone(user3),
              "\nwithdrawableDth (owner)\n",
              weiToEth((await zoneInstance.withdrawableDth(user3)).toString()),
              "\nbid amount form this auction\n",
              weiToEth((await zoneInstance.auctionBids(1, user3)).toString())
            );
            /*
             * ***********************
             */

            //   // user 3 claim the zone again
            //   await claimFreeZone(
            //     user3,
            //     MIN_ZONE_DTH_STAKE,
            //     zoneInstance.address
            //   );
            //   zoneOwnerAfter = zoneOwnerToObjPretty(
            //     await zoneInstance.getZoneOwner()
            //   );
            //   console.log(
            //     "\n\n----->zone owner after claim again by user 3 \n",
            //     zoneOwnerAfter,
            //     "zone DTH balance",
            //     weiToEth(
            //       (await dthInstance.balanceOf(zoneInstance.address)).toString()
            //     )
            //   );
            //   console.log(
            //     "\n\n%%% USER 3 AFTER RELEASE %%%",
            //     await zoneFactoryInstance.ownerToZone(user3),
            //     "\n DTH BALANCE\n",
            //     weiToEth((await dthInstance.balanceOf(user3)).toString()),
            //     "\n%%% Active bidder to zone %%%\n",
            //     await zoneFactoryInstance.activeBidderToZone(user3),
            //     "\nwithdrawableDth (owner)\n",
            //     weiToEth((await zoneInstance.withdrawableDth(user3)).toString()),
            //     "\nbid amount form this auction\n",
            //     weiToEth((await zoneInstance.auctionBids(1, user3)).toString())
            //   );

            //   // user2 open a bid on
            //   await timeTravel.inSecs(COOLDOWN_PERIOD + 120);
            //   await placeBid(
            //     user2,
            //     MIN_ZONE_DTH_STAKE + 20,
            //     zoneInstance.address
            //   ); //
            //   let auctionLive = auctionToObj(await zoneInstance.getLastAuction());
            //   // console.log("\nCURRENT AUCTION:\n", auctionLive);
            //   // take a look at the data
            //   zoneOwnerAfter = zoneOwnerToObjPretty(
            //     await zoneInstance.getZoneOwner()
            //   );
            //   console.log("\n\n\n----> user 2 open a bid\n", zoneOwnerAfter);
            //   auctionLive = auctionToObjPretty(
            //     await zoneInstance.getLastAuction()
            //   );
            //   console.log("\nCURRENT AUCTION:\n", auctionLive);
            //   // OWNERTOGEOHASH
            //   console.log(
            //     "\n\n%%% OWNER TO ZONE USER 1 \n%%%",
            //     await zoneFactoryInstance.ownerToZone(user1),
            //     "\n DTH BALANCE\n",
            //     weiToEth((await dthInstance.balanceOf(user1)).toString()),
            //     "\n%%% Active bidder to zone %%%\n",
            //     await zoneFactoryInstance.activeBidderToZone(user1),
            //     "\nwithdrawableDth (owner)\n",
            //     weiToEth((await zoneInstance.withdrawableDth(user1)).toString()),
            //     "\nbid amount form this auction\n",
            //     weiToEth((await zoneInstance.auctionBids(2, user1)).toString())
            //   );
            //   console.log(
            //     "\n\n%%% OWNER TO ZONE USER 2 (AFTER USER 2 BID) -> 120 %%%",
            //     await zoneFactoryInstance.ownerToZone(user2),
            //     "\n DTH BALANCE\n",
            //     weiToEth((await dthInstance.balanceOf(user2)).toString()),
            //     "\n%%% Active bidder to zone %%%\n",
            //     await zoneFactoryInstance.activeBidderToZone(user2),
            //     "\nwithdrawableDth (owner)\n",
            //     weiToEth((await zoneInstance.withdrawableDth(user2)).toString()),
            //     "\nbid amount form this auction\n",
            //     weiToEth((await zoneInstance.auctionBids(2, user2)).toString())
            //   );
            //   console.log(
            //     "\n\n%%% OWNER TO ZONE USER 3 (NEW OWNER AFTER CLAIM) %%%",
            //     await zoneFactoryInstance.ownerToZone(user3),
            //     "\n DTH BALANCE\n",
            //     weiToEth((await dthInstance.balanceOf(user3)).toString()),
            //     "\n%%% Active bidder to zone %%%\n",
            //     await zoneFactoryInstance.activeBidderToZone(user3),
            //     "\nwithdrawableDth (owner)\n",
            //     weiToEth((await zoneInstance.withdrawableDth(user3)).toString()),
            //     "\nbid amount form this auction\n",
            //     weiToEth((await zoneInstance.auctionBids(2, user3)).toString())
            //   );

            //   // user 3 bid again
            //   await placeBid(user3, 50, zoneInstance.address);
            //   zoneOwnerAfter = zoneOwnerToObjPretty(
            //     await zoneInstance.getZoneOwner()
            //   );
            //   console.log(
            //     "\n\n\n----> user 3(zone owner bid again) \n",
            //     zoneOwnerAfter,
            //     "zone DTH balance",
            //     weiToEth(
            //       (await dthInstance.balanceOf(zoneInstance.address)).toString()
            //     )
            //   );
            //   auctionLive = auctionToObjPretty(
            //     await zoneInstance.getLastAuction()
            //   );
            //   console.log("\nCURRENT AUCTION:\n", auctionLive);

            //   // OWNERTOGEOHASH
            //   console.log(
            //     "\n\n%%% OWNER TO ZONE USER 1 %%%",
            //     await zoneFactoryInstance.ownerToZone(user1),
            //     "\n DTH BALANCE\n",
            //     weiToEth((await dthInstance.balanceOf(user1)).toString()),
            //     "\n%%% Active bidder to zone %%%\n",
            //     await zoneFactoryInstance.activeBidderToZone(user1),
            //     "\nwithdrawableDth (owner)\n",
            //     weiToEth((await zoneInstance.withdrawableDth(user1)).toString()),
            //     "\nbid amount form this auction\n",
            //     weiToEth((await zoneInstance.auctionBids(2, user1)).toString())
            //   );
            //   console.log(
            //     "\n\n%%% OWNER TO ZONE USER 2  100 %%%",
            //     await zoneFactoryInstance.ownerToZone(user2),
            //     "\n DTH BALANCE\n",
            //     weiToEth((await dthInstance.balanceOf(user2)).toString()),
            //     "\n%%% Active bidder to zone %%%\n",
            //     await zoneFactoryInstance.activeBidderToZone(user2),
            //     "\nwithdrawableDth (owner)\n",
            //     weiToEth((await zoneInstance.withdrawableDth(user2)).toString()),
            //     "\nbid amount form this auction\n",
            //     weiToEth((await zoneInstance.auctionBids(2, user2)).toString())
            //   );
            //   console.log(
            //     "\n\n%%% OWNER TO ZONE USER 3 -> 100 + 50 %%%",
            //     await zoneFactoryInstance.ownerToZone(user3),
            //     "\n DTH BALANCE\n",
            //     weiToEth((await dthInstance.balanceOf(user3)).toString()),
            //     "\n%%% Active bidder to zone %%%\n",
            //     await zoneFactoryInstance.activeBidderToZone(user3),
            //     "\nwithdrawableDth (owner)\n",
            //     weiToEth((await zoneInstance.withdrawableDth(user3)).toString()),
            //     "\nbid amount form this auction\n",
            //     weiToEth((await zoneInstance.auctionBids(2, user3)).toString())
            //   );

            //   await placeBid(
            //     user1,
            //     MIN_ZONE_DTH_STAKE + 80,
            //     zoneInstance.address
            //   );
            //   zoneOwnerAfter = zoneOwnerToObjPretty(
            //     await zoneInstance.getZoneOwner()
            //   );
            //   console.log(
            //     "\n\n\n----> user 1 biz on the auction \n",
            //     zoneOwnerAfter,
            //     "zone DTH balance",
            //     weiToEth(
            //       (await dthInstance.balanceOf(zoneInstance.address)).toString()
            //     )
            //   );
            //   auctionLive = auctionToObjPretty(
            //     await zoneInstance.getLastAuction()
            //   );
            //   console.log("\nCURRENT AUCTION:\n", auctionLive);

            //   console.log(
            //     "\n\n%%% OWNER TO ZONE USER 1 -> 180 %%%",
            //     await zoneFactoryInstance.ownerToZone(user1),
            //     "\n DTH BALANCE\n",
            //     weiToEth((await dthInstance.balanceOf(user1)).toString()),
            //     "\n%%% Active bidder to zone %%%\n",
            //     await zoneFactoryInstance.activeBidderToZone(user1),
            //     "\nwithdrawableDth (owner)\n",
            //     weiToEth((await zoneInstance.withdrawableDth(user1)).toString()),
            //     "\nbid amount form this auction\n",
            //     weiToEth((await zoneInstance.auctionBids(2, user1)).toString())
            //   );
            //   console.log(
            //     "\n\n%%% OWNER TO ZONE USER 2 -> 120  %%%",
            //     await zoneFactoryInstance.ownerToZone(user2),
            //     "\n DTH BALANCE\n",
            //     weiToEth((await dthInstance.balanceOf(user2)).toString()),
            //     "\n%%% Active bidder to zone %%%\n",
            //     await zoneFactoryInstance.activeBidderToZone(user2),
            //     "\nwithdrawableDth (owner)\n",
            //     weiToEth((await zoneInstance.withdrawableDth(user2)).toString()),
            //     "\nbid amount form this auction\n",
            //     weiToEth((await zoneInstance.auctionBids(2, user2)).toString())
            //   );
            //   console.log(
            //     "\n\n%%% OWNER TO ZONE USER 3 -> 100 + 50 %%%",
            //     await zoneFactoryInstance.ownerToZone(user3),
            //     "\n DTH BALANCE\n",
            //     weiToEth((await dthInstance.balanceOf(user3)).toString()),
            //     "\nwithdrawableDth (owner)\n",
            //     weiToEth((await zoneInstance.withdrawableDth(user3)).toString()),
            //     "\nbid amount form this auction\n",
            //     weiToEth((await zoneInstance.auctionBids(2, user3)).toString())
            //   );

            //   await placeBid(user2, MIN_ZONE_DTH_STAKE, zoneInstance.address);
            //   zoneOwnerAfter = zoneOwnerToObjPretty(
            //     await zoneInstance.getZoneOwner()
            //   );
            //   console.log(
            //     "\n\n\n----> USER 2 place a bid again\n",
            //     zoneOwnerAfter,
            //     "zone DTH balance",
            //     weiToEth(
            //       (await dthInstance.balanceOf(zoneInstance.address)).toString()
            //     )
            //   );
            //   auctionLive = auctionToObjPretty(
            //     await zoneInstance.getLastAuction()
            //   );
            //   console.log("\nCURRENT AUCTION:\n", auctionLive);

            //   console.log(
            //     "\n\n%%% OWNER TO ZONE USER 1 -> 180 %%%",
            //     await zoneFactoryInstance.ownerToZone(user1),
            //     "\n DTH BALANCE\n",
            //     weiToEth((await dthInstance.balanceOf(user1)).toString()),
            //     "\n%%% Active bidder to zone %%%\n",
            //     await zoneFactoryInstance.activeBidderToZone(user1),
            //     "\nwithdrawableDth (owner)\n",
            //     weiToEth((await zoneInstance.withdrawableDth(user1)).toString()),
            //     "\nbid amount form this auction\n",
            //     weiToEth((await zoneInstance.auctionBids(2, user1)).toString())
            //   );
            //   console.log(
            //     "\n\n%%% OWNER TO ZONE USER 2 -> 120 + 100 %%%",
            //     await zoneFactoryInstance.ownerToZone(user2),
            //     "\n DTH BALANCE\n",
            //     weiToEth((await dthInstance.balanceOf(user2)).toString()),
            //     "\n%%% Active bidder to zone %%%\n",
            //     await zoneFactoryInstance.activeBidderToZone(user2),
            //     "\nwithdrawableDth (owner)\n",
            //     weiToEth((await zoneInstance.withdrawableDth(user2)).toString()),
            //     "\nbid amount form this auction\n",
            //     weiToEth((await zoneInstance.auctionBids(2, user2)).toString())
            //   );
            //   console.log(
            //     "\n\n%%% OWNER TO ZONE USER 3  -> 100 + 50 %%%",
            //     await zoneFactoryInstance.ownerToZone(user3),
            //     "\n DTH BALANCE\n",
            //     weiToEth((await dthInstance.balanceOf(user3)).toString()),
            //     "\nwithdrawableDth (owner)\n",
            //     weiToEth((await zoneInstance.withdrawableDth(user3)).toString()),
            //     "\nbid amount form this auction\n",
            //     weiToEth((await zoneInstance.auctionBids(2, user3)).toString())
            //   );

            //   await placeBid(user3, 120, zoneInstance.address);
            //   zoneOwnerAfter = zoneOwnerToObjPretty(
            //     await zoneInstance.getZoneOwner()
            //   );
            //   console.log(
            //     "\n\n\n----> USER 3 placer a  bid again\n",
            //     zoneOwnerAfter,
            //     "zone DTH balance",
            //     weiToEth(
            //       (await dthInstance.balanceOf(zoneInstance.address)).toString()
            //     )
            //   );
            //   auctionLive = auctionToObjPretty(
            //     await zoneInstance.getLastAuction()
            //   );
            //   console.log("\nCURRENT AUCTION:\n", auctionLive);

            //   console.log(
            //     "\n\n%%% OWNER TO ZONE USER 1 -> 180 %%%",
            //     await zoneFactoryInstance.ownerToZone(user1),
            //     "\n DTH BALANCE\n",
            //     weiToEth((await dthInstance.balanceOf(user1)).toString()),
            //     "\n%%% Active bidder to zone %%%\n",
            //     await zoneFactoryInstance.activeBidderToZone(user1),
            //     "\nwithdrawableDth (owner)\n",
            //     weiToEth((await zoneInstance.withdrawableDth(user1)).toString()),
            //     "\nbid amount form this auction\n",
            //     weiToEth((await zoneInstance.auctionBids(2, user1)).toString())
            //   );
            //   console.log(
            //     "\n\n%%% OWNER TO ZONE USER 2 -> 120 + 100 %%%",
            //     await zoneFactoryInstance.ownerToZone(user2),
            //     "\n DTH BALANCE\n",
            //     weiToEth((await dthInstance.balanceOf(user2)).toString()),
            //     "\n%%% Active bidder to zone %%%\n",
            //     await zoneFactoryInstance.activeBidderToZone(user2),
            //     "\nwithdrawableDth (owner)\n",
            //     weiToEth((await zoneInstance.withdrawableDth(user2)).toString()),
            //     "\nbid amount form this auction\n",
            //     weiToEth((await zoneInstance.auctionBids(2, user2)).toString())
            //   );
            //   console.log(
            //     "\n\n%%% OWNER TO ZONE USER 3 -> 100 (as owner) + 50 + 120  %%%",
            //     await zoneFactoryInstance.ownerToZone(user3),
            //     "\n DTH BALANCE\n",
            //     weiToEth((await dthInstance.balanceOf(user3)).toString()),
            //     "\nwithdrawableDth (owner)\n",
            //     weiToEth((await zoneInstance.withdrawableDth(user3)).toString()),
            //     "\nbid amount form this auction\n",
            //     weiToEth((await zoneInstance.auctionBids(2, user3)).toString())
            //   );

            //   await placeBid(user2, 150, zoneInstance.address);
            //   zoneOwnerAfter = zoneOwnerToObjPretty(
            //     await zoneInstance.getZoneOwner()
            //   );
            //   console.log(
            //     "\n\n\n----> USER 2 place a bid again \n",
            //     zoneOwnerAfter,
            //     "zone DTH balance",
            //     weiToEth(
            //       (await dthInstance.balanceOf(zoneInstance.address)).toString()
            //     )
            //   );
            //   auctionLive = auctionToObjPretty(
            //     await zoneInstance.getLastAuction()
            //   );
            //   console.log("\nCURRENT AUCTION:\n", auctionLive);

            //   console.log(
            //     "\n\n%%% OWNER TO ZONE USER 1 -> 180 %%%",
            //     await zoneFactoryInstance.ownerToZone(user1),
            //     "\n DTH BALANCE\n",
            //     weiToEth((await dthInstance.balanceOf(user1)).toString()),
            //     "\n%%% Active bidder to zone %%%\n",
            //     await zoneFactoryInstance.activeBidderToZone(user1),
            //     "\nwithdrawableDth (owner)\n",
            //     weiToEth((await zoneInstance.withdrawableDth(user1)).toString()),
            //     "\nbid amount form this auction\n",
            //     weiToEth((await zoneInstance.auctionBids(2, user1)).toString())
            //   );
            //   console.log(
            //     "\n\n%%% OWNER TO ZONE USER 2 -> 120 + 100 + 150 %%%",
            //     await zoneFactoryInstance.ownerToZone(user2),
            //     "\n DTH BALANCE\n",
            //     weiToEth((await dthInstance.balanceOf(user2)).toString()),
            //     "\n%%% Active bidder to zone %%%\n",
            //     await zoneFactoryInstance.activeBidderToZone(user2),
            //     "\nwithdrawableDth (owner)\n",
            //     weiToEth((await zoneInstance.withdrawableDth(user2)).toString()),
            //     "\nbid amount form this auction\n",
            //     weiToEth((await zoneInstance.auctionBids(2, user2)).toString())
            //   );
            //   console.log(
            //     "\n\n%%% OWNER TO ZONE USER 3 -> 100 + 50 + 120  %%%",
            //     await zoneFactoryInstance.ownerToZone(user3),
            //     "\n DTH BALANCE\n",
            //     weiToEth((await dthInstance.balanceOf(user3)).toString()),
            //     "\n%%% Active bidder to zone %%%\n",
            //     await zoneFactoryInstance.activeBidderToZone(user3),
            //     "\nwithdrawableDth (owner)\n",
            //     weiToEth((await zoneInstance.withdrawableDth(user3)).toString()),
            //     "\nbid amount form this auction\n",
            //     weiToEth((await zoneInstance.auctionBids(2, user3)).toString())
            //   );

            //   // calcul each balance

            //   // advance in time
            //   await timeTravel.inSecs(BID_PERIOD + 120);

            //     // process state by user1 withdraw

            //     await zoneInstance.withdrawFromAuction("2", { from: user1 });
            //   zoneOwnerAfter = zoneOwnerToObjPretty(
            //     await zoneInstance.getZoneOwner()
            //   );
            //   console.log(
            //     "\n\n\n----> USER 1 WITHDRAW FROM AUCTION\n",
            //     zoneOwnerAfter,
            //     "zone DTH balance",
            //     weiToEth(
            //       (await dthInstance.balanceOf(zoneInstance.address)).toString()
            //     )
            //   );
            //   auctionLive = auctionToObjPretty(
            //     await zoneInstance.getLastAuction()
            //   );
            //   console.log("\nCURRENT AUCTION:\n", auctionLive);

            //   console.log(
            //     "\n\n%%% OWNER TO ZONE USER 1 -> 180 %%%",
            //     await zoneFactoryInstance.ownerToZone(user1),
            //     "\n DTH BALANCE\n",
            //     weiToEth((await dthInstance.balanceOf(user1)).toString()),
            //     "\n%%% Active bidder to zone %%%\n",
            //     await zoneFactoryInstance.activeBidderToZone(user1),
            //     "\nwithdrawableDth (owner)\n",
            //     weiToEth((await zoneInstance.withdrawableDth(user1)).toString()),
            //     "\nbid amount form this auction\n",
            //     weiToEth((await zoneInstance.auctionBids(2, user1)).toString())
            //   );
            //   console.log(
            //     "\n\n%%% OWNER TO ZONE USER 2 -> 120 + 100 + 150 %%%",
            //     await zoneFactoryInstance.ownerToZone(user2),
            //     "\n DTH BALANCE\n",
            //     weiToEth((await dthInstance.balanceOf(user2)).toString()),
            //     "\n%%% Active bidder to zone %%%\n",
            //     await zoneFactoryInstance.activeBidderToZone(user2),
            //     "\nwithdrawableDth (owner)\n",
            //     weiToEth((await zoneInstance.withdrawableDth(user2)).toString()),
            //     "\nbid amount form this auction\n",
            //     weiToEth((await zoneInstance.auctionBids(2, user2)).toString())
            //   );
            //   console.log(
            //     "\n\n%%% OWNER TO ZONE USER 3 -> 100 + 50 + 120  %%%",
            //     await zoneFactoryInstance.ownerToZone(user3),
            //     "\n DTH BALANCE\n",
            //     weiToEth((await dthInstance.balanceOf(user3)).toString()),
            //     "\n%%% Active bidder to zone %%%\n",
            //     await zoneFactoryInstance.activeBidderToZone(user3),
            //     "\nwithdrawableDth (owner)\n",
            //     weiToEth((await zoneInstance.withdrawableDth(user3)).toString()),
            //     "\nbid amount form this auction\n",
            //     weiToEth((await zoneInstance.auctionBids(2, user3)).toString())
            //   );

            //   // user 3 withdraw from auction
            //   await zoneInstance.withdrawFromAuction("2", { from: user3 });
            //   zoneOwnerAfter = zoneOwnerToObjPretty(
            //     await zoneInstance.getZoneOwner()
            //   );
            //   console.log(
            //     "\n\n\n----> USER 3 WITHDRAW FROM AUCTION\n",
            //     zoneOwnerAfter,
            //     "zone DTH balance",
            //     weiToEth(
            //       (await dthInstance.balanceOf(zoneInstance.address)).toString()
            //     )
            //   );
            //   auctionLive = auctionToObjPretty(
            //     await zoneInstance.getLastAuction()
            //   );
            //   console.log("\nCURRENT AUCTION:\n", auctionLive);

            //   console.log(
            //     "\n\n%%% OWNER TO ZONE USER 1 -> 180 %%%",
            //     await zoneFactoryInstance.ownerToZone(user1),
            //     "\n DTH BALANCE\n",
            //     weiToEth((await dthInstance.balanceOf(user1)).toString()),
            //     "\n%%% Active bidder to zone %%%\n",
            //     await zoneFactoryInstance.activeBidderToZone(user1),
            //     "\nwithdrawableDth (owner)\n",
            //     weiToEth((await zoneInstance.withdrawableDth(user1)).toString()),
            //     "\nbid amount form this auction\n",
            //     weiToEth((await zoneInstance.auctionBids(2, user1)).toString())
            //   );
            //   console.log(
            //     "\n\n%%% OWNER TO ZONE USER 2 -> 120 + 100 + 150 %%%",
            //     await zoneFactoryInstance.ownerToZone(user2),
            //     "\n DTH BALANCE\n",
            //     weiToEth((await dthInstance.balanceOf(user2)).toString()),
            //     "\n%%% Active bidder to zone %%%\n",
            //     await zoneFactoryInstance.activeBidderToZone(user2),
            //     "\nwithdrawableDth (owner)\n",
            //     weiToEth((await zoneInstance.withdrawableDth(user2)).toString()),
            //     "\nbid amount form this auction\n",
            //     weiToEth((await zoneInstance.auctionBids(2, user2)).toString())
            //   );
            //   console.log(
            //     "\n\n%%% OWNER TO ZONE USER 3 -> 100 + 50 + 120  %%%",
            //     await zoneFactoryInstance.ownerToZone(user3),
            //     "\n DTH BALANCE\n",
            //     weiToEth((await dthInstance.balanceOf(user3)).toString()),
            //     "\n%%% Active bidder to zone %%%\n",
            //     await zoneFactoryInstance.activeBidderToZone(user3),
            //     "\nwithdrawableDth (owner)\n",
            //     weiToEth((await zoneInstance.withdrawableDth(user3)).toString()),
            //     "\nbid amount form this auction\n",
            //     weiToEth((await zoneInstance.auctionBids(2, user3)).toString())
            //   );
          });
          it("user auction bid should be reset to 0", () => {
            expect(
              zoneInstance.auctionBids("1", user2)
            ).to.eventually.be.bignumber.equal("0");
          });
          it("user dth balance should have increased by withdrawn bid amount", async () => {
            const user2dthBalanceAfter = await dthInstance.balanceOf(user2);
            const expectedNewDthBalance = user2dthBalanceBefore.add(
              user2bidAmount
            );
            expect(user2dthBalanceAfter).to.be.bignumber.equal(
              expectedNewDthBalance
            );
          });
          it("previous zoneOwner and winning bidder dth balance should not have changed", async () => {
            const user1dthBalanceAfter = await dthInstance.balanceOf(user1);
            const user3dthBalanceAfter = await dthInstance.balanceOf(user3);
            expect(user1dthBalanceAfter).to.be.bignumber.equal(
              user1dthBalanceBefore
            );
            expect(user3dthBalanceAfter).to.be.bignumber.equal(
              user3dthBalanceBefore
            );
          });
          it("auction state should have changed to Ended", async () => {
            const auctionAfter = auctionToObj(
              await zoneInstance.getLastAuction()
            );
            expect(auctionAfter.state).to.be.bignumber.equal(
              ZONE_AUCTION_STATE_ENDED
            );
          });
          it("all other auction fields should have not changed", async () => {
            const auctionAfter = auctionToObj(
              await zoneInstance.getLastAuction()
            );
            expect(auctionAfter.id).to.be.bignumber.equal(auctionBefore.id);
            expect(auctionAfter.startTime).to.be.bignumber.equal(
              auctionBefore.startTime
            );
            expect(auctionAfter.endTime).to.be.bignumber.equal(
              auctionBefore.endTime
            );
            expect(auctionAfter.highestBidder).to.equal(
              auctionBefore.highestBidder
            );
            expect(auctionAfter.highestBid).to.be.bignumber.equal(
              auctionBefore.highestBid
            );
          });
          it("zoneOwner lastTaxTime should equal withdraw tx timestamp", async () => {
            const zoneOwnerAfter = zoneOwnerToObj(
              await zoneInstance.getZoneOwner()
            );
            expect(zoneOwnerAfter.lastTaxTime).to.be.bignumber.equal(
              str(withdrawTxTimestamp)
            );
          });
          it("zoneOwner addr should be updated to last auction winner", async () => {
            const zoneOwnerAfter = zoneOwnerToObj(
              await zoneInstance.getZoneOwner()
            );
            expect(zoneOwnerAfter.addr).to.equal(user3);
          });
          it("zoneOwner stake + balance should be updated to winning bid minus entry fee (minus taxes)", async () => {
            const zoneOwnerAfter = zoneOwnerToObj(
              await zoneInstance.getZoneOwner()
            );
            const bidMinusEntryFee = (await zoneInstance.calcEntryFee(
              ethToWei(MIN_ZONE_DTH_STAKE + 60)
            )).bidAmount;
            expect(zoneOwnerAfter.staked).to.be.bignumber.equal(
              bidMinusEntryFee
            );
            const lastAuctionEndTime = zoneOwnerAfter.startTime; // we just added a zoneowner, his startTime will be that first auctions endTime
            const lastBlockTimestamp = await getLastBlockTimestamp();
            const bidMinusTaxesPaid = (await zoneInstance.calcHarbergerTax(
              lastAuctionEndTime,
              lastBlockTimestamp,
              bidMinusEntryFee
            )).keepAmount;
            expect(zoneOwnerAfter.balance).to.be.bignumber.equal(
              bidMinusTaxesPaid
            );
          });
          it("zoneOwner auctionId should be updated to last auction id", async () => {
            const zoneOwnerAfter = zoneOwnerToObj(
              await zoneInstance.getZoneOwner()
            );
            expect(zoneOwnerAfter.auctionId).to.be.bignumber.equal("1");
          });
        });
      });
      describe("Zone.withdrawFromAuctions(uint[] _auctionIds)", () => {
        it("should succeed to withdraw all of a users withdrawable bids", async () => {
          // TO DO: modify the test with MIN_RAISE of 5% ans
          // auction 1
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 25, zoneInstance.address); // loser
          await placeBid(user4, MIN_ZONE_DTH_STAKE + 40, zoneInstance.address); // loser
          await placeBid(user5, MIN_ZONE_DTH_STAKE + 55, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);

          await zoneInstance.withdrawFromAuction(1, { from: user2 });
          await zoneInstance.withdrawFromAuction(1, { from: user3 });
          await zoneInstance.withdrawFromAuction(1, { from: user4 });
          await zoneInstance.withdrawDth({ from: user1 });

          // auction 2
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user1, MIN_ZONE_DTH_STAKE + 75, zoneInstance.address); // loser
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 95, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 120, zoneInstance.address); // loser
          await placeBid(user4, MIN_ZONE_DTH_STAKE + 145, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);

          await zoneInstance.withdrawFromAuction(2, { from: user1 });
          await zoneInstance.withdrawFromAuction(2, { from: user2 });
          await zoneInstance.withdrawFromAuctions(["1", "2"], {
            from: user3
          });
          // await zoneInstance.withdrawFromAuction(2, { from: user4 });

          // auction 3
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user1, MIN_ZONE_DTH_STAKE + 170, zoneInstance.address); // loser
          const lastAuctionBlockTimestamp = await getLastBlockTimestamp();
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 195, zoneInstance.address); // loser
          await placeBid(user5, MIN_ZONE_DTH_STAKE + 225, zoneInstance.address); // loser
          await placeBid(user3, MIN_ZONE_DTH_STAKE + 255, zoneInstance.address); // winner
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);

          await zoneInstance.withdrawFromAuction(3, {
            from: user1
          });
          await zoneInstance.withdrawFromAuction(3, {
            from: user2
          });
          await zoneInstance.withdrawDth({
            from: user4
          });
          await zoneInstance.withdrawFromAuction(3, {
            from: user5
          });
          // await zoneInstance.withdrawDth({ from: user1 });
          // await zoneInstance.withdrawDth({ from: user5 });
          // await zoneInstance.withdrawDth({ from: user4 });

          // TOD CALC THE GOOD AMOUNT
          const user2bid1MinusEntryFee1 = (await zoneInstance.calcEntryFee(
            ethToWei(MIN_ZONE_DTH_STAKE + 10)
          )).bidAmount;
          const user2bid1MinusEntryFee2 = (await zoneInstance.calcEntryFee(
            ethToWei(MIN_ZONE_DTH_STAKE + 60)
          )).bidAmount;
          const user2bid1MinusEntryFee3 = (await zoneInstance.calcEntryFee(
            ethToWei(MIN_ZONE_DTH_STAKE + 100)
          )).bidAmount;

          // // expect time

          // expect(
          //   dthInstance.balanceOf(zoneFactoryInstance.address)
          // ).to.eventually.be.bignumber.equal("0");

          // expect(dthInstance.balanceOf(user2)).to.eventually.be.bignumber.equal(
          //   user2bid1MinusEntryFee1
          //     .add(user2bid1MinusEntryFee2)
          //     .add(user2bid1MinusEntryFee3)
          // );

          // expect(
          //   zoneFactoryInstance.geohashToZone(asciiToHex(VALID_CG_ZONE_GEOHASH))
          // ).to.eventually.equal(zoneInstance.address);
          // expect(
          //   zoneFactoryInstance.zoneToGeohash(zoneInstance.address)
          // ).to.eventually.equal(asciiToHex(VALID_CG_ZONE_GEOHASH));
          // expect(
          //   zoneFactoryInstance.zoneExists(asciiToHex(VALID_CG_ZONE_GEOHASH))
          // ).to.eventually.be.true;

          // expect(zoneInstance.auctionExists("0")).to.eventually.be.false;
          // expect(zoneInstance.auctionExists("1")).to.eventually.be.true;
          // expect(zoneInstance.auctionExists("2")).to.eventually.be.true;
          // expect(zoneInstance.auctionExists("3")).to.eventually.be.true;
          // expect(zoneInstance.auctionExists("4")).to.eventually.be.false;

          // const zoneOwner = zoneOwnerToObj(await zoneInstance.getZoneOwner());
          // const lastAuction = auctionToObj(await zoneInstance.getLastAuction());

          // const lastBlockTimestamp = await getLastBlockTimestamp();

          // expect(zoneOwner.addr).to.equal(user3);
          // expect(zoneOwner.lastTaxTime).to.be.bignumber.equal(
          //   str(lastBlockTimestamp)
          // );
          // const bidMinusEntryFeeUser3 = (await zoneInstance.calcEntryFee(
          //   ethToWei(MIN_ZONE_DTH_STAKE + 140)
          // )).bidAmount;
          // expect(zoneOwner.staked).to.be.bignumber.equal(bidMinusEntryFeeUser3);
          // const lastAuctionEndTime = lastAuctionBlockTimestamp + BID_PERIOD;
          // const bidMinusTaxesPaid = (await zoneInstance.calcHarbergerTax(
          //   lastAuctionEndTime,
          //   lastBlockTimestamp,
          //   bidMinusEntryFeeUser3
          // )).keepAmount;
          // expect(zoneOwner.balance).to.be.bignumber.equal(bidMinusTaxesPaid);
          // expect(zoneOwner.auctionId).to.be.bignumber.equal("3");

          // expect(lastAuction.id).to.be.bignumber.equal("3");
          // expect(lastAuction.state).to.be.bignumber.equal(
          //   ZONE_AUCTION_STATE_ENDED
          // );
          // expect(lastAuction.startTime).to.be.bignumber.equal(
          //   str(lastAuctionBlockTimestamp)
          // );
          // expect(lastAuction.endTime).to.be.bignumber.equal(
          //   str(lastAuctionBlockTimestamp + BID_PERIOD)
          // );
          // expect(lastAuction.highestBidder).to.equal(user3);
          // expect(lastAuction.highestBid).to.be.bignumber.equal(
          //   bidMinusEntryFeeUser3
          // );
        });
      });
    });

    describe("TELLER", () => {
      describe("Teller.addTeller(bytes _position, uint8 _currencyId, bytes16 _messenger, int16 _sellRate, int16 _buyRate, bytes1 _settings)", () => {
        it("should revert if position is empty bytes array", async () => {
          await expectRevert(
            tellerInstance.addTeller(
              "0x",
              TELLER_CG_CURRENCY_ID,
              asciiToHex(TELLER_CG_MESSENGER),
              TELLER_CG_SELLRATE,
              TELLER_CG_BUYRATE,
              TELLER_CG_SETTINGS,
              ADDRESS_ZERO,
              TELLER_CG_REFFEE,
              asciiToHex("ETH-BTC"),
              { from: user1 }
            ),
            "expected position to be 12 bytes"
          );
        });
        it("should revert if position is 11 bytes (instead of expected 12)", async () => {
          await expectRevert(
            tellerInstance.addTeller(
              asciiToHex("krcztsebccc"),
              TELLER_CG_CURRENCY_ID,
              asciiToHex(TELLER_CG_MESSENGER),
              TELLER_CG_SELLRATE,
              TELLER_CG_BUYRATE,
              TELLER_CG_SETTINGS,
              ADDRESS_ZERO,
              TELLER_CG_REFFEE,
              asciiToHex("ETH-BTC"),
              { from: user1 }
            ),
            "expected position to be 12 bytes"
          );
        });
        it("should revert if position is 13 bytes (instead of expected 12)", async () => {
          await expectRevert(
            tellerInstance.addTeller(
              asciiToHex("krcztsebcdeee"),
              TELLER_CG_CURRENCY_ID,
              asciiToHex(TELLER_CG_MESSENGER),
              TELLER_CG_SELLRATE,
              TELLER_CG_BUYRATE,
              TELLER_CG_SETTINGS,
              ADDRESS_ZERO,
              TELLER_CG_REFFEE,
              asciiToHex("ETH-BTC"),
              { from: user1 }
            ),
            "expected position to be 12 bytes"
          );
        });
        it("should revert if position does not match geohash of Zone contract", async () => {
          await expectRevert(
            tellerInstance.addTeller(
              asciiToHex("xxxxxxxbcddd"),
              TELLER_CG_CURRENCY_ID,
              asciiToHex(TELLER_CG_MESSENGER),
              TELLER_CG_SELLRATE,
              TELLER_CG_BUYRATE,
              TELLER_CG_SETTINGS,
              ADDRESS_ZERO,
              TELLER_CG_REFFEE,
              asciiToHex("ETH-BTC"),
              { from: user1 }
            ),
            "position is not inside this zone"
          );
        });
        it("should revert if position last 3 chars contain invalid geohash char", async () => {
          await expectRevert(
            // a is not a valid geohash char
            tellerInstance.addTeller(
              asciiToHex("krcztsebcdda"),
              TELLER_CG_CURRENCY_ID,
              asciiToHex(TELLER_CG_MESSENGER),
              TELLER_CG_SELLRATE,
              TELLER_CG_BUYRATE,
              TELLER_CG_SETTINGS,
              ADDRESS_ZERO,
              TELLER_CG_REFFEE,
              asciiToHex("ETH-BTC"),
              { from: user1 }
            ),
            "invalid position geohash characters"
          );
        });
        it("should revert if currency id is zero", async () => {
          await expectRevert(
            tellerInstance.addTeller(
              asciiToHex(TELLER_CG_POSITION),
              "0",
              asciiToHex(TELLER_CG_MESSENGER),
              TELLER_CG_SELLRATE,
              TELLER_CG_BUYRATE,
              TELLER_CG_SETTINGS,
              ADDRESS_ZERO,
              TELLER_CG_REFFEE,
              asciiToHex("ETH-BTC"),
              { from: user1 }
            ),
            "currency id must be in range 1-100"
          );
        });
        it("should revert if currency id is 101", async () => {
          await expectRevert(
            tellerInstance.addTeller(
              asciiToHex(TELLER_CG_POSITION),
              "101",
              asciiToHex(TELLER_CG_MESSENGER),
              TELLER_CG_SELLRATE,
              TELLER_CG_BUYRATE,
              TELLER_CG_SETTINGS,
              ADDRESS_ZERO,
              TELLER_CG_REFFEE,
              asciiToHex("ETH-BTC"),
              { from: user1 }
            ),
            "currency id must be in range 1-100"
          );
        });
        it("should revert if seller bit set -- sellrate less than -9999", async () => {
          await expectRevert(
            tellerInstance.addTeller(
              asciiToHex(TELLER_CG_POSITION),
              TELLER_CG_CURRENCY_ID,
              asciiToHex(TELLER_CG_MESSENGER),
              "-10000",
              TELLER_CG_BUYRATE,
              TELLER_CG_SETTINGS,
              ADDRESS_ZERO,
              TELLER_CG_REFFEE,
              asciiToHex("ETH-BTC"),
              { from: user1 }
            ),
            "sellRate should be between -999 and 9999"
          );
        });
        it("should revert if seller bit set -- sellrate more than than 9999", async () => {
          await expectRevert(
            tellerInstance.addTeller(
              asciiToHex(TELLER_CG_POSITION),
              TELLER_CG_CURRENCY_ID,
              asciiToHex(TELLER_CG_MESSENGER),
              "10000",
              TELLER_CG_BUYRATE,
              TELLER_CG_SETTINGS,
              ADDRESS_ZERO,
              TELLER_CG_REFFEE,
              asciiToHex("ETH-BTC"),
              { from: user1 }
            ),
            "sellRate should be between -999 and 9999"
          );
        });
        it("should revert if seller bit not set -- sellrate is not zero", async () => {
          await expectRevert(
            tellerInstance.addTeller(
              asciiToHex(TELLER_CG_POSITION),
              TELLER_CG_CURRENCY_ID,
              asciiToHex(TELLER_CG_MESSENGER),
              "1",
              TELLER_CG_BUYRATE,
              "0x02",
              ADDRESS_ZERO,
              TELLER_CG_REFFEE,
              asciiToHex("ETH-BTC"),
              { from: user1 }
            ),
            "cannot set sellRate if not set as seller"
          );
        });
        it("should revert if buyer bit set -- buyrate less than -9999", async () => {
          await expectRevert(
            tellerInstance.addTeller(
              asciiToHex(TELLER_CG_POSITION),
              TELLER_CG_CURRENCY_ID,
              asciiToHex(TELLER_CG_MESSENGER),
              TELLER_CG_SELLRATE,
              "-10000",
              TELLER_CG_SETTINGS,
              ADDRESS_ZERO,
              TELLER_CG_REFFEE,
              asciiToHex("ETH-BTC"),
              { from: user1 }
            ),
            "buyRate should be between -999 and 9999"
          );
        });
        it("should revert if buyer bit set -- buyrate more than than 9999", async () => {
          await expectRevert(
            tellerInstance.addTeller(
              asciiToHex(TELLER_CG_POSITION),
              TELLER_CG_CURRENCY_ID,
              asciiToHex(TELLER_CG_MESSENGER),
              TELLER_CG_SELLRATE,
              "10000",
              TELLER_CG_SETTINGS,
              ADDRESS_ZERO,
              TELLER_CG_REFFEE,
              asciiToHex("ETH-BTC"),
              { from: user1 }
            ),
            "buyRate should be between -999 and 9999"
          );
        });
        it("should revert if buyer bit not set -- buyrate is not zero", async () => {
          await expectRevert(
            tellerInstance.addTeller(
              asciiToHex(TELLER_CG_POSITION),
              TELLER_CG_CURRENCY_ID,
              asciiToHex(TELLER_CG_MESSENGER),
              TELLER_CG_SELLRATE,
              "1",
              "0x01",
              ADDRESS_ZERO,
              TELLER_CG_REFFEE,
              asciiToHex("ETH-BTC"),
              { from: user1 }
            ),
            "cannot set buyRate if not set as buyer"
          );
        });
        it("should revert if caller is not zone owner", async () => {
          await expectRevert(
            tellerInstance.addTeller(
              asciiToHex(TELLER_CG_POSITION),
              TELLER_CG_CURRENCY_ID,
              asciiToHex(TELLER_CG_MESSENGER),
              TELLER_CG_SELLRATE,
              TELLER_CG_BUYRATE,
              TELLER_CG_SETTINGS,
              ADDRESS_ZERO,
              TELLER_CG_REFFEE,
              asciiToHex("ETH-BTC"),
              { from: user2 }
            ),
            "caller is not zoneowner"
          );
        });
        it("should succeed if all args valid", async () => {
          await tellerInstance.addTeller(
            asciiToHex(TELLER_CG_POSITION),
            TELLER_CG_CURRENCY_ID,
            asciiToHex(TELLER_CG_MESSENGER),
            TELLER_CG_SELLRATE,
            TELLER_CG_BUYRATE,
            TELLER_CG_SETTINGS,
            user5,
            TELLER_CG_REFFEE,
            asciiToHex("ETH-BTC"),
            { from: user1 }
          );

          const zoneOwner = zoneOwnerToObj(await zoneInstance.getZoneOwner());
          const teller = tellerToObj(await tellerInstance.getTeller());
          const lastBlockTimestamp = await getLastBlockTimestamp();

          expect(zoneInstance.auctionExists("0")).to.eventually.be.false;
          expect(zoneInstance.auctionExists("1")).to.eventually.be.false;

          expect(zoneOwner.addr).to.equal(user1);
          expect(zoneOwner.lastTaxTime).to.be.bignumber.equal(
            str(lastBlockTimestamp)
          );
          expect(zoneOwner.staked).to.be.bignumber.equal(
            ethToWei(MIN_ZONE_DTH_STAKE)
          );
          expect(zoneOwner.balance).to.be.bignumber.lte(
            ethToWei(MIN_ZONE_DTH_STAKE)
          );
          expect(zoneOwner.auctionId).to.be.bignumber.equal("0");

          expect(teller.currencyId).to.be.bignumber.equal(
            TELLER_CG_CURRENCY_ID
          );
          expect(teller.messenger).to.equal(asciiToHex(TELLER_CG_MESSENGER));
          expect(teller.position).to.equal(asciiToHex(TELLER_CG_POSITION));
          expect(teller.settings).to.equal(TELLER_CG_SETTINGS);
          expect(teller.buyRate).to.be.bignumber.equal(TELLER_CG_BUYRATE);
          expect(teller.sellRate).to.be.bignumber.equal(TELLER_CG_SELLRATE);
          // expect(teller.funds).to.be.bignumber.equal('0');
          expect(teller.referrer).to.equal(user5);

          // expect(tellerInstance.getCertifiedComments()).to.eventually.be.an('array').with.lengthOf(0);
          expect(tellerInstance.getComments())
            .to.eventually.be.an("array")
            .with.lengthOf(0);
        });
        it("should succeed if all args valid to update", async () => {
          await tellerInstance.addTeller(
            asciiToHex(TELLER_CG_POSITION),
            TELLER_CG_CURRENCY_ID,
            asciiToHex(TELLER_CG_MESSENGER),
            TELLER_CG_SELLRATE,
            TELLER_CG_BUYRATE,
            TELLER_CG_SETTINGS,
            user5,
            TELLER_CG_REFFEE,
            asciiToHex("ETH-BTC"),
            { from: user1 }
          );

          const zoneOwner = zoneOwnerToObj(await zoneInstance.getZoneOwner());
          const teller = tellerToObj(await tellerInstance.getTeller());
          const lastBlockTimestamp = await getLastBlockTimestamp();
          expect(zoneInstance.auctionExists("0")).to.eventually.be.false;
          expect(zoneInstance.auctionExists("1")).to.eventually.be.false;

          expect(zoneOwner.addr).to.equal(user1);
          expect(zoneOwner.lastTaxTime).to.be.bignumber.equal(
            str(lastBlockTimestamp)
          );
          expect(zoneOwner.staked).to.be.bignumber.equal(
            ethToWei(MIN_ZONE_DTH_STAKE)
          );
          expect(zoneOwner.balance).to.be.bignumber.lte(
            ethToWei(MIN_ZONE_DTH_STAKE)
          );
          expect(zoneOwner.auctionId).to.be.bignumber.equal("0");

          expect(teller.currencyId).to.be.bignumber.equal(
            TELLER_CG_CURRENCY_ID
          );
          expect(teller.messenger).to.equal(asciiToHex(TELLER_CG_MESSENGER));
          expect(teller.position).to.equal(asciiToHex(TELLER_CG_POSITION));
          expect(teller.settings).to.equal(TELLER_CG_SETTINGS);
          expect(teller.buyRate).to.be.bignumber.equal(TELLER_CG_BUYRATE);
          expect(teller.sellRate).to.be.bignumber.equal(TELLER_CG_SELLRATE);
          // expect(teller.funds).to.be.bignumber.equal('0');
          expect(teller.referrer).to.equal(user5);

          // expect(tellerInstance.getCertifiedComments()).to.eventually.be.an('array').with.lengthOf(0);
          expect(tellerInstance.getComments())
            .to.eventually.be.an("array")
            .with.lengthOf(0);

          const NEW_POS = "krcztsebeeee";
          const NEW_CURRENCY_ID = "2";
          const NEW_MESSENGER = "new_messenger";
          const NEW_SELLRATE = "123";
          const NEW_BUYRATE = "321";
          const NEW_SETTINGS = "0x03";
          const NEW_DESCR = "2500-555-BTC/XMR/DOGE";
          // update
          await tellerInstance.updateTeller(
            asciiToHex(NEW_POS),
            NEW_CURRENCY_ID,
            asciiToHex(NEW_MESSENGER),
            NEW_SELLRATE,
            NEW_BUYRATE,
            NEW_SETTINGS,
            asciiToHex(NEW_DESCR),
            { from: user1 }
          );
          const teller2 = tellerToObj(await tellerInstance.getTeller());

          expect(teller2.currencyId).to.be.bignumber.equal(NEW_CURRENCY_ID);
          expect(teller2.position).to.equal(asciiToHex(NEW_POS));
          expect(teller2.settings).to.equal(NEW_SETTINGS);
          expect(teller2.buyRate).to.be.bignumber.equal(NEW_BUYRATE);
          expect(teller2.sellRate).to.be.bignumber.equal(NEW_SELLRATE);
          // expect(teller2.funds).to.be.bignumber.equal('0');
          expect(teller2.referrer).to.equal(user5);
        });
        it('should succeed if optional arg "messenger" is bytes16(0)', async () => {
          await tellerInstance.addTeller(
            asciiToHex(TELLER_CG_POSITION),
            TELLER_CG_CURRENCY_ID,
            "0x00000000000000000000000000000000",
            TELLER_CG_SELLRATE,
            TELLER_CG_BUYRATE,
            TELLER_CG_SETTINGS,
            user5,
            TELLER_CG_REFFEE,
            asciiToHex("ETH-BTC"),
            { from: user1 }
          );

          const teller = tellerToObj(await tellerInstance.getTeller());

          expect(teller.currencyId).to.be.bignumber.equal(
            TELLER_CG_CURRENCY_ID
          );
          expect(teller.messenger).to.equal(
            "0x00000000000000000000000000000000"
          );
          expect(teller.position).to.equal(asciiToHex(TELLER_CG_POSITION));
          expect(teller.settings).to.equal(TELLER_CG_SETTINGS);
          expect(teller.buyRate).to.be.bignumber.equal(TELLER_CG_BUYRATE);
          expect(teller.sellRate).to.be.bignumber.equal(TELLER_CG_SELLRATE);
          // expect(teller.funds).to.be.bignumber.equal('0');
          expect(teller.referrer).to.equal(user5);
        });
        it('should succeed if optional arg "referrer" is address(0)', async () => {
          await tellerInstance.addTeller(
            asciiToHex(TELLER_CG_POSITION),
            TELLER_CG_CURRENCY_ID,
            asciiToHex(TELLER_CG_MESSENGER),
            TELLER_CG_SELLRATE,
            TELLER_CG_BUYRATE,
            TELLER_CG_SETTINGS,
            ADDRESS_ZERO,
            TELLER_CG_REFFEE,
            asciiToHex("ETH-BTC"),
            { from: user1 }
          );

          const teller = tellerToObj(await tellerInstance.getTeller());

          expect(teller.currencyId).to.be.bignumber.equal(
            TELLER_CG_CURRENCY_ID
          );
          expect(teller.messenger).to.equal(asciiToHex(TELLER_CG_MESSENGER));
          expect(teller.position).to.equal(asciiToHex(TELLER_CG_POSITION));
          expect(teller.settings).to.equal(TELLER_CG_SETTINGS);
          expect(teller.buyRate).to.be.bignumber.equal(TELLER_CG_BUYRATE);
          expect(teller.sellRate).to.be.bignumber.equal(TELLER_CG_SELLRATE);
          // expect(teller.funds).to.be.bignumber.equal('0');
          expect(teller.referrer).to.equal(ADDRESS_ZERO);
        });
      });
      describe("Teller.addComment(bytes32 _commentHash)", () => {
        beforeEach(async () => {
          await tellerInstance.addTeller(
            asciiToHex(TELLER_CG_POSITION),
            TELLER_CG_CURRENCY_ID,
            asciiToHex(TELLER_CG_MESSENGER),
            TELLER_CG_SELLRATE,
            TELLER_CG_BUYRATE,
            TELLER_CG_SETTINGS,
            ADDRESS_ZERO,
            TELLER_CG_REFFEE,
            asciiToHex("ETH-BTC"),
            { from: user1 }
          );
        });
        it("should revert if comment hash is empty", async () => {
          await expectRevert(
            tellerInstance.addComment(BYTES32_ZERO, { from: user2 }),
            "comment hash cannot be 0x0"
          );
        });
        it("should revert if zone has no owner", async () => {
          await zoneInstance.release({ from: user1 });
          await expectRevert(
            tellerInstance.addComment(getRandomBytes32(), { from: user2 }),
            "zone has no owner"
          );
        });
        it("should revert if zone has no teller", async () => {
          await tellerInstance.removeTeller({ from: user1 });
          await expectRevert(
            tellerInstance.addComment(getRandomBytes32(), { from: user2 }),
            "no teller set"
          );
        });
        it("should revert if called by current zone owner", async () => {
          await expectRevert(
            tellerInstance.addComment(getRandomBytes32(), { from: user1 }),
            "can not be called by zoneowner"
          );
        });
        it("should succeed otherwise", async () => {
          await tellerInstance.addComment(getRandomBytes32(), { from: user2 });

          // expect(tellerInstance.getCertifiedComments()).to.eventually.be.an('array').with.lengthOf(0);
          expect(tellerInstance.getComments())
            .to.eventually.be.an("array")
            .with.lengthOf(1);
        });
      });
    });
  });

  describe("TaxCollector", () => {
    let zoneInstance;
    let tellerInstance;

    it("should have a positive balance and able to withdraw", async () => {
      const preBalance = await dthInstance.balanceOf(
        taxCollectorInstance.address
      );
      // console.log('balance pre', preBalance.toString());
      await enableAndLoadCountry(COUNTRY_CG);
      ({ zoneInstance, tellerInstance } = await createZone(
        user1,
        MIN_ZONE_DTH_STAKE,
        COUNTRY_CG,
        VALID_CG_ZONE_GEOHASH
      ));

      await tellerInstance.addTeller(
        asciiToHex(TELLER_CG_POSITION),
        TELLER_CG_CURRENCY_ID,
        asciiToHex(TELLER_CG_MESSENGER),
        TELLER_CG_SELLRATE,
        TELLER_CG_BUYRATE,
        TELLER_CG_SETTINGS,
        ADDRESS_BURN,
        TELLER_CG_REFFEE,
        asciiToHex("ETH-BTC"),
        { from: user1 }
      );
      // await tellerInstance.addFunds({ from: user1, value: ethToWei(1) });

      // lancer le fast forward avance dans le temp
      await timeTravel.inSecs(ONE_DAY * 365);
      await zoneInstance.processState();

      // lacher la zone
      await zoneInstance.release({ from: user1 });

      const postBalance = await dthInstance.balanceOf(
        taxCollectorInstance.address
      );
      // console.log('balance post', postBalance.toString());
      expect(postBalance).to.be.bignumber.gt(preBalance);

      const balanceZero = await dthInstance.balanceOf(ADDRESS_BURN);
      await taxCollectorInstance.collect({ from: user3 });
      const postBalance2 = await dthInstance.balanceOf(
        taxCollectorInstance.address
      );
      const balanceZero2 = await dthInstance.balanceOf(ADDRESS_BURN);
      expect(balanceZero2).to.be.bignumber.gt(balanceZero);
    });
  });

  describe("Getters", () => {
    describe("[ pure ]", () => {
      let zoneInstance;
      let tellerInstance;
      beforeEach(async () => {
        await enableAndLoadCountry(COUNTRY_CG);
        ({ zoneInstance, tellerInstance } = await createZone(
          user1,
          MIN_ZONE_DTH_STAKE,
          COUNTRY_CG,
          VALID_CG_ZONE_GEOHASH
        ));
      });
      describe("Zone.calcEntryFee(uint _bid)", () => {
        it("returns correct result for 100 dth", async () => {
          const res = await zoneInstance.calcEntryFee(ethToWei(100));
          expect(res.burnAmount).to.be.bignumber.equal(ethToWei(4)); // entry fee now 4%
          expect(res.bidAmount).to.be.bignumber.equal(ethToWei(96));
        });
        it("returns correct result for 101 dth", async () => {
          const res = await zoneInstance.calcEntryFee(ethToWei(101));
          expect(res.burnAmount).to.be.bignumber.equal(ethToWei(4.04));
          expect(res.bidAmount).to.be.bignumber.equal(ethToWei(96.96));
        });
      });
      describe("Zone.calcHarbergerTax(uint _startTime, uint _endTime, uint _dthAmount)", () => {
        it("[tax 1 hour] stake 100 dth ", async () => {
          const res = await zoneInstance.calcHarbergerTax(
            0,
            ONE_HOUR,
            ethToWei(100)
          );
          expect(res.taxAmount).to.be.bignumber.equal("1666666666666666");
          expect(res.keepAmount).to.be.bignumber.equal("99998333333333333334");
        });
        it("[tax 1 day] stake 100 dth ", async () => {
          const res = await zoneInstance.calcHarbergerTax(
            0,
            ONE_DAY,
            ethToWei(100)
          );
          expect(res.taxAmount).to.be.bignumber.equal("40000000000000000");
          expect(res.keepAmount).to.be.bignumber.equal("99960000000000000000");
        });
        it("returns correct result for 101 dth", async () => {
          const res = await zoneInstance.calcHarbergerTax(
            0,
            ONE_DAY,
            ethToWei(101)
          );
          expect(res.taxAmount).to.be.bignumber.equal("40400000000000000");
          expect(res.keepAmount).to.be.bignumber.equal("100959600000000000000");
        });
        it("returns correct result 15 second tax time", async () => {
          const res = await zoneInstance.calcHarbergerTax(0, 15, ethToWei(100));

          expect(res.taxAmount).to.be.bignumber.equal("6944444444444");
          expect(res.keepAmount).to.be.bignumber.equal("99999993055555555556");
        });
        it("returns correct result 1 year tax time", async () => {
          const res = await zoneInstance.calcHarbergerTax(
            0,
            ONE_DAY * 365,
            ethToWei(100)
          );

          expect(res.taxAmount).to.be.bignumber.equal("14600000000000000000");
          expect(res.keepAmount).to.be.bignumber.equal("85400000000000000000");
        });
      });
    });
    describe("[ view ]", () => {
      describe("Zone.getLastAuction()", () => {
        let zoneInstance;

        beforeEach(async () => {
          await enableAndLoadCountry(COUNTRY_CG);
          ({ zoneInstance } = await createZone(
            user1,
            MIN_ZONE_DTH_STAKE,
            COUNTRY_CG,
            VALID_CG_ZONE_GEOHASH
          ));
        });
        it("throws error when zone just got created", async () => {
          await expectRevert2(
            zoneInstance.getLastAuction(),
            "auction does not exist"
          );
        });
        it("returns correct auction when auction started", async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address);

          const lastAuction = auctionToObj(await zoneInstance.getLastAuction());
          expect(lastAuction.id.toNumber()).to.equal(1);
          expect(lastAuction.state.toString()).to.equal(
            ZONE_AUCTION_STATE_STARTED
          );
          expect(lastAuction.startTime.toNumber()).to.not.equal(0);
          expect(lastAuction.endTime.gt(lastAuction.startTime)).to.equal(true);
          expect(lastAuction.highestBidder.toLowerCase()).to.equal(
            user2.toLowerCase()
          );
        });
        it("returns correct auction when counterbid placed", async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address);
          await placeBid(user1, 20, zoneInstance.address);

          const lastAuction = auctionToObj(await zoneInstance.getLastAuction());
          expect(lastAuction.id.toNumber()).to.equal(1);
          expect(lastAuction.state.toString()).to.equal(
            ZONE_AUCTION_STATE_STARTED
          );
          expect(lastAuction.startTime.toNumber()).to.not.equal(0);
          expect(lastAuction.endTime.gt(lastAuction.startTime)).to.equal(true);
          expect(lastAuction.highestBidder.toLowerCase()).to.equal(
            user1.toLowerCase()
          );
        });
        it("returns correct auction when auction ended and processed", async () => {
          await timeTravel.inSecs(COOLDOWN_PERIOD + ONE_HOUR);
          await placeBid(user2, MIN_ZONE_DTH_STAKE + 10, zoneInstance.address);
          await placeBid(user1, 20, zoneInstance.address);
          await timeTravel.inSecs(BID_PERIOD + ONE_HOUR);
          await zoneInstance.processState();

          const lastAuction = auctionToObj(await zoneInstance.getLastAuction());
          expect(lastAuction.id.toNumber()).to.equal(1);
          expect(lastAuction.state.toString()).to.equal(
            ZONE_AUCTION_STATE_ENDED
          );
          expect(lastAuction.startTime.toNumber()).to.not.equal(0);
          expect(lastAuction.endTime.gt(lastAuction.startTime)).to.equal(true);
          expect(lastAuction.highestBidder.toLowerCase()).to.equal(
            user1.toLowerCase()
          );
        });
      });
    });
    // test certifierregistry contract
    describe("certifierRegistry.sol", () => {
      describe("certifierRegistry.sol", () => {
        it("should register a new certifier", async () => {
          const urlCert = "dether.io/certifier";
          const tsx = await certifierRegistryInstance.createCertifier(urlCert, {
            from: user1
          });
          const myCertifier = await certifierRegistryInstance.certifier(user1);
          assert.equal(
            myCertifier.owner,
            user1,
            "certifier was not well registered"
          );
        });
        it("should add url", async () => {
          const urlCert = "dether.io/certifier";
          let tsx = await certifierRegistryInstance.createCertifier(urlCert, {
            from: user1
          });
          const urlNew = "dether.io/newpage";
          tsx = await certifierRegistryInstance.modifyUrl(user1, urlNew, {
            from: user1
          });
          const myCertifier = await certifierRegistryInstance.certifier(user1);
          assert.equal(myCertifier.url, urlNew, "url was well modified");
        });
        it("should add delegate", async () => {
          const urlCert = "dether.io/certifier";
          let tsx = await certifierRegistryInstance.createCertifier(urlCert, {
            from: user1
          });
          cert = await certifierRegistryInstance.isDelegate(user1, user2);
          assert.equal(cert, false, "should not be delegate");
          tsx = await certifierRegistryInstance.addDelegate(user1, user2, {
            from: user1
          });
          cert = await certifierRegistryInstance.isDelegate(user1, user2);
          assert.equal(cert, true, "should be delegate");
        });
        it("should remove delegate", async () => {
          const urlCert = "dether.io/certifier";
          let tsx = await certifierRegistryInstance.createCertifier(urlCert, {
            from: user1
          });
          tsx = await certifierRegistryInstance.addDelegate(user1, user2, {
            from: user1
          });
          let cert = await certifierRegistryInstance.isDelegate(user1, user2);
          assert.equal(cert, true, "should be delegate");
          tsx = await certifierRegistryInstance.removeDelegate(user1, user2, {
            from: user1
          });
          cert = await certifierRegistryInstance.isDelegate(user1, user2);
          assert.equal(cert, false, "should not be delegate");
        });
        it("should add certification Type", async () => {
          const urlCert = "dether.io/certifier";
          let tsx = await certifierRegistryInstance.createCertifier(urlCert, {
            from: user1
          });
          const certType = "sms verification";
          tsx = await certifierRegistryInstance.addCertificationType(
            user1,
            1,
            "sms verification",
            { from: user1 }
          );
          cert = await certifierRegistryInstance.getCertificationType(user1, 1);
          assert.equal(certType, cert, "should not be delegate");
        });
        it("add certification to an address", async () => {
          const urlCert = "dether.io/certifier";
          let tsx = await certifierRegistryInstance.createCertifier(urlCert, {
            from: user1
          });
          tsx = await certifierRegistryInstance.addDelegate(user1, user2, {
            from: user1
          });
          tsx = await certifierRegistryInstance.addCertificationType(
            user1,
            1,
            "sms verification",
            { from: user1 }
          );
          tsx = await certifierRegistryInstance.addCertificationType(
            user1,
            2,
            "kyc verification",
            { from: user1 }
          );

          tsx = await certifierRegistryInstance.certify(user1, user3, 1, {
            from: user2
          });
          tsx = await certifierRegistryInstance.certify(user1, user3, 2, {
            from: user2
          });

          const certs = await certifierRegistryInstance.getCerts(user3);
          assert.equal(certs[0].ref, 1, "ref should be type 1");
          assert.equal(
            certs[0].certifier,
            user1,
            "certifier address should be the one who create it"
          );
          assert.equal(certs[1].ref, 2, "ref should be type 2");
          assert.equal(
            certs[1].certifier,
            user1,
            "certifier address should be the one who create it"
          );
        });
      });
      describe("certifierRegistry from Users.sol", () => {
        it("should get good result when calling throug Users instance", async () => {
          const urlCert = "dether.io/certifier";
          let tsx = await certifierRegistryInstance.createCertifier(urlCert, {
            from: user1
          });
          tsx = await certifierRegistryInstance.addDelegate(user1, user2, {
            from: user1
          });
          tsx = await certifierRegistryInstance.addCertificationType(
            user1,
            1,
            "sms verification",
            { from: user1 }
          );
          tsx = await certifierRegistryInstance.addCertificationType(
            user1,
            2,
            "kyc verification",
            { from: user1 }
          );

          tsx = await certifierRegistryInstance.certify(user1, user3, 1, {
            from: user2
          });
          tsx = await certifierRegistryInstance.certify(user1, user3, 2, {
            from: user2
          });

          const certs = await certifierRegistryInstance.getCerts(user3);

          const certsFromUsersInstance = await usersInstance.getCertifications(
            user3
          );
          expect(certs).to.eql(certsFromUsersInstance);
        });
      });
    });
  });
});
