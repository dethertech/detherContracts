module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*" // Match any network id
    },
    // ropsten: {
    //   provider: new LightWalletProvider({
    //     keystore: '/Users/ljn/.sigmate/sigmate-v3-ropstenDeploy.json',
    //     password: 'Dether76',
    //     rpcUrl: 'https://ropsten.infura.io/v604Wu8pXGoPC41ARh0B',
    //     debug: true, // optional, show JSON-RPC logs
    //     prefund: 1e18, // optional, fund all lightwallet addresses (via coinbase) with this  of wei
    //     pollingInterval: 4000 // optional, polling interval for the provider (reduce for faster deploy with testRPC or kovan)
    //   }),
    //   network_id: '3',
    // },
    ropsten: {
      host: "localhost",
      port: 8545,
      network_id: 3,
      from: "0xe070b23860FA281252aC4ABB8d3E120f088d1Fb1",
    },
    kovan: {
      host: "localhost",
      port: 8545,
      network_id: 42,
      from: "0xbb5a8A90F2404f7F2DBd9777168F90A746386dBa",
    },
    mainnet: {
      host: 'localhost',
      port: 8545,
      network_id: 1,
    },
  }
};
