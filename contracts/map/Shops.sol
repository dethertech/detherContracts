pragma solidity ^0.5.3;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../interfaces/IDetherToken.sol";
import "../interfaces/IUsers.sol";
import "../interfaces/IControl.sol";
import "../interfaces/IGeoRegistry.sol";

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
    uint staked;
    bool hasDispute;
    uint disputeID;
  }

  // ------------------------------------------------
  //
  // Variables Public
  //
  // ------------------------------------------------

  // links to other contracts
  IDetherToken public dth;
  IGeoRegistry public geo;
  IUsers public users;
  IControl public control;
  address public shopsDispute;

  //      countryCode priceDTH
  mapping(bytes2 =>   uint) public countryLicensePrice;

  //      geohash12   shopAddress
  mapping(bytes12 =>  address) public positionToShopAddress;

  //      geohash7    shopAddresses
  mapping(bytes7 =>   address[]) public zoneToShopAddresses;

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

  // ------------------------------------------------
  //
  // Modifiers
  //
  // ------------------------------------------------

  modifier onlyWhenCallerIsCEO {
    require(control.isCEO(msg.sender), "can only be called by CEO");
    _;
  }

  modifier onlyWhenShopsDisputeSet {
    require(shopsDispute != address(0), "shopsDispute contract has not been set");
    _;
  }

  modifier onlyWhenCallerIsShopsDispute {
    require(msg.sender == shopsDispute, "can only be called by shopsDispute contract");
    _;
  }

  modifier onlyWhenCallerIsCertified {
    require(users.getUserTier(msg.sender) > 0, "user not certified");
    _;
  }

  modifier onlyWhenNotPaused {
    require(control.paused() == false, "contract is paused");
    _;
  }

  modifier onlyWhenCallerIsDTH {
    require(msg.sender == address(dth), "can only be called by dth contract");
    _;
  }

  modifier onlyWhenNoDispute(address _shopAddress) {
    require(!shopAddressToShop[_shopAddress].hasDispute, "shop has dispute");
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

  constructor(address _dth, address _geo, address _users, address _control)
    public
  {
    require(_dth != address(0), "dth address cannot be 0x0");
    require(_geo != address(0), "geo address cannot be 0x0");
    require(_users != address(0), "users address cannot be 0x0");
    require(_control != address(0), "control address cannot be 0x0");

    dth = IDetherToken(_dth);
    geo = IGeoRegistry(_geo);
    users = IUsers(_users);
    control = IControl(_control);
  }
  function setShopsDisputeContract(address _shopsDispute)
    external
    onlyWhenCallerIsCEO
  {
    require(_shopsDispute != address(0), "shops dispute contract cannot be 0x0");
    shopsDispute = _shopsDispute;
  }

  // ------------------------------------------------
  //
  // Functions Getters Public
  //
  // ------------------------------------------------

  function getShopByAddr(address _addr)
    public
    view
    returns (bytes12, bytes16, bytes16, bytes32, bytes16, uint, bool, uint)
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
      shop.disputeID
    );
  }

  function getShopByPos(bytes12 _position)
    external
    view
    returns (bytes12, bytes16, bytes16, bytes32, bytes16, uint, bool, uint)
  {
    address shopAddr = positionToShopAddress[_position];
    return getShopByAddr(shopAddr);
  }

  function getShopAddressesInZone(bytes7 _zoneGeohash)
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

  function setCountryLicensePrice(bytes2 _countryCode, uint _priceDTH)
    external
    onlyWhenCallerIsCEO
  {
    countryLicensePrice[_countryCode] = _priceDTH;
  }

  function tokenFallback(address _from, uint _value, bytes memory _data)
    public
    onlyWhenCallerIsDTH
    onlyWhenNotPaused
  {
    require(_data.length == 95, "addShop expects 95 bytes as data");

    address sender = _from;
    uint dthAmount = _value;

    bytes1 fn = toBytes1(_data, 0);
    require(fn == bytes1(0x30), "incorrect first byte in data, expected 0x30");

    bytes2 country = toBytes2(_data, 1);
    bytes12 position = toBytes12(_data, 3);
    bytes16 category = toBytes16(_data, 15);
    bytes16 name = toBytes16(_data, 31);
    bytes32 description = toBytes32(_data, 47);
    bytes16 opening = toBytes16(_data, 79);

    require(geo.countryIsEnabled(country), "country is disabled");
    // require(users.getUserTier(sender) > 0, "user not certified");
    require(shopAddressToShop[sender].position == bytes12(0), "caller already has shop");
    require(positionToShopAddress[position] == address(0), "shop already exists at position");
    require(geo.validGeohashChars12(position), "invalid geohash characters in position");
    require(geo.zoneInsideCountry(country, bytes4(position)), "zone is not inside country");

    require(dthAmount >= countryLicensePrice[country], "send dth is less than shop license price");

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

    // so we can get a shop based on its position
    positionToShopAddress[position] = sender;

    // a zone is a 7 character geohash, we keep track of all shops in a given zone
    zoneToShopAddresses[bytes7(position)].push(sender);
  }

  function deleteShop(address shopAddress)
    private
  {
    bytes12 position = shopAddressToShop[shopAddress].position;

    delete shopAddressToShop[shopAddress];

    positionToShopAddress[position] = address(0);

    // it's safe to do a loop, the number of geohash12 in any geohash7 (33.554.432) is less than the max uint value
    // however we would like to NOT loop,
    // TODO: get rid of the loop by tracking the index of each shop address
    address[] storage zoneShopAddresses = zoneToShopAddresses[bytes7(position)];
    for (uint i = 0; i < zoneShopAddresses.length; i += 1) {
      address zoneShopAddress = zoneShopAddresses[i];
      if (zoneShopAddress == shopAddress) {
        address lastShopAddress = zoneShopAddresses[zoneShopAddresses.length - 1];
        zoneShopAddresses[i] = lastShopAddress;
        zoneShopAddresses.length--;
        break; // done
      }
    }
  }

  function removeShop()
    external
    onlyWhenNotPaused
    onlyWhenShopsDisputeSet
    onlyWhenCallerIsShop
    // onlyWhenCallerIsCertified
    onlyWhenNoDispute(msg.sender)
  {
    uint shopStake = shopAddressToShop[msg.sender].staked;

    deleteShop(msg.sender);

    dth.transfer(msg.sender, shopStake);
  }

  function withdrawDth()
    external
    onlyWhenNotPaused
    onlyWhenShopsDisputeSet
  {
    uint dthWithdraw = withdrawableDth[msg.sender];
    require(dthWithdraw > 0, "nothing to withdraw");

    withdrawableDth[msg.sender] = 0;
    dth.transfer(msg.sender, dthWithdraw);
  }

  //
  // called by shopsDispute contract
  //

  function setDispute(address _shopAddress, uint _disputeID)
    external
    onlyWhenNotPaused
    onlyWhenShopsDisputeSet
    onlyWhenCallerIsShopsDispute
  {
    require(shopAddressToShop[_shopAddress].position != bytes12(0), "shop does not exist");
    shopAddressToShop[_shopAddress].hasDispute = true;
    shopAddressToShop[_shopAddress].disputeID = _disputeID;
  }

  function unsetDispute(address _shopAddress)
    external
    onlyWhenNotPaused
    onlyWhenShopsDisputeSet
    onlyWhenCallerIsShopsDispute
  {
    require(shopAddressToShop[_shopAddress].position != bytes12(0), "shop does not exist");
    shopAddressToShop[_shopAddress].hasDispute = false;
    shopAddressToShop[_shopAddress].disputeID = 0;
  }

  function removeDisputedShop(address _shopAddress, address _challenger)
    external
    onlyWhenNotPaused
    onlyWhenShopsDisputeSet
    onlyWhenCallerIsShopsDispute
  {
    uint shopStake = shopAddressToShop[_shopAddress].staked;

    deleteShop(_shopAddress);

    withdrawableDth[_challenger] = shopStake;
  }
}
