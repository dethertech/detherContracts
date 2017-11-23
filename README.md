# Dether - Ethereum smart contracts

[![Join the chat at https://gitter.im/dethertech/detherContracts](https://badges.gitter.im/dethertech/detherContracts.svg)](https://gitter.im/dethertech/detherContracts?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

### Warning: Don't use on mainnet! This contracts has not been thoroughly audited, it will evolve and improve before launching on mainnet.

Dether provides a decentralized peer-to-peer ether network that enables anyone on Earth to buy ether
with cash and spend it at physical stores nearby. No bank account is needed, just a mobile phone with
internet access. Our belief is that the beauty and power of the Ethereum technology should be easily
accessible to all.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See deployment for notes on how to deploy the project on a live system.

### Prerequisites

* Node.js 8

* Solc ^0.4.16 

If Truffle is shipped with an older version, then update it manually
```
cd node_modules/truffle
// update solc version in package.json
npm upgrade
// side note: `truffle version` will not give you the right version, but it's ok
```

### Installing

Install all the dependencies
```
npm install
```

## Running the tests

Tests on local machine
```
npm run test
```

Tests on Kovan Infura
```
npm run testKovanInfura
``` 

## Deployment

Migrate on local machine
```
npm run migrate
```

Migrate on Kovan Infura
```
npm run migrateKovanInfura
``` 

## Built With

* [Truffle](http://truffleframework.com) - Development framework for Ethereum
* [Truffle-lightwallet-provider](https://github.com/DigixGlobal/truffle-lightwallet-provider) - RPC Provider using Eth-Lightwallet & Web3-Provider-Engine
* [Sigmate](https://github.com/DigixGlobal/sigmate) - An Ethereum keystore creation tool 
* [Web3](https://github.com/ethereum/web3.js/) - Ethereum JavaScript API
* [Open Zeppelin](https://openzeppelin.org/) - Framework to build secure smart contracts on Ethereum

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/dethertech/dethercontracts/tags). 

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details

## Acknowledgments

We took our inspiration from many Ethereum projects, especially the work done by Digix (Sigmate, Truffle-light-wallet, the ICS pattern) and Open Zeppelin.
Big thanks to all of you contributing to the ecosystem.

## Donation
* [Ethereum Foundation](https://ethereum.org/donate)
* [Etherscan](https://etherscan.io/address/0x71c7656ec7ab88b098defb751b7401b5f6d8976f)
* [MyEtherWallet](https://etherscan.io/address/0x7cB57B5A97eAbe94205C07890BE4c1aD31E486A8)
* [CoinMarketCap](https://etherscan.io/address/0x0074709077B8AE5a245E4ED161C971Dc4c3C8E2B)
