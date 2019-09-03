require("dotenv").config({ path: ".env" });

const { MNEMONIC, MNEMONIC_MAIN, PRIVKEY_MAIN } = process.env;
const HDWalletProvider = require("truffle-hdwallet-provider");
const PKWalletProvider = require("truffle-privatekey-provider");

module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*", // Match any network id
      gas: 6700000
    },
    kovan: {
      provider: () =>
        new HDWalletProvider(
          MNEMONIC,
          "https://kovan.infura.io/v3/f19f6c9d405a460f91964949efe0e78e"
        ),

      // provider: () => new HDWalletProvider(MNEMONIC, 'http://localhost:8545'),
      network_id: 42,
      gas: 6700000,
      gasPrice: 20000000000,
      skipDryRun: true
      // from: '0x6AAb2B0913B70270E840B14c2b23B716C0a43522',
    },
    rinkeby: {
      provider: () =>
        new HDWalletProvider(MNEMONIC, "https://rinkeby.infura.io/"),
      // provider: () => new HDWalletProvider(MNEMONIC, 'http://localhost:8545'),
      network_id: 4,
      // gas: 4700000,
      gasPrice: 20000000000
      // from: '0x6AAb2B0913B70270E840B14c2b23B716C0a43522',
    },
    ropsten: {
      provider: () =>
        new HDWalletProvider(MNEMONIC, "https://ropsten.infura.io/"),
      network_id: 3,
      // gas: 4700000,
      gasPrice: 200000000000
    },
    mainnet: {
      // provider: () => new HDWalletProvider(MNEMONIC_MAIN, 'http://localhost:8545'),
      provider: () =>
        new HDWalletProvider(
          MNEMONIC,
          "https://mainnet.infura.io/v3/f19f6c9d405a460f91964949efe0e78e"
        ),
      // provider: () => new PKWalletProvider(PRIVKEY_MAIN, 'http://localhost:8545'),
      network_id: 1,
      gasPrice: 5100000000,
      gas: 6700000,
      skipDryRun: true
      // gasPrice: 25000000000,
    }
  },
  plugins: ["truffle-security"],
  compilers: {
    solc: {
      version: "0.5.10",
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  }
};
