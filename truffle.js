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
      to: '0x9027e9fc4641e2991a36eaeb0347bc5b35322741',
    },
    mainnet: {
      provider: function() {
        return new HDWalletProvider(MNEMONIC_MAIN, "https://mainnet.infura.io/v604Wu8pXGoPC41ARh0B")
      },
      network_id: 1,
      gas: 4700000,
      gasPrice: 25000000000,
      to: '0x1ecb59E6EAb86eCdE351229e64E47dD6B65b9329',
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
