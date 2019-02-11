pragma solidity ^0.5.3;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../datetime/DateTime.sol";
import "../oracle/IExchangeRateOracle.sol";
import "../certifier/ICertifier.sol";
import "../map/IGeoRegistry.sol";
import "./IControl.sol";

contract Users is DateTime {
  // ------------------------------------------------
  //
  // Library init
  //
  // ------------------------------------------------

  using SafeMath for uint;

  // ------------------------------------------------
  //
  // Variables Public
  //
  // ------------------------------------------------

  IExchangeRateOracle public priceOracle;
  IGeoRegistry public geo;
  ICertifier public smsCertifier;
  ICertifier public kycCertifier;
  IControl public control;

  address public zoneFactoryAddress;

  mapping(address => uint) public volumeBuy;
  mapping(address => uint) public volumeSell;
  mapping(address => uint) public nbTrade;

  // per country, per user, per day, keep track of amount of eth sold (since we have max limits per country)
  //
  //      country           user               day               month             year      weiSold
  mapping(bytes2 => mapping(address => mapping(uint16 => mapping(uint16 => mapping(uint16 => uint256))))) ethSellsUserToday;

  // ------------------------------------------------
  //
  // Constructor
  //
  // ------------------------------------------------

  constructor(address _priceOracle, address _geo, address _smsCertifier, address _kycCertifier, address _control)
    public
  {
    priceOracle = IExchangeRateOracle(_priceOracle);
    geo = IGeoRegistry(_geo);
    smsCertifier = ICertifier(_smsCertifier);
    kycCertifier = ICertifier(_kycCertifier);
    control = IControl(_control);
  }

  // ------------------------------------------------
  //
  // Functions Setters
  //
  // ------------------------------------------------

  function setZoneFactory(address _zoneFactory)
    external
  {
    require(control.isCEO(msg.sender), "can only be called by CEO");
    zoneFactoryAddress = _zoneFactory;
  }

  function updateDailySold(bytes2 _countryCode, address _from, address _to, uint _amount)
    external
  {
    require(msg.sender == zoneFactoryAddress, "can only be called by zoneFactory");
    // if country code or user does not exist, we get back 0
    uint sellDailyLimitUsd = geo.countryTierDailyLimit(_countryCode, getUserTier(_from));
    uint sellDailyLimitEth = priceOracle.getWeiPriceOneUsd().mul(sellDailyLimitUsd);
    _DateTime memory dateNow = parseTimestamp(block.timestamp);
    uint newSoldTodayEth = ethSellsUserToday[_countryCode][_from][dateNow.day][dateNow.month][dateNow.year].add(_amount);
    require(newSoldTodayEth <= sellDailyLimitEth, "exceeded daily sell limit");
    ethSellsUserToday[_countryCode][_from][dateNow.day][dateNow.month][dateNow.year] = newSoldTodayEth;

    volumeBuy[_to] = volumeBuy[_to].add(_amount);
    volumeSell[_from] = volumeSell[_from].add(_amount);
    nbTrade[_from] += 1;
  }

  // ------------------------------------------------
  //
  // Functions Getters
  //
  // ------------------------------------------------

  function getUserTier(address _who)
    public
    view
    returns (uint foundTier)
  {
    foundTier = 0;
    if (kycCertifier.certified(_who)) foundTier = 2;
    else if (smsCertifier.certified(_who)) foundTier = 1;
  }

  function getDateInfo(uint timestamp)
    external
    pure
    returns (uint16, uint16, uint16)
  {
    _DateTime memory date = parseTimestamp(timestamp);
    return (date.day, date.month, date.year);
  }
}