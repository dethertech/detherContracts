# Dether - Ethereum smart contracts - V.2

[![Join the chat at https://gitter.im/dethertech/detherContracts](https://badges.gitter.im/dethertech/detherContracts.svg)](https://gitter.im/dethertech/detherContracts?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

### Version 2.0   
Dethercontract is a protocol willing to facilitate crypto cash-in cash-out.
The protocol is a combination of 2 main parts, the zoning system and the dether tax system.

The zoning system purpose is to give an exclusivity to a user to be the only seller available on a zone (1.22km×0.61km). Like a taxi medaillon system we think that to satisfy the demand, we need only a limited good quality and well incentivise seller.
A zone is defined by a geohash of 6 character representing a square of approximately (1.22km×0.61km).  
Each zone could have only one owner.  
When you are the owner of the zone you can:  
-Add a Teller point (a description of crypto cash-in cash-out point).  
-Define the licence price for a shop willing to advertise on your zone.
-Earn a fees on shop which will advertise on your zone.  

The dether tax system is inspired by the harberger tax system.
To be the owner of the zone you must be the highest staker of DTH on this zone.
And once owner, every 24h 0.04% (around 15% annualy) of what you staked will be sendable to the TaxCollector.sol contract, and be either burnt or either send to a develloper funds.
At any time anyone can open a bid by staking more DTH that you, you will have 24h to add more DTH that his bid to stay the owner.
When opening a bid, a bidder need to pay an entry fees of 1% of his stake, this entry fees is sent to the TaxCollector contract.
The entry fees is here to avoid spamming the network with unmotivated auction.

Its important to keep in mind that we dont handle the crypto which are buy and sell.
The dether protocol manage only the zone. The trade itself dont need to be in-protocol, and keeping it outside the protocol allow to add more privacy, by enabling the possibilities to manage a zone with one wallet and do the trade with another wallet.

On top of this system, any shops accepting cryptocurrencies will have the possibilities to advertise its shop on the map.   
-> 2 possibilities here:   
The shop is on an owned zone: the shop will need to pay a taxes (in DTH) to the zone owner (the zone owner will determine the amount)
The shop is on a non-owned zone: the shop will only need to stake DTH to have his point appear on the map.

Difference between SHOP and Teller:  
A Teller is a point on the map where a user will be able to cash-in cash-out cryptocurrencies.
A Shop is a point where a user will be able to spend cryptocurrency in exchanges for goods.


## Table of Contents

* [Contract overview](#contract-overview)
* [Test](#test)
* [Contributing](#dependencies)
* [Licence](#licence)
* [Donation](#donation)


## Contract-overview

[ZoneFactory.sol](contracts/core/ZoneFactory.sol) is the entry door to other contract, its where we create zone.  
We interact with it by sending DTH trought the ERC223 `transfer(value, to, bytes)`, where bytes describe the action we want to do.  
Then a new zone [Zone.sol](contracts/core/Zone.sol) is created thanks to [EIP1167CloneFactory.sol](contracts/eip1167/EIP1167CloneFactory.sol).  
Each geohash6 will have its own contracts deployed once.
Once its deployed any interaction regarding this zone (bidding, tax system, owner changing etc...) will happen on this zone contract.
A new teller [Teller.sol](contracts/core/Teller.sol) contract is deployed in the same time with the same [EIP1167CloneFactory.sol](contracts/eip1167/EIP1167CloneFactory.sol) system.  
Each Zone will have its own Teller contract. This contract handle all the Teller management things.  

Shops [Shops.sol](contracts/core/Shops.sol) will use another contract linked to the zoning system.  

The [GeoRegistry.sol](contracts/core/GeoRegistry.sol) contract is the reference to enable the possibilitie to add point on some countries.
Each country are representing by a suite of geohash of 4 character in the [GeoRegistry.sol](contracts/core/GeoRegistry.sol) contract.
Its an open and unpermissioned contract. We at Dether will deploy it and open only the country we will allow user through our front-end app to add point on. To register a country you need to associate a 2 letter ISO CODE with a suite a geohash of 4 character each one representing a part of the country. (see [test/GeoRegistry.spec.js](test/GeoRegistry.spec.js))
For that we only have to compare their first 4 character, if they match it means that the geohash of 6 character is included in the geohash of 4 characters.

Thanks to the same system when a shop representing by a geohash of 12 character want to register on a zone, we can check if there is an owner on this zone, and get the licence price to be registered.

## Test  
Run ganache-cli in another terminal with enough ETH:
```
ganache-cli -e 1000
```

Launch test:   

```
truffle test
```


## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details

## Donation
* [Ethereum Foundation](https://ethereum.org/donate)
* [Etherscan](https://etherscan.io/address/0x71c7656ec7ab88b098defb751b7401b5f6d8976f)
* [MyEtherWallet](https://etherscan.io/address/0x7cB57B5A97eAbe94205C07890BE4c1aD31E486A8)
