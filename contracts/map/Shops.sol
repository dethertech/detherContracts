pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "../dth/IDetherToken.sol";
import "../core/IUsers.sol";
import "../core/IControl.sol";
import "./IGeoRegistry.sol";
import "../kleros/IArbitrable.sol";
import "../kleros/Arbitrator.sol";

contract Shops is IArbitrable {
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
  // enum DisputeStatus {Waiting, Appealable, Solved} // copied from Arbitrator.sol

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

  struct ShopDispute {
    address shop;
    address challenger;
    uint disputeType;
    RulingOptions ruling;
    Arbitrator.DisputeStatus status;
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
  Arbitrator public arbitrator; // <-- kleros

  // kleros related
  string public constant RULING_OPTIONS = "Shop wins;Challenger wins";
  uint8 public constant AMOUNT_OF_CHOICES = 2;
  bytes public arbitratorExtraData;
  string[] public disputeTypes;

  //      countryCode priceDTH
  mapping(bytes2 =>   uint) public countryLicensePrice;

  //      geohash12   shopAddress
  mapping(bytes12 =>  address) public positionToShopAddress;

  //      geohash7    shopAddresses
  mapping(bytes7 =>   address[]) public zoneToShopAddresses;

  // ------------------------------------------------
  //
  // Variables Private
  //
  // ------------------------------------------------

  //      shopAddress shopStruct
  mapping(address =>  Shop) private shopAddressToShop;

  //      disputeId disputeStruct
  mapping(uint =>   ShopDispute) private disputeIdToDispute;

  // ------------------------------------------------
  //
  // Modifiers
  //
  // ------------------------------------------------

  modifier onlyArbitrator {
    require(msg.sender == address(arbitrator), "Can only be called by the arbitrator.");
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

  constructor(address _dth, address _geo, address _users, address _control, address _arbitrator, bytes _arbitratorExtraData)
    public
  {
    require(_dth != address(0), "dth address cannot be 0x0");
    require(_geo != address(0), "geo address cannot be 0x0");
    require(_users != address(0), "users address cannot be 0x0");
    require(_control != address(0), "control address cannot be 0x0");
    require(_arbitrator != address(0), "arbitrator cannot be 0x0");

    dth = IDetherToken(_dth);
    geo = IGeoRegistry(_geo);
    users = IUsers(_users);
    control = IControl(_control);

    // kleros
    arbitrator = Arbitrator(_arbitrator);
    arbitratorExtraData = _arbitratorExtraData;
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

  function shopByAddrExists(address shopAddress)
    external
    view
    returns (bool)
  {
    return shopAddressToShop[shopAddress].position != bytes12(0);
  }

  // ------------------------------------------------
  //
  // Functions Getters Private
  //
  // ------------------------------------------------

  function toBytes1(bytes _bytes, uint _start)
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
  function toBytes2(bytes _bytes, uint _start)
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
  function toBytes4(bytes _bytes, uint _start)
    private
    pure
    returns (bytes4) {
      require(_bytes.length >= (_start + 4), " not long enough");
      bytes4 tempBytes4;

      assembly {
          tempBytes4 := mload(add(add(_bytes, 0x20), _start))
      }

      return tempBytes4;
  }
  function toBytes7(bytes _bytes, uint _start)
    private
    pure
    returns (bytes7) {
      require(_bytes.length >= (_start + 7), " not long enough");
      bytes7 tempBytes7;

      assembly {
          tempBytes7 := mload(add(add(_bytes, 0x20), _start))
      }

      return tempBytes7;
  }
  function toBytes12(bytes _bytes, uint _start)
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
  function toBytes16(bytes _bytes, uint _start)
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
  function toBytes32(bytes _bytes, uint _start)
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
  {
    require(control.isCEO(msg.sender), "can only be called by CEO");
    countryLicensePrice[_countryCode] = _priceDTH;
  }

  function tokenFallback(address _from, uint _value, bytes _data)
    public
  {
    require(msg.sender == address(dth), "can only be called by dth contract");

    require(control.paused() == false, "contract is paused");

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
    require(users.getUserTier(sender) > 0, "user not certified");
    require(shopAddressToShop[sender].position == bytes12(0), "caller already has shop");
    require(positionToShopAddress[position] == address(0), "shop already exists at position");
    require(geo.validGeohashChars12(position), "invalid geohash characters in position");
    require(geo.zoneInsideCountry(country, bytes4(position)), "zone is not inside country");

    require(_value >= countryLicensePrice[country], "send dth is less than shop license price");

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

  function removeShop(bytes12 _position)
    external
  {
    require(control.paused() == false, "contract is paused");
    require(users.getUserTier(msg.sender) > 0, "user not certified");
    // if country is disabled, user can still remove his shop!

    require(_position != bytes12(0), "position cannot be bytes12(0)");
    require(shopAddressToShop[msg.sender].position == _position, "caller does not own shop at position");

    require(shopAddressToShop[msg.sender].hasDispute == false, "cannot remove shop while in dispute");

    uint shopStake = shopAddressToShop[msg.sender].staked;

    deleteShop(msg.sender);

    dth.transfer(msg.sender, shopStake);
  }

  //
  //
  //
  //
  // Kleros Dispute Arbitration
  //
  //
  //
  //

  // so we can add new types of dispute in the future
  function addDisputeType(string _disputeTypeLink)
    external
  {
    require(control.isCEO(msg.sender), "can only be called by CEO");
    require(bytes(_disputeTypeLink).length > 0, "dispute type link is empty");

    uint metaEvidenceId = disputeTypes.push(_disputeTypeLink) - 1;

    emit MetaEvidence(metaEvidenceId, _disputeTypeLink);
  }

  function getDisputeCreateCost()
    public
    view
    returns (uint)
  {
    return arbitrator.arbitrationCost(arbitratorExtraData) * 2;
  }

  function getDisputeAppealCost(uint _disputeID)
    public
    view
    returns (uint)
  {
    uint a = arbitrator.appealCost(_disputeID, arbitratorExtraData);

    return a;
  }

  function getDisputeStatus(uint _disputeID)
    private
    returns (Arbitrator.DisputeStatus disputeStatus)
  {
    ShopDispute storage dispute = disputeIdToDispute[_disputeID];

    if (dispute.status == Arbitrator.DisputeStatus.Solved) {
      // rule() in this contract was called, it set status to Solved and set the final Ruling
      disputeStatus = dispute.status;
    } else {
      // dispute is not yet finalized, get current values from arbitrator contract
      disputeStatus = arbitrator.disputeStatus(_disputeID); // returns Arbitrator.DisputeStatus
    }
  }

  function getDisputeRuling(uint _disputeID)
    private
    returns (RulingOptions disputeRuling)
  {
    ShopDispute storage dispute = disputeIdToDispute[_disputeID];

    if (dispute.status == Arbitrator.DisputeStatus.Solved) {
      // rule() in this contract was called, it set status to Solved and set the final Ruling
      disputeRuling = dispute.ruling;
    } else {
      // dispute is not yet finalized, get current values from arbitrator contract
      disputeRuling = RulingOptions(arbitrator.currentRuling(_disputeID));
    }
  }

  function getDispute(uint _disputeID)
    public
    view
    returns (address, address, uint, uint, uint)
  {
    ShopDispute memory dispute = disputeIdToDispute[_disputeID];

    return (
      dispute.shop,
      dispute.challenger,
      dispute.disputeType,

      // from arbitrator contract or this contract if finalized
      uint(getDisputeRuling(_disputeID)),
      uint(getDisputeStatus(_disputeID))
    );
  }

  // called by somebody who wants to start a dispute with a shop
  function createDispute(bytes12 _position, uint _metaEvidenceId, string _evidenceLink)
    public
    payable
  {
    require(control.paused() == false, "contract is paused");
    require(users.getUserTier(msg.sender) > 0, "user not certified");

    require(_metaEvidenceId < disputeTypes.length, "dispute type does not exist");
    require(bytes(_evidenceLink).length > 0, "evidence link is empty");

    address shopAddress = positionToShopAddress[_position];
    require(shopAddress != address(0), "no shop at that position");
    require(shopAddressToShop[msg.sender].position != _position, "shop owner cannot start dispute on own shop");
    require(shopAddressToShop[shopAddress].hasDispute == false, "shop already has a dispute");

    uint arbitrationCost = getDisputeCreateCost();
    require(msg.value >= arbitrationCost, "sent eth is lower than arbitration cost");

    uint disputeID = arbitrator.createDispute.value(arbitrationCost)(AMOUNT_OF_CHOICES, arbitratorExtraData);

    // create new Dispute
    ShopDispute storage dispute = disputeIdToDispute[disputeID];
    dispute.challenger = msg.sender;
    dispute.shop = shopAddress;
    dispute.disputeType = _metaEvidenceId;
    dispute.ruling = RulingOptions.NoRuling;
    dispute.status = Arbitrator.DisputeStatus.Waiting;

    Shop storage shop = shopAddressToShop[shopAddress];
    shop.hasDispute = true; // disputeID could theoretically be zero, so we need this to know if a dispute exists
    shop.disputeID = disputeID;

    emit Dispute(arbitrator, disputeID, _metaEvidenceId);
    emit Evidence(arbitrator, disputeID, msg.sender, _evidenceLink);

    uint excessEth = arbitrationCost.sub(msg.value);
    if (excessEth > 0) msg.sender.transfer(excessEth);
  }


  function appealDispute(uint _disputeID, string _evidenceLink)
    external
    payable
  {
    require(control.paused() == false, "contract is paused");
    require(users.getUserTier(msg.sender) > 0, "user not certified");

    require(bytes(_evidenceLink).length > 0, "evidence link is empty");

    ShopDispute storage dispute = disputeIdToDispute[_disputeID];
    require(dispute.shop != address(0), "dispute does not exist");
    require(getDisputeStatus(_disputeID) == Arbitrator.DisputeStatus.Appealable, "dispute is not appealable");

    RulingOptions currentRuling = getDisputeRuling(_disputeID);
    if (currentRuling == RulingOptions.ShopWins) {
      require(msg.sender == dispute.challenger, "shop ruled to win, only challenger can appeal");
    } else if (currentRuling == RulingOptions.ChallengerWins) {
      require(msg.sender == dispute.shop, "challenger ruled to win, only shop can appeal");
    } else {
      require(msg.sender == dispute.challenger, "no ruling given, only challenger can appeal");
    }

    uint appealCost = arbitrator.appealCost(_disputeID, arbitratorExtraData);
    require(msg.value >= appealCost, "sent eth is lower than appeal cost");

    arbitrator.appeal.value(appealCost)(_disputeID, arbitratorExtraData);

    emit Evidence(arbitrator, _disputeID, msg.sender, _evidenceLink);

    uint excessEth = appealCost.sub(msg.value);
    if (excessEth > 0) msg.sender.transfer(excessEth);
  }

  function deleteDispute(uint _disputeID)
    private
  {
    delete disputeIdToDispute[_disputeID];
  }

  // called by rule() which is called by Kleros Arbitrator contract
  function executeRuling(uint _disputeID, uint _ruling)
    private
  {
    RulingOptions finalRuling = RulingOptions(_ruling);

    ShopDispute storage dispute = disputeIdToDispute[_disputeID];
    Shop storage shop = shopAddressToShop[dispute.shop];

    if (finalRuling == RulingOptions.ShopWins) {
      shop.hasDispute = false;
      shop.disputeID = 0;

      deleteDispute(_disputeID);
    } else if (finalRuling == RulingOptions.ChallengerWins) {
      uint shopStake = shop.staked;
      address challenger = dispute.challenger;

      deleteShop(dispute.shop);
      deleteDispute(_disputeID);

      dth.transfer(challenger, shopStake);
    } else if (finalRuling == RulingOptions.NoRuling) {
      shop.hasDispute = false;
      shop.disputeID = 0;

      deleteDispute(_disputeID);
    }
  }
  function rule(uint _disputeID, uint _ruling)
    public
    onlyArbitrator
  {
    emit Ruling(Arbitrator(msg.sender), _disputeID, _ruling);

    executeRuling(_disputeID,_ruling);
  }
}
