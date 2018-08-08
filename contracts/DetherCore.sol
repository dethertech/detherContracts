pragma solidity ^0.4.23;

import './DetherSetup.sol';
import './dth/tokenfoundry/ERC223ReceivingContract.sol';
import './zepellin/SafeMath.sol';
import './dth/tokenfoundry/ERC223Basic.sol';
import './DetherAccessControl.sol';
import 'bytes/BytesLib.sol';

contract ExchangeRateOracle {
  function getWeiPriceOneUsd() external view returns(uint256);
}

// only interface to save gas
contract DetherBank {
  function withdrawDthTeller(address _receiver) external;
  function withdrawDthShop(address _receiver) external;
  function withdrawDthShopAdmin(address _from, address _receiver) external;
  function addTokenShop(address _from, uint _value) external;
  function addTokenTeller(address _from, uint _value) external;
  function addEthTeller(address _from, uint _value) external payable returns (bool);
  function withdrawEth(address _from, address _to, uint _amount) external;
  function refundEth(address _from) external;
  function getDthTeller(address _user) public view returns (uint);
  function getDthShop(address _user) public view returns (uint);
  function getEthBalTeller(address _user) public view returns (uint);
  function getWeiSoldToday(address _user) public view returns (uint256 weiSoldToday);
  function transferOwnership(address newOwner) public;
}

contract DetherCore is DetherSetup, ERC223ReceivingContract, SafeMath {
  using BytesLib for bytes;

  /**
  * Event
  */
  // when a Teller is registered
  event RegisterTeller(address indexed tellerAddress);
  // when a teller add funds for trade
  event AddFunds(address indexed tellerAddress, uint amount);
  // when a teller is deleted
  event DeleteTeller(address indexed tellerAddress);
  // when teller update
  event UpdateTeller(address indexed tellerAddress);
  // when a teller send to a buyer
  event Sent(address indexed _from, address indexed _to, uint amount);
  // when a shop register
  event RegisterShop(address shopAddress);
  // when a shop delete
  event DeleteShop(address shopAddress);
  // when a moderator delete a shop
  event DeleteShopModerator(address indexed moderator, address shopAddress);
  // when a moderator delete a teller
  event DeleteTellerModerator(address indexed moderator, address tellerAddress);

  /**
   * Modifier
   */
  // if teller has staked enough dth to
  modifier tellerHasStaked(uint amount) {
    require(bank.getDthTeller(msg.sender) >= amount);
    _;
  }
  // if shop has staked enough dth to
  modifier shopHasStaked(uint amount) {
    require(bank.getDthShop(msg.sender) >= amount);
    _;
  }

  /*
   * External contract
   */
  // DTH contract
  ERC223Basic public dth;
  // bank contract where are stored ETH and DTH
  DetherBank public bank;

  ExchangeRateOracle public priceOracle;

  // teller struct
  struct Teller {
    int32 lat;            // Latitude
    int32 lng;            // Longitude
    bytes2 countryId;     // countryID (in hexa), ISO ALPHA 2 https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
    bytes16 postalCode;   // postalCode if present, in Hexa https://en.wikipedia.org/wiki/List_of_postal_codes

    int8 currencyId;      // 1 - 100 , cf README
    bytes16 messenger;    // telegrame nickname
    int8 avatarId;        // 1 - 100 , regarding the front-end app you use
    int16 rates;          // margin of tellers , -999 - +9999 , corresponding to -99,9% x 10  , 999,9% x 10
    bool buyer;           // appear as a buyer as well on the map
    int16 buyRates;         // margin of tellers of

    uint zoneIndex;       // index of the zone mapping
    uint generalIndex;    // index of general mapping
    bool online;          // switch online/offline, if the tellers want to be inactive without deleting his point
  }

  mapping(address => mapping(address => uint)) internal pairSellsLoyaltyPerc;
  //      from               to         percentage of loyalty points from gets

  /*
   * Reputation field V0.1
   * Reputation is based on volume sell, volume buy, and number of transaction
   */
  mapping(address => uint) volumeBuy;
  mapping(address => uint) volumeSell;
  mapping(address => uint) nbTrade;
  mapping(address => uint256) loyaltyPoints;

  // general mapping of teller
  mapping(address => Teller) teller;
  // mappoing of teller by COUNTRYCODE => POSTALCODE
  mapping(bytes2 => mapping(bytes16 => address[])) tellerInZone;
  // teller array currently registered
  address[] public tellerIndex; // unordered list of teller register on it
  bool isStarted = false;
  // shop struct
  struct Shop {
    int32 lat;            // latitude
    int32 lng;            // longitude
    bytes2 countryId;     // countryID (in hexa char), ISO ALPHA 2 https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
    bytes16 postalCode;   // postalCode if present (in hexa char), in Hexa https://en.wikipedia.org/wiki/List_of_postal_codes
    bytes16 cat;          // Category of the shop (in hex char), will be used later for search engine and auction by zone
    bytes16 name;         // name of the shop (in hex char)
    bytes32 description;  // description of the shop
    bytes16 opening;      // opening hours, cf README for the format

    uint zoneIndex;       // index of the zone mapping
    uint generalIndex;    // index of general mapping
    bool detherShop;      // bool if shop is registered by dether as business partnership (still required DTH)
  }

  // general mapping of shop
  mapping(address => Shop) shop;
  // mapping of teller by COUNTRYCODE => POSTALCODE
  mapping(bytes2 => mapping(bytes16 => address[])) shopInZone;
  // shop array currently registered
  address[] public shopIndex; // unordered list of shop register on it

  /*
   * Instanciation
   */
  function DetherCore() {
   ceoAddress = msg.sender;
  }
  function initContract (address _dth, address _bank) external onlyCEO {
    require(!isStarted);
    dth = ERC223Basic(_dth);
    bank = DetherBank(_bank);
    isStarted = true;
  }

  function setPriceOracle (address _priceOracle) external onlyCFO {
    priceOracle = ExchangeRateOracle(_priceOracle);
  }

  /**
   * Core fonction
   */

  /**
   * @dev Standard ERC223 function that will handle incoming token transfers.
   * This is the main function to register SHOP or TELLER, its calling when you
   * send token to the DTH contract and by passing data as bytes on the third
   * parameter.
   * Its not supposed to be use on its own but will only handle incoming DTH
   * transaction.
   * The _data will wait for
   * [1st byte] 1 (0x31) for shop OR 2 (0x32) for teller
   * FOR SHOP AND TELLER:
   * 2sd to 5th bytes lat
   * 6th to 9th bytes lng
   * ...
   * Modifier tier1: Check if address is whitelisted with the sms verification
   */
  function tokenFallback(address _from, uint _value, bytes _data) whenNotPaused tier1(_from ) {
    // require than the token fallback is triggered from the dth token contract
    require(msg.sender == address(dth));
    // check first byte to know if its shop or teller registration
    // 1 / 0x31 = shop // 2 / 0x32 = teller
    bytes1 _func = _data.toBytes1(0);
    int32 posLat = _data.toBytes1(1) == bytes1(0x01) ? int32(_data.toBytes4(2)) * -1 : int32(_data.toBytes4(2));
    int32 posLng = _data.toBytes1(6) == bytes1(0x01) ? int32(_data.toBytes4(7)) * -1 : int32(_data.toBytes4(7));
    if (_func == bytes1(0x31)) { // shop registration // GAS USED 311000
      // require staked greater than licence price
      require(_value >= licenceShop[_data.toBytes2(11)]);
      // require its not already shop
      require(!isShop(_from));
      // require zone is open
      require(openedCountryShop[_data.toBytes2(11)]);

      shop[_from].lat = posLat;
      shop[_from].lng = posLng;
      shop[_from].countryId = _data.toBytes2(11);
      shop[_from].postalCode = _data.toBytes16(13);
      shop[_from].cat = _data.toBytes16(29);
      shop[_from].name = _data.toBytes16(45);
      shop[_from].description = _data.toBytes32(61);
      shop[_from].opening = _data.toBytes16(93);
      shop[_from].generalIndex = shopIndex.push(_from) - 1;
      shop[_from].zoneIndex = shopInZone[_data.toBytes2(11)][_data.toBytes16(13)].push(_from) - 1;
      emit RegisterShop(_from);
      bank.addTokenShop(_from,_value);
      dth.transfer(address(bank), _value);
    } else if (_func == bytes1(0x32)) { // teller registration -- GAS USED 310099
      // require staked greater than licence price
      require(_value >= licenceTeller[_data.toBytes2(11)]);
      // require is not already a teller
      require(!isTeller(_from));
      // require zone is open
      require(openedCountryTeller[_data.toBytes2(11)]);

      teller[_from].lat = posLat;
      teller[_from].lng = posLng;
      teller[_from].countryId = _data.toBytes2(11);
      teller[_from].postalCode = _data.toBytes16(13);
      teller[_from].avatarId = int8(_data.toBytes1(29));
      teller[_from].currencyId = int8(_data.toBytes1(30));
      teller[_from].messenger = _data.toBytes16(31);
      teller[_from].rates = int16(_data.toBytes2(47));
      teller[_from].buyer = _data.toBytes1(49) == bytes1(0x01) ? true : false;
      teller[_from].buyRates = int16(_data.toBytes2(50));
      teller[_from].generalIndex = tellerIndex.push(_from) - 1;
      teller[_from].zoneIndex = tellerInZone[_data.toBytes2(11)][_data.toBytes16(13)].push(_from) - 1;
      teller[_from].online = true;
      emit RegisterTeller(_from);
      bank.addTokenTeller(_from, _value);
      dth.transfer(address(bank), _value);
    } else if (_func == bytes1(0x33)) {  // shop bulk registration
      // We need to have the possibility to register in bulk some shop
      // For big retailer company willing to be listed on dether, we need to have a way to add
      // all their shop from one address
      // This functionnality will become available for anyone willing to list multiple shop
      // in the futures contract

      // Only the CSO should be able to register shop in bulk
      require(_from == csoAddress);
      // Each shop still need his own staking
      require(_value >= licenceShop[_data.toBytes2(11)]);
      // require the addresses not already registered
      require(!isShop(address(_data.toAddress(109))));
      // require zone is open
      require(openedCountryShop[_data.toBytes2(11)]);
      address newShopAddress = _data.toAddress(109);
      shop[newShopAddress].lat = posLat;
      shop[newShopAddress].lng = posLng;
      shop[newShopAddress].countryId = _data.toBytes2(11);
      shop[newShopAddress].postalCode = _data.toBytes16(13);
      shop[newShopAddress].cat = _data.toBytes16(29);
      shop[newShopAddress].name = _data.toBytes16(45);
      shop[newShopAddress].description = _data.toBytes32(61);
      shop[newShopAddress].opening = _data.toBytes16(93);
      shop[newShopAddress].generalIndex = shopIndex.push(newShopAddress) - 1;
      shop[newShopAddress].zoneIndex = shopInZone[_data.toBytes2(11)][_data.toBytes16(13)].push(newShopAddress) - 1;
      shop[newShopAddress].detherShop = true;
      emit RegisterShop(newShopAddress);
      bank.addTokenShop(newShopAddress, _value);
      dth.transfer(address(bank), _value);
    }
  }

  /**
   * a teller can update his profile
   * If a teller want to change his location, he would need to delete and recreate
   * a new point
   */
  function updateTeller(
    int8 currencyId,
    bytes16 messenger,
    int8 avatarId,
    int16 rates,
    bool online
   ) public payable {
    require(isTeller(msg.sender));
    if (currencyId != teller[msg.sender].currencyId)
    teller[msg.sender].currencyId = currencyId;
    if (teller[msg.sender].messenger != messenger)
     teller[msg.sender].messenger = messenger;
    if (teller[msg.sender].avatarId != avatarId)
     teller[msg.sender].avatarId = avatarId;
    if (teller[msg.sender].rates != rates)
     teller[msg.sender].rates = rates;
    if (teller[msg.sender].online != online)
      teller[msg.sender].online = online;
    if (msg.value > 0) {
      bank.addEthTeller.value(msg.value)(msg.sender, msg.value);
    }
    emit UpdateTeller(msg.sender);
  }

  // mapping for limiting the sell amount
  //      tier             countryId usdDailyLimit
  mapping(uint => mapping (bytes2 => uint)) limitTier;

  function setSellDailyLimit(uint _tier, bytes2 _countryId, uint256 _limitUsd) public onlyCFO {
    limitTier[_tier][_countryId] = _limitUsd;
  }
  function getSellDailyLimit(uint _tier, bytes2 _countryId) public view returns(uint256 limitUsd) {
    limitUsd = limitTier[_tier][_countryId];
  }

  modifier doesNotExceedDailySellLimit(address _teller, uint256 _weiSellAmount) {
    // limits are set per country
    bytes2 countryId = teller[_teller].countryId;

    // user is always tier1, and could be tier2
    uint256 usdDailyLimit = getSellDailyLimit(isTier2(_teller) ? 2 : 1, countryId);

    // weiPriceOneUsd is set by the oracle (which runs every day at midnight)
    uint256 weiDailyLimit = SafeMath.mul(priceOracle.getWeiPriceOneUsd(), usdDailyLimit);

    // with each sell we update wei sold today for that user inside the Bank contract
    uint256 weiSoldToday = bank.getWeiSoldToday(_teller);

    uint256 newWeiSoldToday = SafeMath.add(weiSoldToday, _weiSellAmount);

    // we may not exceed the daily wei limit with this sell
    require(newWeiSoldToday <= weiDailyLimit);
    _;
  }

  function getPairSellLoyaltyPerc(address _from, address _to) public view returns(uint256) {
    return pairSellsLoyaltyPerc[_from][_to];
  }

  function getLoyaltyPoints(address who) public view returns (uint256) {
    return loyaltyPoints[who];
  }

  /**
   * SellEth
   * average gas cost: 123173
   * @param _to -> the address for the receiver
   * @param _amount -> the amount to send
   */
  function sellEth(address _to, uint _amount)
    whenNotPaused
    doesNotExceedDailySellLimit(msg.sender, _amount)
    external
  {
    require(isTeller(msg.sender));
    require(_to != msg.sender);
    // send eth to the receiver from the bank contract
    // this will also update eth amount sold 'today' by msg.sender
    bank.withdrawEth(msg.sender, _to, _amount);

    // increase reput for the buyer and the seller Only if the buyer is also whitelisted,
    // It's a way to incentive user to trade on the system
    if (smsCertifier.certified(_to)) {
      uint currentSellerLoyaltyPointsPerc = pairSellsLoyaltyPerc[msg.sender][_to];
      if (currentSellerLoyaltyPointsPerc == 0) {
        // this is the first sell between seller and buyer, set to 100%
        pairSellsLoyaltyPerc[msg.sender][_to] = 10000;
        currentSellerLoyaltyPointsPerc = 10000;
      }

      // add percentage of loyaltyPoints of this sell to seller's loyaltyPoints
      loyaltyPoints[msg.sender] = SafeMath.add(loyaltyPoints[msg.sender], SafeMath.mul(_amount, currentSellerLoyaltyPointsPerc) / 10000);

      // update the loyaltyPoints percentage of the seller, there will be a 21% decrease with every sell to the same buyer (100 - 21 = 79)
      pairSellsLoyaltyPerc[msg.sender][_to] = SafeMath.mul(currentSellerLoyaltyPointsPerc, 79) / 100;

      volumeBuy[_to] = SafeMath.add(volumeBuy[_to], _amount);
      volumeSell[msg.sender] = SafeMath.add(volumeSell[msg.sender], _amount);
      nbTrade[msg.sender] += 1;
    }
    emit Sent(msg.sender, _to, _amount);
  }

  /**
   * switchStatus
   * Turn status teller on/off
   */
  function switchStatus(bool _status) external {
    if (teller[msg.sender].online != _status)
     teller[msg.sender].online = _status;
  }

  /**
   * addFunds
   * teller can add more funds on his sellpoint
   */
  function addFunds() external payable {
    require(isTeller(msg.sender));
    require(bank.addEthTeller.value(msg.value)(msg.sender, msg.value));
    emit AddFunds(msg.sender, msg.value);
  }

  // gas used 67841
  // a teller can delete a sellpoint
  function deleteTeller() external {
    require(isTeller(msg.sender));
    uint rowToDelete1 = teller[msg.sender].zoneIndex;
    address keyToMove1 = tellerInZone[teller[msg.sender].countryId][teller[msg.sender].postalCode][tellerInZone[teller[msg.sender].countryId][teller[msg.sender].postalCode].length - 1];
    tellerInZone[teller[msg.sender].countryId][teller[msg.sender].postalCode][rowToDelete1] = keyToMove1;
    teller[keyToMove1].zoneIndex = rowToDelete1;
    tellerInZone[teller[msg.sender].countryId][teller[msg.sender].postalCode].length--;

    uint rowToDelete2 = teller[msg.sender].generalIndex;
    address keyToMove2 = tellerIndex[tellerIndex.length - 1];
    tellerIndex[rowToDelete2] = keyToMove2;
    teller[keyToMove2].generalIndex = rowToDelete2;
    tellerIndex.length--;
    delete teller[msg.sender];
    bank.withdrawDthTeller(msg.sender);
    bank.refundEth(msg.sender);
    emit DeleteTeller(msg.sender);
  }

  // gas used 67841
  // A moderator can delete a sellpoint
  function deleteTellerMods(address _toDelete) isTellerModerator(msg.sender) external {
    require(isTeller(_toDelete));
    uint rowToDelete1 = teller[_toDelete].zoneIndex;
    address keyToMove1 = tellerInZone[teller[_toDelete].countryId][teller[_toDelete].postalCode][tellerInZone[teller[_toDelete].countryId][teller[_toDelete].postalCode].length - 1];
    tellerInZone[teller[_toDelete].countryId][teller[_toDelete].postalCode][rowToDelete1] = keyToMove1;
    teller[keyToMove1].zoneIndex = rowToDelete1;
    tellerInZone[teller[_toDelete].countryId][teller[_toDelete].postalCode].length--;

    uint rowToDelete2 = teller[_toDelete].generalIndex;
    address keyToMove2 = tellerIndex[tellerIndex.length - 1];
    tellerIndex[rowToDelete2] = keyToMove2;
    teller[keyToMove2].generalIndex = rowToDelete2;
    tellerIndex.length--;
    delete teller[_toDelete];
    bank.withdrawDthTeller(_toDelete);
    bank.refundEth(_toDelete);
    emit DeleteTellerModerator(msg.sender, _toDelete);
  }

  // gas used 67841
  // A shop owner can delete his point.
  function deleteShop() external {
    require(isShop(msg.sender));
    uint rowToDelete1 = shop[msg.sender].zoneIndex;
    address keyToMove1 = shopInZone[shop[msg.sender].countryId][shop[msg.sender].postalCode][shopInZone[shop[msg.sender].countryId][shop[msg.sender].postalCode].length - 1];
    shopInZone[shop[msg.sender].countryId][shop[msg.sender].postalCode][rowToDelete1] = keyToMove1;
    shop[keyToMove1].zoneIndex = rowToDelete1;
    shopInZone[shop[msg.sender].countryId][shop[msg.sender].postalCode].length--;

    uint rowToDelete2 = shop[msg.sender].generalIndex;
    address keyToMove2 = shopIndex[shopIndex.length - 1];
    shopIndex[rowToDelete2] = keyToMove2;
    shop[keyToMove2].generalIndex = rowToDelete2;
    shopIndex.length--;
    delete shop[msg.sender];
    bank.withdrawDthShop(msg.sender);
    emit DeleteShop(msg.sender);
  }

  // gas used 67841
  // Moderator can delete a shop point
  function deleteShopMods(address _toDelete) isShopModerator(msg.sender) external {
    uint rowToDelete1 = shop[_toDelete].zoneIndex;
    address keyToMove1 = shopInZone[shop[_toDelete].countryId][shop[_toDelete].postalCode][shopInZone[shop[_toDelete].countryId][shop[_toDelete].postalCode].length - 1];
    shopInZone[shop[_toDelete].countryId][shop[_toDelete].postalCode][rowToDelete1] = keyToMove1;
    shop[keyToMove1].zoneIndex = rowToDelete1;
    shopInZone[shop[_toDelete].countryId][shop[_toDelete].postalCode].length--;

    uint rowToDelete2 = shop[_toDelete].generalIndex;
    address keyToMove2 = shopIndex[shopIndex.length - 1];
    shopIndex[rowToDelete2] = keyToMove2;
    shop[keyToMove2].generalIndex = rowToDelete2;
    shopIndex.length--;
    if (!shop[_toDelete].detherShop)
      bank.withdrawDthShop(_toDelete);
    else
      bank.withdrawDthShopAdmin(_toDelete, csoAddress);
    delete shop[_toDelete];
    emit DeleteShopModerator(msg.sender, _toDelete);
  }

  /**
   *  GETTER
   */

  // get teller
  // return teller info
  function getTeller(address _teller) public view returns (
    int32 lat,
    int32 lng,
    bytes2 countryId,
    bytes16 postalCode,
    int8 currencyId,
    bytes16 messenger,
    int8 avatarId,
    int16 rates,
    uint balance,
    bool online,
    bool buyer,
    int16 buyRates
    ) {
    Teller storage theTeller = teller[_teller];
    lat = theTeller.lat;
    lng = theTeller.lng;
    countryId = theTeller.countryId;
    postalCode = theTeller.postalCode;
    currencyId = theTeller.currencyId;
    messenger = theTeller.messenger;
    avatarId = theTeller.avatarId;
    rates = theTeller.rates;
    online = theTeller.online;
    buyer = theTeller.buyer;
    buyRates = theTeller.buyRates;
    balance = bank.getEthBalTeller(_teller);
  }

  /*
   * Shop ----------------------------------
   * return Shop value
   */
  function getShop(address _shop) public view returns (
   int32 lat,
   int32 lng,
   bytes2 countryId,
   bytes16 postalCode,
   bytes16 cat,
   bytes16 name,
   bytes32 description,
   bytes16 opening
   ) {
    Shop storage theShop = shop[_shop];
    lat = theShop.lat;
    lng = theShop.lng;
    countryId = theShop.countryId;
    postalCode = theShop.postalCode;
    cat = theShop.cat;
    name = theShop.name;
    description = theShop.description;
    opening = theShop.opening;
   }

   // get reput
   // return reputation data from teller
  function getReput(address _teller) public view returns (
   uint buyVolume,
   uint sellVolume,
   uint numTrade,
   uint256 loyaltyPoints_
   ) {
     buyVolume = volumeBuy[_teller];
     sellVolume = volumeSell[_teller];
     numTrade = nbTrade[_teller];
     loyaltyPoints_ = loyaltyPoints[_teller];
  }
  // return balance of teller put in escrow
  function getTellerBalance(address _teller) public view returns (uint) {
    return bank.getEthBalTeller(_teller);
  }

  // return an array of address of all zone present on a zone
  // zone is a mapping COUNTRY => POSTALCODE
  function getZoneShop(bytes2 _country, bytes16 _postalcode) public view returns (address[]) {
     return shopInZone[_country][_postalcode];
  }

  // return array of address of all shop
  function getAllShops() public view returns (address[]) {
   return shopIndex;
  }

  function isShop(address _shop) public view returns (bool ){
   return (shop[_shop].countryId != bytes2(0x0));
  }

  // return an array of address of all teller present on a zone
  // zone is a mapping COUNTRY => POSTALCODE
  function getZoneTeller(bytes2 _country, bytes16 _postalcode) public view returns (address[]) {
     return tellerInZone[_country][_postalcode];
  }

  // return array of address of all teller
  function getAllTellers() public view returns (address[]) {
   return tellerIndex;
  }

  // return if teller or not
  function isTeller(address _teller) public view returns (bool ){
    return (teller[_teller].countryId != bytes2(0x0));
  }

  /*
   * misc
   */
   // return info about how much DTH the shop has staked
  function getStakedShop(address _shop) public view returns (uint) {
    return bank.getDthShop(_shop);
  }
  // return info about how much DTH the teller has staked
  function getStakedTeller(address _teller) public view returns (uint) {
    return bank.getDthTeller(_teller);
  }
  // give ownership to the bank contract
  function transferBankOwnership(address _newbankowner) external onlyCEO whenPaused {
    bank.transferOwnership(_newbankowner);
  }
}
