var Dether = artifacts.require("./Dether.sol");

module.exports = function(deployer) {
  deployer.deploy(Dether, {gas: 1000000});
};
