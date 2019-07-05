# Dether - Ethereum smart contracts

[![Join the chat at https://gitter.im/dethertech/detherContracts](https://badges.gitter.im/dethertech/detherContracts.svg)](https://gitter.im/dethertech/detherContracts?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

### Version 1.0   
This version introduce the zoning system.  
A zone is defined by a geohash of 6 character representing a square of approximately (1.22km×0.61km).  
Each could have only one owner.  
When you are the owner of the zone you can:  
-Add a Teller point of sale regarding an activity of cash-in cash-out.  
-Define the licence price for a shop to be added on his zone.
-Earn a fees on shop which will add a POI on your zone.  

Difference between SHOP and Teller:  
A teller is a point on the map where a user will be able to cash-in cash-out cryptocurrencies
Shop is a point where a user will be able to spend cryptocurrency in exchanges for goods.

Why limit 1 Point of sales per zone?  
TO DO
  
How to enforce rules for shop not to be allowed to propose cash-in cash-out:  
TO DO


## Table of Contents

* [Contract overview](#contract-overview)
* [Install](#install)
* [Test](#test)
* [Contributing](#dependencies)
* [Licence](#licence)
* [Donation](#donation)


## Contract-overview

ZoneFactory.sol is the entry door to other contract, its where we create zone.  
We interact with it by sending DTH trought the ERC223 `transfer(value, to, bytes)`, where bytes describe the action we want to do.  
Then a new zone `Zone.sol` is created thanks to `EIP1167CloneFactory.sol`.  
Each geohash6 will have its own contracts deployed once.  
Once its deployed any interaction regarding this zone (bidding, owner changing etc...) will happen on this zone contract.  
A new teller `Teller.sol` contract is deployed in the same time whit the same `EIP1167CloneFactory.sol` system.  
Each Zone will have its own Teller contract. This contract handle all the Teller management things.  

Shops `Shops.sol` will use another contract linked to the zoning system.  

Zoning system  
Each country are representing by a suite of geohash of 4 character in the `GeoRegistry.sol` contract.  
Thanks to the geohash system we can check that a geohash6 (the zone) is included in a geohash4 ( the country).  
Thanks to the same system when a shop representing by a geohash of 12 character want to register on a zone, we can check if there is an owner on this zone, and get the licence price to be registered


## Test  
Run ganache-cli in another terminal with enough ETH:
```
ganache-cli -e 1000
```

Launch test:   

```
truffle test test/ZoneFactory-Zone.spec.js
```




## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.


## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details

## Donation
* [Ethereum Foundation](https://ethereum.org/donate)
* [Etherscan](https://etherscan.io/address/0x71c7656ec7ab88b098defb751b7401b5f6d8976f)
* [MyEtherWallet](https://etherscan.io/address/0x7cB57B5A97eAbe94205C07890BE4c1aD31E486A8)
