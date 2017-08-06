/* global contract it artifacts web3 assert*/
const Dether = artifacts.require('./Dether.sol');

// const Phase = {
//   Created:   0,
//   Running:   1,
//   Paused:    2,
//   Migrating: 3,
//   Migrated:  4
// };

// const PhaseStr = {};
// Object.keys(Phase).forEach(k => PhaseStr[Phase[k]] = k);

contract('Dether', () => {
  const
    [creator
    , teller1
    , teller2
    , teller3
    , teller4
    , teller5
    ] = web3.eth.accounts;
  // const escrow = "0x0303030303030303030303030303030303030303";
  let dether = null;
  // const evmThrow = err =>
  //   assert.isOk(err.message.match(/invalid JUMP/), err.message, 'should throw');
  //
  // const ok = (from, to) =>
  //   it(`can move from ${PhaseStr[from]} to ${PhaseStr[to]}`, () =>
  //     token.setPresalePhase(to, {from: tokenManager}).then(() =>
  //       token.currentPhase.call().then(res =>
  //         assert.equal(to, res.toFixed(), `not Phase.${PhaseStr[to]}`))));

  // const no = (from, to) =>
  //   it(`can't move from ${PhaseStr[from]} to ${PhaseStr[to]}`, () =>
  //     token.setPresalePhase(to, {from: tokenManager})
  //       .then(assert.fail)
  //       .catch(() =>
  //         token.currentPhase.call().then(res =>
  //           assert.equal(from, res.toFixed(), `not Phase.${PhaseStr[from]}`))));


  it('can register a Teller and send coin', () => {
    let escrowBalance = 0;
    let regularBalance = 0;
    Dether.new({ from: creator })
      .then((res) => {
        dether = res;
        // return dether.getZone(42);
        return dether.registerPoint(123456, 987654, 42, 300, 1, 1, "http://t.me/teller1", "teller1", { from: teller1, value: web3.toWei(1, 'ether'), gas: 1000000 });
      }).then(() => dether.registerPoint(444444, 5555555, 42, 250, 2, 2, 'http://t.me/teller2', 'teller2', { from: teller2, value: web3.toWei(1, 'ether') }))
      .then(() => dether.registerPoint(1234333, 234535, 42, 250, 2, 2, 'http://t.me/teller3', 'teller3', { from: teller3, value: web3.toWei(1, 'ether') }))
      .then(() => dether.registerPoint(1234333, 234535, 41, 250, 2, 2, 'http://t.me/teller4', 'teller3', { from: teller4, value: web3.toWei(1, 'ether') }))
      .then(() => dether.getTellerProfile(teller1))
      .then((res) => {
        return assert.equal(res[0].toNumber(), 300, 'verif rates');
      }).then(() => dether.getTellerBalances(teller1))
      .then((res) => {
        escrowBalance = web3.fromWei(res.toNumber(), 'ether');
        return web3.eth.getBalance(teller2);
      }).then((res) => {
        regularBalance = web3.fromWei(res.toNumber(), 'ether');
        return dether.sendCoin(teller2, web3.toWei(0.01, 'ether') , { from: teller1, gas: 1000000});
      }).then(() => dether.getTellerProfile(teller1))
      .then((res) => {
        assert.equal(res[1], web3.toWei(0.01, 'ether'), 'volume');
        assert.equal(res[2], 1, 'volume');
        return web3.eth.getBalance(teller2);
      }).then((res) => {
        assert.isAbove(web3.fromWei(res.toNumber(), 'ether'), regularBalance, 'receive eth');

        // test number of point et delete point
        return dether.getZone(42);
      }).then((res) => {
        console.log('zone 42 ', res);
      //   return dether.registerPoint(1234333, 234535, 42, 250, 2, 2, 'http://t.me/teller4', 'teller3', { from: teller4, value: web3.toWei(1, 'ether') });
      // }).then(() => {
        return dether.withdrawAll({from: teller2});
      }).then(() => dether.getZone(42))
      .then((res) => {
        console.log('res ', res);
      }).catch((err) => {
        console.log('err = ', err);
      });

  });


/*
  it("can register a Teller", () =>
    Dether.new({from: creator})
      .then(res => {
        dether = res;
        dether.registerPoint(123456789, 987654321, 42, 30, 1, 1, "telegram", {from: teller1, amount: web3.toWei(10, "ether")});
      }).then( => {
        dether.tellers.call(teller1)
        assert.equal()
      }).then());

      it("can call buyTokens in Phase.Running", () =>
        Dether.new({from: creator})
          .then(() => {
            dether = res;
            dether.registerPoint(123456789, 987654321, 42, 30, 1, 1, "telegram", {from: teller1, amount: web3.toWei(10, "ether")}).then(() => {

            });


            token.balanceOf.call(investor1).then(res =>
              assert.equal(606, web3.fromWei(res.toFixed(), 'ether'),
                "1 Ether should buy 606 SPT"))
            const balance = web3.eth.getBalance(token.address)
            return assert.equal(1, web3.fromWei(balance.toFixed(), 'ether'), "contract balance is 1 ether")
          }))





  it("should start in phase Created", () =>
    token.currentPhase.call().then(res =>
      assert.equal(0, res.toFixed(), "not Phase.Created")));

  // At phase Created
  // - buy
  // - burn
  // + withdraw
  // + set crowdsale manager
  it("should fail to buyTokens in Phase.Created", () =>
    token.buyTokens(investor1, {value: web3.toWei(1, 'ether'), from: investor1})
      .then(assert.fail).catch(evmThrow))

  it("should fail to call burnTokens in Phase.Created", () =>
    token.burnTokens(investor1, {from: crowdsaleManager})
      .then(assert.fail).catch(evmThrow))

  it("tokenManager can call withdrawEther in Phase.Created", () =>
    token.withdrawEther({from: tokenManager})
      .then(() => {}))

  it("tokenManager can call setCrowdsaleManager in Phase.Created", () =>
    token.setCrowdsaleManager(crowdsaleManager, {from: tokenManager})
      .then(() => token.crowdsaleManager.call().then(res =>
        assert.equal(crowdsaleManager, res, "Invalid crowdsaleManager"))))

  it("random guy should fail to call setCrowdsaleManager in Phase.Created", () =>
    token.setCrowdsaleManager(crowdsaleManager, {from: investor1})
      .then(assert.fail).catch(evmThrow))

  it("can succesfully create another PresaleToken", () =>
    PresaleToken.new(tokenManager, escrow, {from: creator})
      .then(res => {token = res}));

  no(Phase.Created, Phase.Created);
  no(Phase.Created, Phase.Paused);
  no(Phase.Created, Phase.Migrating);
  no(Phase.Created, Phase.Migrated);
  ok(Phase.Created, Phase.Running);

  // At phase Running
  // + buy
  // - burn
  // + withdraw
  // + set crowdsale manager
  it("can call buyTokens in Phase.Running", () =>
    token.buyTokens(investor1, {value: web3.toWei(1, 'ether'), from: investor1})
      .then(() => {
        token.balanceOf.call(investor1).then(res =>
          assert.equal(606, web3.fromWei(res.toFixed(), 'ether'),
            "1 Ether should buy 606 SPT"))
        const balance = web3.eth.getBalance(token.address)
        return assert.equal(1, web3.fromWei(balance.toFixed(), 'ether'), "contract balance is 1 ether")
      }))

  it("should fail to call burnTokens in Phase.Running", () =>
    token.burnTokens(investor1, {from: crowdsaleManager})
      .then(assert.fail).catch(evmThrow))

  it("tokenManager can call withdrawEther in Phase.Running", () => {
    const mgrBalance1 = web3.eth.getBalance(escrow).toFixed();
    token.withdrawEther({from: tokenManager})
      .then(() => {
        const tokBalance = web3.fromWei(web3.eth.getBalance(token.address).toFixed(), 'ether');
        assert.equal(0, tokBalance, "contract balance is 0 ether");
        const mgrBalance2 = web3.eth.getBalance(escrow).toFixed();
        return assert.isAbove(mgrBalance2, mgrBalance1, "escrow got some ether");
      })
  });

  it("tokenManager can call setCrowdsaleManager in Phase.Running", () =>
    token.setCrowdsaleManager(crowdsaleManager, {from: tokenManager})
      .then(() => token.crowdsaleManager.call().then(res =>
          assert.equal(crowdsaleManager, res, "Invalid crowdsaleManager"))))

  it("random guy should fail to call setCrowdsaleManager in Phase.Running", () =>
    token.setCrowdsaleManager(crowdsaleManager, {from: investor1})
      .then(assert.fail).catch(evmThrow))

  it("can call buyTokens in Phase.Running again", () =>
    token.buyTokens(investor2, {value: web3.toWei(1, 'ether'), from: investor2})
      .then(() => {
        token.balanceOf.call(investor2).then(res =>
          assert.equal(606, web3.fromWei(res.toFixed(), 'ether'),
            "1 Ether should buy 606 SPT"))
        const balance = web3.eth.getBalance(token.address)
        return assert.equal(1, web3.fromWei(balance.toFixed(), 'ether'), "contract balance is 1 ether")
      }))


  no(Phase.Running, Phase.Created);
  no(Phase.Running, Phase.Running);
  no(Phase.Running, Phase.Migrated);
  ok(Phase.Running, Phase.Paused);

  // At phase Paused
  // - buy
  // - burn
  // + withdraw
  // + set crowdsale manager
  it("should fail to call buyTokens in Phase.Paused", () =>
    token.buyTokens(investor1, {value: web3.toWei(1, 'ether'), from: investor1})
      .then(assert.fail).catch(evmThrow))

  it("should fail to call burnTokens in Phase.Paused", () =>
    token.burnTokens(investor1, {from: crowdsaleManager})
      .then(assert.fail).catch(evmThrow))

  it("tokenManager can call withdrawEther in Phase.Paused", () => {
    const mgrBalance1 = web3.eth.getBalance(escrow).toFixed();
    token.withdrawEther({from: tokenManager})
      .then(() => {
        const tokBalance = web3.fromWei(web3.eth.getBalance(token.address).toFixed(), 'ether');
        assert.equal(0, tokBalance, "contract balance is 0 ether");
        const mgrBalance2 = web3.eth.getBalance(escrow).toFixed();
        return assert.isAbove(mgrBalance2, mgrBalance1, "escrow got some ether");
      })
  });

  it("random guy should fail to call setCrowdsaleManager in Phase.Paused", () =>
    token.setCrowdsaleManager(crowdsaleManager, {from: investor1})
      .then(assert.fail).catch(evmThrow))

  no(Phase.Paused, Phase.Created);
  no(Phase.Paused, Phase.Paused);
  no(Phase.Paused, Phase.Migrated);
  ok(Phase.Paused, Phase.Running);

  it("can call buyTokens in Phase.Running again", () =>
    token.buyTokens(investor2, {value: web3.toWei(1, 'ether'), from: investor2})
      .then(() => {
        token.balanceOf.call(investor2).then(res =>
          assert.equal(2*606, web3.fromWei(res.toFixed(), 'ether'),
            "1 Ether should buy 606 DPT"))
        const balance = web3.eth.getBalance(token.address)
        return assert.equal(1, web3.fromWei(balance.toFixed(), 'ether'), "contract balance is 1 ether")
      }))


  // check if crowdsale manager is set
  it("tokenManager can call setCrowdsaleManager in Phase.Running", () =>
    token.setCrowdsaleManager('0x0', {from: tokenManager})
      .then(() => token.crowdsaleManager.call().then(res =>
          assert.equal('0x0000000000000000000000000000000000000000', res, "Invalid crowdsaleManager"))))

  no(Phase.Running, Phase.Migrating);

  it("tokenManager can call setCrowdsaleManager in Phase.Running", () =>
    token.setCrowdsaleManager(crowdsaleManager, {from: tokenManager})
      .then(() => token.crowdsaleManager.call().then(res =>
          assert.equal(crowdsaleManager, res, "Invalid crowdsaleManager"))))

  ok(Phase.Running, Phase.Migrating);

  // At phase Migrating
  // - buy
  // + burn
  // + withdraw
  // - set crowdsale manager
  it("should fail to call buyTokens in Phase.Migrating", () =>
    token.buyTokens(investor1, {value: web3.toWei(1, 'ether'), from: investor1})
      .then(assert.fail).catch(evmThrow))

  it("random guy should fail to call burnTokens in Phase.Migrating", () =>
    token.burnTokens(investor1, {from: investor1})
      .then(assert.fail).catch(evmThrow))

  it("crowdsaleManager can call burnTokens in Phase.Migrating", () =>
    token.burnTokens(investor1, {from: crowdsaleManager}).then(() =>
        token.balanceOf.call(investor1).then(res =>
          assert.equal(0, web3.fromWei(res.toFixed(), 'ether'),
            "tokens burned, balance is zero"))))

  it("tokenManager can call withdrawEther in Phase.Migrating", () =>
    token.withdrawEther({from: tokenManager})
      .then(() => {}))

  it("should fail to call setCrowdsaleManager in Phase.Migrating", () =>
    token.setCrowdsaleManager(crowdsaleManager, {from: tokenManager})
      .then(assert.fail).catch(evmThrow))

  no(Phase.Migrating, Phase.Created);
  no(Phase.Migrating, Phase.Running);
  no(Phase.Migrating, Phase.Paused);
  no(Phase.Migrating, Phase.Migrating);

  // check if everyting is migrated
  no(Phase.Migrating, Phase.Migrated);
  // burn all
  it("crowdsaleManager can call burnTokens in Phase.Migrating", () =>
    token.burnTokens(investor2, {from: crowdsaleManager})
      .then(() => {
        token.balanceOf.call(investor2).then(res =>
          assert.equal(0, web3.fromWei(res.toFixed(), 'ether'),
            "tokens burned, balance is zero"))
      }))
  it("should automatically switch to Phase.Migrated when all tokens burned", () =>
    token.currentPhase.call().then(res =>
      assert.equal(Phase.Migrated, res.toFixed(), "not Phase.Migrated")));

  no(Phase.Migrated, Phase.Created);
  no(Phase.Migrated, Phase.Running);
  no(Phase.Migrated, Phase.Paused);
  no(Phase.Migrated, Phase.Migrating);
  no(Phase.Migrated, Phase.Migrated);


  // At phase Migrated
  // - buy
  // + withdraw
  it("should fail to call buyTokens in Phase.Migrated", () =>
    token.buyTokens(investor1, {value: web3.toWei(1, 'ether'), from: investor1})
      .then(assert.fail).catch(evmThrow))

  it("tokenManager can call withdrawEther in Phase.Migrated", () =>
    token.withdrawEther({from: tokenManager})
      .then(() => {}))
*/
});
