require('dotenv').config({path: '.env'})
const {MNEMONIC} = process.env
const HDWalletProvider = require("truffle-hdwallet-provider");

module.exports = {
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '*' // Match any network id
    },
    kovan: {
      provider: function() {
        return new HDWalletProvider(MNEMONIC, "https://kovan.infura.io/v604Wu8pXGoPC41ARh0B")
      },
      network_id: 42,
      gas: 4700000,
      gasPrice: 50000000000,
    },
    mainnet: {
      host: 'localhost',
      port: 8545,
      network_id: 1,
    },
  },
  solc: {
  optimizer: {
    enabled: true,
    runs: 200
  }
},
  mocha: {
    useColors: true
  },
}
