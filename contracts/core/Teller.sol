pragma solidity ^0.5.10;


import "openzeppelin-solidity/contracts/math/SafeMath.sol";

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

  struct Teller_t {
    address addr;
    uint8 currencyId;  // 1 - 100 , see README
    bytes16 messenger; // telegrame nickname
    bytes12 position;  // 12 char geohash for location of teller
    bytes1 settings;   // bitmask containing up to 8 boolean settings (only 2 used currently: isSeller, isBuyer)
    int16 buyRate;     // margin of tellers , -999 - +9999 , corresponding to -99,9% x 10  , 999,9% x 10
    int16 sellRate;    // margin of tellers , -999 - +9999 , corresponding to -99,9% x 10  , 999,9% x 10
    address referrer;
    uint refFee; // 1 = 0.1%
    bytes32 description;
  }

  // ------------------------------------------------
  //
  // Variables Private
  //
  // ------------------------------------------------

  Teller_t private teller;
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


  // bytes32[] private commentsFree;
  // audit feedback
  mapping (address => bytes32[]) private commentsFree;

  // ------------------------------------------------
  //
  // Events
  //
  // ------------------------------------------------

  event AddTeller(bytes position);
  event RemoveTeller(bytes12 position);
  event UpdateTeller(bytes position);

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

  modifier onlyWhenZoneEnabled {
    require(geo.zoneIsEnabled(zone.country()), "country is disabled");
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

  function init(
    address _geo,
    address _zone
  )
    external
    onlyWhenNotInited
  {
    zone = IZone(_zone);
    geo = IGeoRegistry(_geo);
    inited = true;
  }

  // ------------------------------------------------
  //
  // Functions Getters Public
  //
  // ------------------------------------------------

  function getComments()
    external view
    returns (bytes32[] memory)
  {
    return commentsFree[teller.addr];
  }

  function calcReferrerFee(uint _value)
    public view
    returns (uint referrerAmount)
  {
    referrerAmount = _value.div(1000).mul(teller.refFee);
  }

  function getTeller()
    external view
    returns (address addr, uint8 currencyId, bytes16 messenger, bytes12 position, bytes1 settings, int16 buyRate, int16 sellRate, address referrer, bytes32 description)
  {
    return (
      teller.addr,
      teller.currencyId,
      teller.messenger,
      teller.position,
      teller.settings,
      teller.buyRate,
      teller.sellRate,
      // funds,
      teller.referrer,
      teller.description
    );
  }

  function getReferrer()
  external view
  returns (address ref, uint refFee) {
    return (teller.referrer, teller.refFee);
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
  // audit feedback
  function isContract(address addr) private view returns (bool) {
    uint size;
    assembly { size := extcodesize(addr) }
    return size > 0;
  }

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

  // function _removeComments()
  //   private
  //   onlyWhenInited
  //   onlyByZoneContract
  // {
  //   delete commentsFree;
  // }

  function _remove()
    private
  {

    // we dont remove comments here, so that zoneowner can not get rid
    // of negative comments by readding his teller ;)
    teller.addr = address(0); // late add
    teller.currencyId = 0;
    teller.messenger = bytes16(0);
    teller.position = bytes12(0);
    teller.settings = bytes1(0);
    teller.buyRate = 0;
    teller.sellRate = 0;
    teller.referrer = address(0);
    emit RemoveTeller(teller.position);
  }

  function removeTellerByZone()
    external
    onlyByZoneContract
  {
    _remove();
    // audit feedback
    // _removeComments();
  }

  function removeTeller()
    external
    onlyWhenInited
    updateState
    onlyWhenCallerIsZoneOwner
    onlyWhenHasTeller
  {
    _remove();
  }

  // NOTE: we could just require only last 5 bytes of a bytes12 geohash, since
  // the first 6 bytes will be the geohash of this zone. But by requiring the full geohash
  // we can mkae more sure the user is talking to the right zone
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
    external
    onlyWhenInited
    onlyWhenZoneEnabled
    updateState
    onlyWhenCallerIsZoneOwner
    // onlyWhenHasNoTeller
  {
    require(!isContract(_referrer), 'referrer cannot be a contract');
    require(_position.length == 12, "expected position to be 12 bytes");
    require(toBytes6(_position, 0) == zone.geohash(), "position is not inside this zone");
    require(geo.validGeohashChars(_position), "invalid position geohash characters");
    require(_refFee <= 333, 'referral fees should inferior to 33.3 %');
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
    teller.refFee = _refFee;
    teller.description = _description;
    emit AddTeller(_position);
  }

  function updateTeller(
    bytes calldata _position,
    uint8 _currencyId,
    bytes16 _messenger,
    int16 _sellRate,
    int16 _buyRate,
    bytes1 _settings,
    bytes32 _description
  )
    external
    onlyWhenInited
    onlyWhenZoneEnabled
    updateState
    onlyWhenCallerIsZoneOwner
    onlyWhenHasTeller // audit feedback
    {
      require(_position.length == 12, "expected position to be 12 bytes");
      require(toBytes6(_position, 0) == zone.geohash(), "position is not inside this zone");
      require(geo.validGeohashChars(_position), "invalid position geohash characters");
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
      teller.currencyId = _currencyId;
      teller.messenger = _messenger;
      teller.buyRate = _buyRate;
      teller.sellRate = _sellRate;
      teller.position = toBytes12(_position, 0);
      teller.settings = _settings;
      teller.description = _description;
      emit UpdateTeller(_position);
    }

  function addComment(bytes32 _commentHash)
    external
    onlyWhenInited
    onlyWhenZoneEnabled
    updateState
    onlyWhenZoneHasOwner
    onlyWhenCallerIsNotZoneOwner
    onlyWhenHasTeller
  {
    require(_commentHash != bytes32(0), "comment hash cannot be 0x0");
    // audit feedback
    commentsFree[teller.addr].push(_commentHash);
  }
}
