# DetherContracts

[API documentation](https://dethertech.github.io/dethercontracts)


## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Create zone](#Create_zone)
- [Add teller](#Add_Teller)
- [Bid on a zone](#Bid_on_a_zone)


## Function call

### Create_zone
You need to call:
`function transfer(address _to, uint _value, bytes _data) public returns (bool);`
Of the DTH contract with the address of ZoneFactory as a parameter

#### Inputs

* `address _to`: ZoneFactory address
* `uint _value`: At least the floor licence price
* `bytes _data`: Formatted list of arguments

* FOR BYTES PARAMS
You can use this function to format everything well:   
```javascript
const createDthZoneCreateDataWithTier = (zoneFactoryAddr, bid, countryCode, geohash) => {
  const fnSig = web3.eth.abi.encodeFunctionSignature('transfer(address,uint256,bytes)');
  const params = web3.eth.abi.encodeParameters(
    ['address', 'uint256', 'bytes'],
    [zoneFactoryAddr, web3.utils.toWei(bid.toString(), 'ether'), `0x40${countryCode.slice(2)}${geohash.slice(2)}`],
  );
  return [fnSig, params.slice(2)].join('');
};
````
#### Inputs

- `zoneFactoryAddr`: zoneFactoryAddr address
- `bid`: The amount of DTH you want to bid (the address who sent need enough DTH)
- `countryCode`: countryCode in format [ISO CODE 3166](https://en.wikipedia.org/wiki/List_of_ISO_3166_country_codes)
- `geohash`: geohash of 6 character for the zone you want to get

---

### Add_Teller  

Once a zone is created, a teller can add a teller point, he need first to get the teller contract associated with the zone.
```javascript
  function addTeller(
    bytes calldata _position,
    uint8 _currencyId,
    bytes16 _messenger,
    int16 _sellRate,
    int16 _buyRate,
    bytes1 _settings,
    address _referrer,
    uint _refFee,    // referral fees x 10 (exemple, for 21.3 % -> 213) Max is 33.3%. The fees its taken from the harbeger taxes
    bytes32 _description
  )
```
#### Example
```javascript
    const zoneAddress = await zoneFactoryInstance.geohashToZone(web3.utils.asciiToHex('krczts'));
    const zoneInstance = await Zone.at(zoneAddress);
    const tellerAddress = await zoneInstance.teller();
    const tellerInstance = await Teller.at(tellerAddress);
    // add teller in the teller instance
    tellerInstance.addTeller(web3.utils.asciiToHex('krcztsebcddd'), '1', web3.utils.asciiToHex('my_telegram_nick'), '177', '1364', '0x03', '0x01010101010101010101010101010101', 21, web3.utils.asciiToHex('ETH-BTC-XMR'));
```
#### Inputs

* `_position`: geohash of 12 characeter for the position of the teller, must be inside the geohash 6 of the zone
* `_currencyId`: Base currency 1 = USD
* `_messenger`: telegram nickname (max 16 bytes)
* `_sellRate`: margin for sell * 100, for 8.7%, put 870
* `_buyRate`: margin for buy * 100, for 3.21%, put 321
* `_settings`, For settings if teller is buyer and seller. 0000 0011 <-- both buyer and seller bit set
* `_referrer`, Referrer address, the referrer get a % fo the daily taxes (0.04% of the DTH staked on the zone) can be 0x00000000000000000000000000000000 if no referrer.
* `_refFee`, Max 33 for 33% fo the taxes going to the referrer, 0 if not referrer.
* `_description`, Description of the teller, can put different ticker if teller get different crypto. ex: 'ETH-BTC-XMR'.

---

### Bid_on_a_zone  
Once a zone is created anyone can bid on it to get the ownership   
To do so he must send a transfer ERC223 tx with DTH to the zone address   .

`function transfer(address _to, uint _value, bytes _data) public returns (bool);`

#### Inputs

* `address _to`: ZoneFactory address
* `uint _value`: At least the floor licence price
* `bytes _data`: Formatted list of arguments   

#### Example
```javascript
const createDthZoneBidData = (zoneAddr, bid) => {
  const fnSig = web3.eth.abi.encodeFunctionSignature('transfer(address,uint256,bytes)');
  const params = web3.eth.abi.encodeParameters(
    ['address', 'uint256', 'bytes'],
    [zoneAddr, ethToWei(bid), '0x42'],
  );
  return [fnSig, params.slice(2)].join('');
};
  const placeBid = async (from, dthAmount, zoneAddress) => {
    await dthInstance.mint(from, ethToWei(dthAmount), { from: owner });
    const tx = await web3.eth.sendTransaction({
      from,
      to: dthInstance.address,
      data: createDthZoneBidData(zoneAddress, dthAmount),
      value: 0,
      gas: 4700000,
    });
    return tx;
  };
  // in this example userAddress need to have at least 1000 DTH
  placeBid(userAddress, 1000, ZONE_ADDRESS);

```

### (TODO add other fonction)




