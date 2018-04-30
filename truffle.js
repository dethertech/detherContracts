require('dotenv').config({ path: '.env' });

const { MNEMONIC, MNEMONIC_MAIN } = process.env;
const HDWalletProvider = require('truffle-hdwallet-provider');

module.exports = {
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '*', // Match any network id
      gasPrice: 25000000000,
    },
    kovan: {
      provider: () => new HDWalletProvider(MNEMONIC, 'https://kovan.infura.io/v604Wu8pXGoPC41ARh0B'),
      network_id: 42,
      gas: 4700000,
      gasPrice: 50000000000,
    },
    ropsten: {
      provider: () => new HDWalletProvider(MNEMONIC, 'https://ropsten.infura.io/v604Wu8pXGoPC41ARh0B'),
      network_id: 3,
      gas: 4700000,
      gasPrice: 50000000000,
    },
    mainnet: {
      provider: () => new HDWalletProvider(MNEMONIC_MAIN, 'http://localhost:8545'),
      // new HDWalletProvider(MNEMONIC_MAIN, 'https://mainnet.infura.io/wZNlMdy6TYSQ7A6krG7y')
      network_id: 1,
      gas: 1000000,
      gasPrice: 25000000000,
    },
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
  mocha: {
    useColors: true,
    // reporter: 'eth-gas-reporter', uncomment this line to get gas report!
  },
};
