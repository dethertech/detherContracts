require('dotenv').config({path: '.env'})
const {MNEMONIC, MNEMONIC_MAIN} = process.env
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
      from: '0x6AAb2B0913B70270E840B14c2b23B716C0a43522',
    },
    ropsten: {
      provider: function() {
        return new HDWalletProvider(MNEMONIC, "https://ropsten.infura.io/v604Wu8pXGoPC41ARh0B")
      },
      network_id: 3,
      gas: 4698712,
    },
    mainnet: {
      provider: function() {
        // return new HDWalletProvider(MNEMONIC_MAIN, "https://mainnet.infura.io/wZNlMdy6TYSQ7A6krG7y")
        return new HDWalletProvider(MNEMONIC_MAIN, "http://localhost:8545")
      },
      network_id: 1,
      gas: 1000000,
      gasPrice: 25000000000,
      from: '0x1ecb59E6EAb86eCdE351229e64E47dD6B65b9329',
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
