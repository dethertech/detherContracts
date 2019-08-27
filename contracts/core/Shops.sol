pragma solidity ^0.5.10;
pragma experimental ABIEncoderV2;


import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../interfaces/IDetherToken.sol";
import "../interfaces/IUsers.sol";
import "../interfaces/IGeoRegistry.sol";
import "../interfaces/IZoneFactory.sol";
import "../interfaces/IZone.sol";

contract Shops {
  // ------------------------------------------------
  //
  // Libraries
  //
  // ------------------------------------------------

  using SafeMath for uint;

  // ------------------------------------------------
  //
  // Enums
  //
  // ------------------------------------------------

  enum Party {Shop, Challenger}
  enum RulingOptions {NoRuling, ShopWins, ChallengerWins}
  /* enum DisputeStatus {Waiting, Appealable, Solved} // copied from IArbitrable.sol */

  // ------------------------------------------------
  //
  // Structs
  //
  // ------------------------------------------------

  struct Shop {
    bytes12 position; // 12 char geohash for location of teller
    bytes16 category;
    bytes16 name;
    bytes32 description;
    bytes16 opening;
    bytes6 geohashZoneBase;
    uint staked;
    uint licencePrice;
    uint lastTaxTime;
    bool hasDispute;
    uint disputeID;
    uint _index;
  }
  
  // ------------------------------------------------
  //
  // Variables Public
  //
  // ------------------------------------------------

  uint public stakedDth;

  // links to other contracts
  IDetherToken public dth;
  IGeoRegistry public geo;
  IUsers public users;
  IZoneFactory public zoneFactory;
  address public shopsDispute;
  address public disputeStarter;
  bool disputeEnabled = false;

  // constant
  uint public constant TAX= 42; // 1/42 daily
  uint public constant floorLicencePrice = 42 ether; // 18 decimal in DTH

    //    bytes6 geohash priceDTH
  mapping(bytes6 =>   uint) public zoneLicencePrice;

  //      geohash12   shopAddress
  mapping(bytes12 =>  address) public positionToShopAddress;

  //      geohash6    shopAddresses
  mapping(bytes6 =>   address[]) public zoneToShopAddresses;

  mapping(address => uint) public withdrawableDth;

  // ------------------------------------------------
  //
  // Variables Private
  //
  // ------------------------------------------------

  //      shopAddress shopStruct
  mapping(address =>  Shop) private shopAddressToShop;

  // ------------------------------------------------
  //
  // Events
  //
  // ------------------------------------------------
  event TaxTotalPaidTo(uint amount, address to);
  // ------------------------------------------------
  //
  // Modifiers
  //
  // ------------------------------------------------

  // modifier onlyWhenDisputeEnabled {
  //   require(disputeEnabled, "Can only be called when dispute is enabled");
  //   _;
  // }

  // modifier onlyWhenCallerIsShopsDispute {
  //   require(msg.sender == shopsDispute, "can only be called by shopsDispute contract");
  //   _;
  // }

  modifier onlyWhenCallerIsShopsDispute {
    require(msg.sender == shopsDispute, "can only be called by shopsDispute contract");
    require(disputeEnabled, "Can only be called when dispute is enabled");
    _;
  }

  modifier onlyWhenCallerIsDTH {
    require(msg.sender == address(dth), "can only be called by dth contract");
    _;
  }

  modifier onlyWhenNoDispute(address _shopAddress) {
    if (disputeEnabled) {
      require(!shopAddressToShop[_shopAddress].hasDispute, "shop has dispute");
    }
    _;
  }

  modifier onlyWhenCallerIsShop {
    require(shopAddressToShop[msg.sender].position != bytes12(0), "caller is not shop");
    _;
  }

  // ------------------------------------------------
  //
  // Events
  //
  // ------------------------------------------------

  // ------------------------------------------------
  //
  // Constructor
  //
  // ------------------------------------------------

  constructor(address _dth, address _geo, address _users, address _zoneFactory)
    public
  {
    require(_dth != address(0), "dth address cannot be 0x0");
    require(_geo != address(0), "geo address cannot be 0x0");
    require(_users != address(0), "users address cannot be 0x0");
    require(_zoneFactory != address(0), "zoneFactory address cannot be 0x0");

    dth = IDetherToken(_dth);
    geo = IGeoRegistry(_geo);
    users = IUsers(_users);
    zoneFactory = IZoneFactory(_zoneFactory);
    disputeStarter = msg.sender;
  }
  function setShopsDisputeContract(address _shopsDispute)
    external
  {
    require(_shopsDispute != address(0), "shops dispute contract cannot be 0x0");
    require(msg.sender == disputeStarter,"caller must be dispute starter");
    require(disputeEnabled == false,"dispute must be enabled");
    shopsDispute = _shopsDispute;
  }
  function enableDispute()
    external 
    {
      require(msg.sender == disputeStarter,"caller must be dispute starter");
      require(shopsDispute != address(0), "shopsDispute contract has not been set");
      disputeEnabled = true;
    }
  // ------------------------------------------------
  //
  // Functions Getters Public
  //
  // ------------------------------------------------

  function getShopByAddr(address _addr)
    public
    view
    returns (bytes12, bytes16, bytes16, bytes32, bytes16, uint, bool, uint, uint, uint)
  {
    Shop memory shop = shopAddressToShop[_addr];

    return (
      shop.position,
      shop.category,
      shop.name,
      shop.description,
      shop.opening,
      shop.staked,
      shop.hasDispute,
      shop.disputeID,
      shop.lastTaxTime,
      shop.licencePrice
    );
  }

  function getShopByPos(bytes12 _position)
    external
    view
    returns (bytes12, bytes16, bytes16, bytes32, bytes16, uint, bool, uint, uint, uint)
  {
    address shopAddr = positionToShopAddress[_position];
    return getShopByAddr(shopAddr);
  }

  function getShopAddressesInZone(bytes6 _zoneGeohash)
    external
    view
    returns (address[] memory)
  {
    return zoneToShopAddresses[_zoneGeohash];
  }

  function shopByAddrExists(address _shopAddress)
    external
    view
    returns (bool)
  {
    return shopAddressToShop[_shopAddress].position != bytes12(0);
  }

  function getShopDisputeID(address _shopAddress)
    external
    view
    returns (uint)
  {
    require(shopAddressToShop[_shopAddress].position != bytes12(0), "shop does not exist");
    require(shopAddressToShop[_shopAddress].hasDispute, "shop has no dispute");
    return shopAddressToShop[_shopAddress].disputeID;
  }

  function hasDispute(address _shopAddress)
    external
    view
    returns (bool)
  {
    require(shopAddressToShop[_shopAddress].position != bytes12(0), "shop does not exist");
    return shopAddressToShop[_shopAddress].hasDispute;
  }

  function getShopStaked(address _shopAddress)
    external
    view
    returns (uint)
  {
    require(shopAddressToShop[_shopAddress].position != bytes12(0), "shop does not exist");
    return shopAddressToShop[_shopAddress].staked;
  }

  // ------------------------------------------------
  //
  // Functions Getters Private
  //
  // ------------------------------------------------
  // audit feedback
  function isContract(address addr) private view returns (bool) {
    uint size;
    assembly { size := extcodesize(addr) }
    return size > 0;
  }

  function toBytes1(bytes memory _bytes, uint _start)
    private
    pure
    returns (bytes1) {
      require(_bytes.length >= (_start + 1), " not long enough");
      bytes1 tempBytes1;

      assembly {
          tempBytes1 := mload(add(add(_bytes, 0x20), _start))
      }

      return tempBytes1;
  }
  function toBytes2(bytes memory _bytes, uint _start)
    private
    pure
    returns (bytes2) {
      require(_bytes.length >= (_start + 2), " not long enough");
      bytes2 tempBytes2;

      assembly {
          tempBytes2 := mload(add(add(_bytes, 0x20), _start))
      }

      return tempBytes2;
  }
  function toBytes6(bytes memory _bytes, uint _start)
    private
    pure
    returns (bytes6)
  {
    require(_bytes.length >= (_start + 6), " not long enough");
    bytes6 tempBytes6;

    assembly {
        tempBytes6 := mload(add(add(_bytes, 0x20), _start))
    }

    return tempBytes6;
  }
  function toBytes12(bytes memory _bytes, uint _start)
    private
    pure
    returns (bytes12) {
      require(_bytes.length >= (_start + 12), " not long enough");
      bytes12 tempBytes12;

      assembly {
          tempBytes12 := mload(add(add(_bytes, 0x20), _start))
      }

      return tempBytes12;
  }
  function toBytes16(bytes memory _bytes, uint _start)
    private
    pure
    returns (bytes16) {
      require(_bytes.length >= (_start + 16), " not long enough");
      bytes16 tempBytes16;

      assembly {
          tempBytes16 := mload(add(add(_bytes, 0x20), _start))
      }

      return tempBytes16;
  }
  function toBytes32(bytes memory _bytes, uint _start)
    private
    pure
    returns (bytes32) {
      require(_bytes.length >= (_start + 32), " not long enough");
      bytes32 tempBytes32;

      assembly {
          tempBytes32 := mload(add(add(_bytes, 0x20), _start))
      }

      return tempBytes32;
  }

  // ------------------------------------------------
  //
  // Functions Setters Public
  //
  // ------------------------------------------------
  
  function setZoneLicensePrice(bytes6 _zoneGeohash, uint _priceDTH)
    external
  {
    address zoneAddress = zoneFactory.geohashToZone(_zoneGeohash);
    require(zoneAddress != address(0), "zone is not already owned");
    IZone zoneInstance = IZone(zoneAddress);
    address zoneOwner = zoneInstance.ownerAddr();
    require(msg.sender == zoneOwner,"only zone owner can modify the licence price");
    require(_priceDTH > floorLicencePrice, "price should be superior to the floor price");
    zoneLicencePrice[_zoneGeohash] = _priceDTH;
  }

  function calcShopTax(uint _startTime, uint _endTime, uint _licencePrice)
    public
    view
    returns (uint taxAmount)
  {
    taxAmount = _licencePrice.mul(_endTime.sub(_startTime)).div(TAX).div(1 days);
  }

  function collectTax(bytes6 _zoneGeohash, uint _start, uint _end)
    public
  {
    address zoneAddress = zoneFactory.geohashToZone(_zoneGeohash);
    require(zoneAddress != address(0), "zone is not already owned");
    IZone zoneInstance = IZone(zoneAddress);
    address zoneOwner = zoneInstance.ownerAddr();
    // require(msg.sender == zoneOwner, "only zone owner can collect taxes");

    address[] memory shopsinZone = zoneToShopAddresses[_zoneGeohash];
    require(_end - _start <= shopsinZone.length && _end <= shopsinZone.length, "start and end value are bigger than address[]");
    // loop on all shops present on his zone and:
    // collect taxes if possible
    // delete point if no more enough stake
    uint taxToSendToZoneOwner = 0;
    for (uint i = _start; i < _end; i+= 1) {

      uint taxAmount = calcShopTax(shopAddressToShop[shopsinZone[i]].lastTaxTime, now, shopAddressToShop[shopsinZone[i]].licencePrice);
      if (taxAmount > shopAddressToShop[shopsinZone[i]].staked) {
        // shop pay what he can and is deleted
        taxToSendToZoneOwner = taxToSendToZoneOwner.add(shopAddressToShop[shopsinZone[i]].staked);
        _deleteShop(shopsinZone[i]);
      } else {
        shopAddressToShop[shopsinZone[i]].staked = shopAddressToShop[shopsinZone[i]].staked.sub(taxAmount);

        taxToSendToZoneOwner = taxToSendToZoneOwner.add(taxAmount);

        shopAddressToShop[shopsinZone[i]].lastTaxTime = now;
      }
    }
    require(dth.transfer(zoneOwner, taxToSendToZoneOwner));
    stakedDth = stakedDth.sub(taxToSendToZoneOwner);
    emit TaxTotalPaidTo(taxToSendToZoneOwner, zoneOwner);
  }

  function tokenFallback(address _from, uint _value, bytes memory _data)
    public
    onlyWhenCallerIsDTH
  {
    require(_data.length == 95, "addShop expects 95 bytes as data");
    // audit feedback
    require(!isContract(_from), 'shops cannot be a contract');
    address sender = _from;
    uint dthAmount = _value;

    bytes1 fn = toBytes1(_data, 0);
    require(fn == bytes1(0x30) || fn == bytes1(0x31), "first byte didnt match func shop");

    if (fn == bytes1(0x31)) {         // shop account top up
      _topUp(sender, _value);
    } else if (fn == bytes1(0x30)) {  // shop creation
      bytes2 country = toBytes2(_data, 1);
      bytes12 position = toBytes12(_data, 3);
      bytes16 category = toBytes16(_data, 15);
      bytes16 name = toBytes16(_data, 31);
      bytes32 description = toBytes32(_data, 47);
      bytes16 opening = toBytes16(_data, 79);

      require(geo.zoneIsEnabled(country), "country is disabled");
      require(shopAddressToShop[sender].position == bytes12(0), "caller already has shop");
      require(positionToShopAddress[position] == address(0), "shop already exists at position");
      require(geo.validGeohashChars12(position), "invalid geohash characters in position");
      require(geo.zoneInsideBiggerZone(country, bytes4(position)), "zone is not inside country");

      // check the price for adding shop in this zone (geohash6)
      uint zoneValue = zoneLicencePrice[bytes6(position)] > floorLicencePrice ? zoneLicencePrice[bytes6(position)] : floorLicencePrice;
      require(dthAmount >= zoneValue, "send dth is less than shop license price");

      // create new entry in storage
      Shop storage shop = shopAddressToShop[sender];
      shop.position = position; // a 12 character geohash
      shop.category = category;
      shop.name = name;
      shop.description = description;
      shop.opening = opening;
      shop.staked = dthAmount;
      shop.hasDispute = false;
      shop.disputeID = 0; // dispute could have id 0..
      shop.geohashZoneBase = bytes6(position);
      shop.licencePrice = zoneValue;
      shop.lastTaxTime = now;
      stakedDth = stakedDth.add(dthAmount);

      // so we can get a shop based on its position
      positionToShopAddress[position] = sender;

      // a zone is a 6 character geohash, we keep track of all shops in a given zone
      shop._index = zoneToShopAddresses[bytes6(position)].push(sender) - 1;
    }
  }

  function _topUp(address _sender, uint _dthAmount) // GAS COST +/- 104.201
    private
  {
    require(shopAddressToShop[_sender].lastTaxTime > 0, 'Shop does not exist'); // TODO change the value of the check
    shopAddressToShop[_sender].staked = shopAddressToShop[_sender].staked.add(_dthAmount);
    stakedDth = stakedDth.add(_dthAmount);
  }

  // function _deleteShop(address shopAddress)
  //   private
  // {
  //   bytes12 position = shopAddressToShop[shopAddress].position;
  //   delete shopAddressToShop[shopAddress];
  //   positionToShopAddress[position] = address(0);

  //   delete positionToShopAddress[shopAddressToShop[shopAddress].position];
  //   uint indexToRemove = shopAddressToShop[shopAddress]._index;
  //   zoneToShopAddresses[bytes6(position)][indexToRemove] = zoneToShopAddresses[bytes6(position)][zoneToShopAddresses[bytes6(position)].length - 1];
  //   shopAddressToShop[zoneToShopAddresses[bytes6(position)][indexToRemove]]._index = indexToRemove;
  //   // zoneToShopAddresses[bytes6(position)].length--;
  //   zoneToShopAddresses[bytes6(position)].pop();
  //   delete shopAddressToShop[shopAddress];
  // }

  function _deleteShop(address shopAddress)
    private
  {
    bytes12 position = shopAddressToShop[shopAddress].position;
    uint indexToRemove = shopAddressToShop[shopAddress]._index;

    // remove shop address from list of shop addresses in zone
    // move last existing shop address to the position of the shop-to-remove
    zoneToShopAddresses[bytes6(position)][indexToRemove] = zoneToShopAddresses[bytes6(position)][zoneToShopAddresses[bytes6(position)].length - 1];
    // update the index of the last shop that was moved into the position fo the shop-to-remove
    shopAddressToShop[zoneToShopAddresses[bytes6(position)][indexToRemove]]._index = indexToRemove;
    // remove the last item, which was moved to the position of shop-to-remove
    zoneToShopAddresses[bytes6(position)].pop();

    delete shopAddressToShop[shopAddress];
    delete positionToShopAddress[shopAddressToShop[shopAddress].position];
  }

  function removeShop()
    external
    onlyWhenCallerIsShop
    onlyWhenNoDispute(msg.sender)
  {
    uint shopStake = shopAddressToShop[msg.sender].staked;

    _deleteShop(msg.sender);

    require(dth.transfer(msg.sender, shopStake));
    stakedDth = stakedDth.sub(shopStake);
  }

  function removeShopFromZoneOwner(address _shopAddress, bytes6 _zoneGeohash)
    external
  {
    require(disputeEnabled == false, 'Once activated, only dispute contract can remove shop');
    address zoneAddress = zoneFactory.geohashToZone(_zoneGeohash);
    IZone zoneInstance = IZone(zoneAddress);
    address zoneOwner = zoneInstance.ownerAddr();
    require(msg.sender == zoneOwner, 'msg.sender is not the owner of the zone');
    bytes12 shopPos = shopAddressToShop[_shopAddress].position;
    bytes6 zoneGeohash = zoneInstance.geohash();
    require(bytes6(shopPos) == zoneGeohash, "position is not inside this zone");
    uint shopStake = shopAddressToShop[_shopAddress].staked;

    _deleteShop(_shopAddress);

    require(dth.transfer(_shopAddress, shopStake));
    stakedDth = stakedDth.sub(shopStake);
  }

  function withdrawDth()
    external
  {
    uint dthWithdraw = withdrawableDth[msg.sender];
    require(dthWithdraw > 0, "nothing to withdraw");

    withdrawableDth[msg.sender] = 0;
    require(dth.transfer(msg.sender, dthWithdraw));
    stakedDth = stakedDth.sub(dthWithdraw);
  }

  //
  // called by shopsDispute contract
  //

  function setDispute(address _shopAddress, uint _disputeID)
    external
    onlyWhenCallerIsShopsDispute
  {
    require(shopAddressToShop[_shopAddress].position != bytes12(0), "shop does not exist");
    shopAddressToShop[_shopAddress].hasDispute = true;
    shopAddressToShop[_shopAddress].disputeID = _disputeID;
  }

  function unsetDispute(address _shopAddress)
    external
    onlyWhenCallerIsShopsDispute
  {
    require(shopAddressToShop[_shopAddress].position != bytes12(0), "shop does not exist");
    shopAddressToShop[_shopAddress].hasDispute = false;
    shopAddressToShop[_shopAddress].disputeID = 0;
  }

  function removeDisputedShop(address _shopAddress, address _challenger)
    external
    onlyWhenCallerIsShopsDispute
  {
    uint shopStake = shopAddressToShop[_shopAddress].staked;

    _deleteShop(_shopAddress);

    withdrawableDth[_challenger] = shopStake;
  }
}
