/* global contract it artifacts web3 assert*/
const DetherAbs = artifacts.require('./Dether.sol');

// --> TEST TO ADD:
// ADD TELLER, AND DELETE FROM ZONE
// REPUTATION


contract('Dether', () => {
  /*
   * init
   */
  const teller1 = {} , teller2 = {} , teller3 = {} , buyer1 = {} , buyer2 = {} , buyer3 = {};
  teller1.rate = 300;
  teller1.lat = 123456;
  teller1.lng = 987654;
  teller1.zoneId = 42;
  teller1.name = 'teller1';
  teller1.currencyId = 1;
  teller1.avatarId = 1;
  teller1.messengerAddr = 'http://t.me/teller1';
  teller1.address = '';
  teller1.balance = 0;
  teller1.escrowBalance = 0;
  let payment1 = 1;

  teller2.rate = 123;
  teller2.lat = 444444;
  teller2.lng = 5555555;
  teller2.zoneId = 42;
  teller2.name = 'teller2';
  teller2.currencyId = 2;
  teller2.avatarId = 2;
  teller2.messengerAddr = 'http://t.me/teller2';
  teller2.balance = 0;
  teller2.escrowBalance = 0;
  let payment2 = 1;

  teller3.rate = 222;
  teller3.lat = 1234333;
  teller3.lng = 234535;
  teller3.zoneId = 42;
  teller3.name = 'teller3';
  teller3.currencyId = 2;
  teller3.avatarId = 3;
  teller3.messengerAddr = 'http://t.me/teller3';
  teller3.balance = 0;
  teller3.escrowBalance = 0;
  let payment3 = 1;

  const
    [creator
    , teller1address
    , teller2address
    , teller3address
    , buyer1address
    , buyer2address
    , buyer3address
    ] = web3.eth.accounts;

  let dether = null;

    before(async () => {
      dether = await DetherAbs.deployed();
    })

  it('can register a Teller and be on the map', async() => {
    let escrowBalance = 0;
    let regularBalance = 0;
    await dether.registerPoint(teller1.lat, teller1.lng, teller1.zoneId, teller1.rate, teller1.avatarId, teller1.currencyId, teller1.messengerAddr, teller1.name, { from: teller1address, value: web3.toWei(payment1, 'ether'), gas: 1000000 });
    await dether.registerPoint(teller2.lat, teller2.lng, teller2.zoneId, teller2.rate, teller2.avatarId, teller2.currencyId, teller2.messengerAddr, teller2.name, { from: teller2address, value: web3.toWei(payment2, 'ether'), gas: 1000000 });
    await dether.registerPoint(teller3.lat, teller3.lng, teller3.zoneId, teller3.rate, teller3.avatarId, teller3.currencyId, teller3.messengerAddr, teller3.name, { from: teller3address, value: web3.toWei(payment3, 'ether'), gas: 1000000 });

    const pos2 = await dether.getTellerPos(teller2address);
    assert.equal(pos2[0].toNumber(), teller2.lat, 'verif lat');
    assert.equal(pos2[1].toNumber(), teller2.lng, 'verif lng');
    assert.equal(pos2[2].toNumber(), teller2.zoneId, 'verif zone');
    assert.equal(pos2[3].toNumber(), web3.toWei(teller2.balance + payment2, 'ether'), 'verif balance');

    const profile3 = await dether.getTellerProfile(teller3address);
    assert.equal(profile3[0].toNumber(), teller3.rate, 'verif rates');
    assert.equal(profile3[3], teller3.name, 'verif name');
    assert.equal(profile3[4].toNumber(), teller3.currencyId, 'verif currency');
    assert.equal(profile3[5].toNumber(), teller3.avatarId, 'verif avatar');
    assert.equal(profile3[6], teller3.messengerAddr, 'verif telegram');

  });

  it('can send fund a win reputation', async() => {

  });

  it('can register and unregister and be only on the new zone', async() => {

  });

  it('cannot send to mysefl and win reputation', async() => {

  });

  it('register a new sell point delete old one', async() => {

  });

});
