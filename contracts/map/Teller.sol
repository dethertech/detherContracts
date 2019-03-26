pragma solidity ^0.5.3;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../interfaces/IControl.sol";
import "../interfaces/IGeoRegistry.sol";
import "../interfaces/IZone.sol";
import "../interfaces/ITeller.sol";

contract Teller {
  // ------------------------------------------------
  //
  // Library init
  //
  // ------------------------------------------------

  using SafeMath for uint;

  // ------------------------------------------------
  //
  // Structs
  //
  // ------------------------------------------------

  struct Teller {
    address addr;
    uint8 currencyId;  // 1 - 100 , see README
    bytes16 messenger; // telegrame nickname
    bytes12 position;  // 12 char geohash for location of teller
    bytes1 settings;   // bitmask containing up to 8 boolean settings (only 2 used currently: isSeller, isBuyer)
    int16 buyRate;     // margin of tellers , -999 - +9999 , corresponding to -99,9% x 10  , 999,9% x 10
    int16 sellRate;    // margin of tellers , -999 - +9999 , corresponding to -99,9% x 10  , 999,9% x 10
    address referrer;
  }

  // ------------------------------------------------
  //
  // Variables Private
  //
  // ------------------------------------------------

  uint private constant REFERRER_FEE_PERCENTAGE = 1; // 0.1%
  address private constant ADDRESS_BURN = 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF;

  Teller private teller;
  bytes1 private constant isSellerBitMask = hex"01";
  bytes1 private constant isBuyerBitMask = hex"02";

  // ------------------------------------------------
  //
  // Variables Public
  //
  // ------------------------------------------------

  bool inited;

  IZone public zone;
  IGeoRegistry public geo;
  IControl public control;

  //      who        ethAmount
  mapping(address => uint) public withdrawableEth;

  uint public funds;

  //      teller             poster     commentsLeft
  mapping(address => mapping(address => uint)) public canPlaceCertifiedComment;

  bytes32[] private commentsFree;
  bytes32[] private commentsCertified;

  // ------------------------------------------------
  //
  // Events
  //
  // ------------------------------------------------

  // TODO

  // ------------------------------------------------
  //
  // Modifiers
  //
  // ------------------------------------------------

  modifier onlyWhenInited() {
    // NOTE: somehow if w add an error message, we get 'out of gas' on deploy?!
    // require(inited == true);
    require(inited == true, "contract not yet initialized");
    _;
  }
  modifier onlyWhenNotInited() {
    require(inited == false, "contract already initialized");
    _;
  }

  modifier onlyWhenHasTeller {
    require(teller.position != bytes12(0), "no teller set");
    _;
  }

  modifier onlyWhenHasNoTeller {
    require(teller.position == bytes12(0), "already exists teller");
    _;
  }

  modifier onlyByZoneContract {
    require(msg.sender == address(zone), "can only be called by zone");
    _;
  }

  modifier onlyWhenNotPaused {
    require(control.paused() == false, "contract is paused");
    _;
  }

  modifier onlyWhenCountryEnabled {
    require(geo.countryIsEnabled(zone.country()), "country is disabled");
    _;
  }

  modifier updateState {
    zone.processState();
    _;
  }

  modifier onlyWhenZoneHasOwner {
    require(zone.ownerAddr() != address(0), "zone has no owner");
    _;
  }

  modifier onlyWhenCallerIsNotZoneOwner {
    require(msg.sender != zone.ownerAddr(), "can not be called by zoneowner");
    _;
  }

  modifier onlyWhenCallerIsZoneOwner {
    require(msg.sender == zone.ownerAddr(), "caller is not zoneowner");
    _;
  }

  // ------------------------------------------------
  //
  // Constructor
  //
  // ------------------------------------------------

  // executed by ZoneFactory.sol when this Zone does not yet exist (= not yet deployed)
  function init(
    address _geo,
    address _control,
    address _zone
  )
    external
    onlyWhenNotInited
  {
    zone = IZone(_zone);
    geo = IGeoRegistry(_geo);
    control = IControl(_control);

    inited = true;
  }

  // ------------------------------------------------
  //
  // Functions Getters Public
  //
  // ------------------------------------------------

  function getCertifiedComments()
    external view
    returns (bytes32[] memory)
  {
    return commentsCertified;
  }

  function getComments()
    external view
    returns (bytes32[] memory)
  {
    return commentsFree;
  }

  function calcReferrerFee(uint _value)
    public view
    returns (uint referrerAmount)
  {
    referrerAmount = _value.div(1000).mul(REFERRER_FEE_PERCENTAGE); // 0.1%
  }

  function getTeller()
    external view
    returns (address, uint8, bytes16, bytes12, bytes1, int16, int16, uint, address)
  {
    return (
      teller.addr,
      teller.currencyId,
      teller.messenger,
      teller.position,
      teller.settings,
      teller.buyRate,
      teller.sellRate,
      funds,
      teller.referrer
    );
  }

  function hasTeller()
    external view
    returns (bool)
  {
    return teller.position != bytes12(0);
  }

  // ------------------------------------------------
  //
  // Functions Getters Private
  //
  // ------------------------------------------------

  function toBytes7(bytes memory _bytes, uint _start)
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

  // ------------------------------------------------
  //
  // Functions Setters Public
  //
  // ------------------------------------------------

  function _removeComments()
    private
    onlyWhenInited
    onlyByZoneContract
  {
    delete commentsFree;
    delete commentsCertified;
  }

  function _remove()
    private
  {
    withdrawableEth[teller.addr] = withdrawableEth[teller.addr].add(funds);
    funds = 0;

    // we dont remove comments here, so that zoneowner can not get rid
    // of negative comments by readding his teller ;)

    teller.currencyId = 0;
    teller.messenger = bytes16(0);
    teller.position = bytes12(0);
    teller.settings = bytes1(0);
    teller.buyRate = 0;
    teller.sellRate = 0;
    teller.referrer = address(0);
  }

  function removeTellerByZone()
    external
    onlyByZoneContract
  {
    _remove();
    _removeComments();
  }

  function removeTeller()
    external
    onlyWhenInited
    onlyWhenNotPaused
    updateState
    onlyWhenCallerIsZoneOwner
    onlyWhenHasTeller
  {
    _remove();
  }

  // NOTE: we could just require only last 5 bytes of a bytes12 geohash, since
  // the first 7 bytes will be the geohash of this zone. But by requiring the full geohash
  // we can mkae more sure the user is talking to the right zone
  function addTeller(
    bytes calldata _position,
    uint8 _currencyId,
    bytes16 _messenger,
    int16 _sellRate,
    int16 _buyRate,
    bytes1 _settings,
    address _referrer
  )
    external
    onlyWhenInited
    onlyWhenNotPaused
    onlyWhenCountryEnabled
    updateState
    onlyWhenCallerIsZoneOwner
    onlyWhenHasNoTeller
  {
    require(_position.length == 12, "expected position to be 12 bytes");
    require(toBytes6(_position, 0) == zone.geohash(), "position is not inside this zone");
    require(geo.validGeohashChars(_position), "invalid position geohash characters");

    require(_currencyId >= 1 && _currencyId <= 100, "currency id must be in range 1-100");
    // _messenger can be 0x0 if he has no telegram

    if (_settings & isSellerBitMask != 0) { // seller bit is set => teller is a "seller"
      require(_sellRate >= -9999 && _sellRate <= 9999, "sellRate should be between -9999 and 9999");
    } else {
      require(_sellRate == 0, "cannot set sellRate if not set as seller");
    }

    if (_settings & isBuyerBitMask != 0) { // buyer bit is set => teller is a "buyer"
      require(_buyRate >= -9999 && _buyRate <= 9999, "buyRate should be between -9999 and 9999");
    } else {
      require(_buyRate == 0, "cannot set buyRate if not set as buyer");
    }

    teller.addr = msg.sender;
    teller.currencyId = _currencyId;
    teller.messenger = _messenger;
    teller.buyRate = _buyRate;
    teller.sellRate = _sellRate;
    teller.position = toBytes12(_position, 0);
    teller.settings = _settings;
    teller.referrer = _referrer;
  }

  // called by Teller, adding ETH to Teller funds
  function addFunds() // GAS COST +/- 59.809
    external payable
    onlyWhenInited
    onlyWhenNotPaused
    onlyWhenCountryEnabled
    updateState
    onlyWhenCallerIsZoneOwner
    onlyWhenHasTeller
  {
    require(msg.value > 0, "no eth send with call");

    // register ETH sent to this contract
    funds = funds.add(msg.value);
  }

  // called by Teller, sending ETH from Zone to _to
  function sellEth(address _to, uint _amount) // GAS COST +/- 147.310
    external
    onlyWhenInited
    onlyWhenNotPaused
    onlyWhenCountryEnabled
    updateState
    onlyWhenCallerIsZoneOwner
    onlyWhenHasTeller
  {
    require(teller.addr != _to, "sender cannot also be to");
    require(_amount > 0, "amount to sell cannot be zero");

    if (teller.referrer != address(0)) { // need to pay referrer fee
      uint referrerAmount = calcReferrerFee(_amount);
      require(funds >= _amount + referrerAmount, "not enough funds to sell eth amount plus pay referrer fee");
      funds = funds.sub(_amount + referrerAmount);
      withdrawableEth[teller.referrer] = withdrawableEth[teller.referrer].add(referrerAmount);
    } else {
      require(funds >= _amount, "cannot sell more than in funds");
      funds = funds.sub(_amount);
    }

    zone.proxyUpdateUserDailySold(_to, _amount); // MIGHT THROW if exceeds daily limit

    canPlaceCertifiedComment[teller.addr][_to]++;

    address(uint160(_to)).transfer(_amount);
  }

  function addCertifiedComment(bytes32 _commentHash)
    external
    onlyWhenInited
    onlyWhenNotPaused
    onlyWhenCountryEnabled
    updateState
    onlyWhenZoneHasOwner
    onlyWhenCallerIsNotZoneOwner
    onlyWhenHasTeller
  {
    require(_commentHash != bytes32(0), "comment hash cannot be 0x0");

    require(canPlaceCertifiedComment[teller.addr][msg.sender] > 0, "user not allowed to place a certified comment");
    canPlaceCertifiedComment[teller.addr][msg.sender]--;

    commentsCertified.push(_commentHash);
  }

  function addComment(bytes32 _commentHash)
    external
    onlyWhenInited
    onlyWhenNotPaused
    onlyWhenCountryEnabled
    updateState
    onlyWhenZoneHasOwner
    onlyWhenCallerIsNotZoneOwner
    onlyWhenHasTeller
  {
    require(_commentHash != bytes32(0), "comment hash cannot be 0x0");

    commentsFree.push(_commentHash);
  }
}
