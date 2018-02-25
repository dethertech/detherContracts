require('dotenv').config({path: '.env'})
const {ADDRESS, KEYSTORE, PASSWORD, MNEMONIC} = process.env
const LightWalletProvider = require('@digix/truffle-lightwallet-provider')
const HDWalletProvider = require("truffle-hdwallet-provider");

module.exports = {
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '*' // Match any network id
    },
    // kovanInfura: {
    //   provider: new LightWalletProvider({
    //     keystore: KEYSTORE,
    //     password: PASSWORD,
    //     rpcUrl: 'https://kovan.infura.io/v604Wu8pXGoPC41ARh0B'
    //     //rpcUrl: 'https://kovan.infura.io/',
    //     //debug: true, // optional, show JSON-RPC logs
    //   }),
    //   network_id: 42,
    // },
    kovanInfura: {
      provider: function() {
        return new HDWalletProvider(MNEMONIC, "https://kovan.infura.io/v604Wu8pXGoPC41ARh0B")
      },
      network_id: 42,
    },
    kovan: {
      host: 'localhost',
      port: 8545,
      network_id: 42,
      from: ADDRESS,
    },
    ropsten: {
      host: "localhost",
      port: 8545,
      network_id: 3,
      from: ADDRESS,
    },
    mainnet: {
      host: 'localhost',
      port: 8545,
      network_id: 1,
    },
  },
  mocha: {
    useColors: true
  },
}
