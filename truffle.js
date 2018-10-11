require('dotenv').config({ path: '.env' });

const { MNEMONIC, MNEMONIC_MAIN, PRIVKEY_MAIN } = process.env;
const HDWalletProvider = require('truffle-hdwallet-provider');
const PKWalletProvider = require('truffle-privatekey-provider');

module.exports = {
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '*', // Match any network id
      gasPrice: 25000000000,
    },
    kovan: {
      provider: () => new HDWalletProvider(MNEMONIC, 'https://kovan.infura.io/'),
      // provider: () => new HDWalletProvider(MNEMONIC, 'http://localhost:8545'),
      network_id: 42,
      // gas: 4700000,
      gasPrice: 20000000000,
      // from: '0x6AAb2B0913B70270E840B14c2b23B716C0a43522',
    },
    rinkeby: {
      provider: () => new HDWalletProvider(MNEMONIC, 'https://rinkeby.infura.io/'),
      // provider: () => new HDWalletProvider(MNEMONIC, 'http://localhost:8545'),
      network_id: 4,
      // gas: 4700000,
      gasPrice: 20000000000,
      // from: '0x6AAb2B0913B70270E840B14c2b23B716C0a43522',
    },
    ropsten: {
      provider: () => new HDWalletProvider(MNEMONIC, 'https://ropsten.infura.io/'),
      network_id: 3,
      // gas: 4700000,
      gasPrice: 200000000000,
    },
    mainnet: {
      // provider: () => new HDWalletProvider(MNEMONIC_MAIN, 'http://localhost:8545'),
      provider: () => new HDWalletProvider(MNEMONIC_MAIN, 'https://mainnet.infura.io/'),
      // provider: () => new PKWalletProvider(PRIVKEY_MAIN, 'http://localhost:8545'),
      network_id: 1,
      gasPrice: 20000000000,
      gas: 6500000,
      // gasPrice: 25000000000,
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
