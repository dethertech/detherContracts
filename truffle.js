const LightWalletProvider = require('@digix/truffle-lightwallet-provider');
const pass = 'Dether76';
// kovan 0xD2805712d2fF5EFF50F8E28506F8e5A2acdD80a8

module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*" // Match any network id
    },
    kovan: {
      provider: new LightWalletProvider({
        keystore: './sigmate-v3-ropstenDeploy.json',
        password: pass,
        rpcUrl: 'https://kovan.infura.io/v604Wu8pXGoPC41ARh0B',
        // debug: true, // optional, show JSON-RPC logs
      }),
      network_id: 42,
    },
    // ropsten: {
    //   host: "localhost",
    //   port: 8545,
    //   network_id: 3,
    //   from: "0xe070b23860FA281252aC4ABB8d3E120f088d1Fb1",
    // },
    // kovan: {
    //   host: "localhost",
    //   port: 8545,
    //   network_id: 42,
    //   from: "0xbb5a8A90F2404f7F2DBd9777168F90A746386dBa",
    // },
    mainnet: {
      host: 'localhost',
      port: 8545,
      network_id: 1,
    },
  }
};
