require('dotenv').config({path: '.env'})
const {PASSWORD, KEYSTORE} = process.env
const LightWalletProvider = require('@digix/truffle-lightwallet-provider')
// kovan 0xe2e8d89c9435a92eedfade8c94e14118a3156f09

module.exports = {
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '*' // Match any network id
    },
    kovanInfura: {
      provider: new LightWalletProvider({
        keystore: KEYSTORE,
        password: PASSWORD,
        rpcUrl: 'https://kovan.infura.io/v604Wu8pXGoPC41ARh0B',
        // debug: true, // optional, show JSON-RPC logs
      }),
      network_id: 42,
    },
    kovan: {
      host: 'localhost',
      port: 8545,
      network_id: 42,
      from: '0x13DD7902e989e7eA28874F6D8C28681b1105Fe84',
    },
    // ropsten: {
    //   host: "localhost",
    //   port: 8545,
    //   network_id: 3,
    //   from: "0xe070b23860FA281252aC4ABB8d3E120f088d1Fb1",
    // },
    mainnet: {
      host: 'localhost',
      port: 8545,
      network_id: 1,
    },
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
  mocha: {
    useColors: true
  },
}