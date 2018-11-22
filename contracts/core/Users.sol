pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "ethereum-datetime/contracts/DateTime.sol";

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

  uint public constant LOYALTY_DECREASE_PERCENTAGE = 21; // 21%

  mapping(address => mapping(address => uint)) internal pairSellsLoyaltyPerc;

  mapping(address => uint) public volumeBuy;
  mapping(address => uint) public volumeSell;
  mapping(address => uint) public nbTrade;
  mapping(address => uint) public loyaltyPoints;

  // store a mapping with per day/month/year a uint256 containing the wei sold amount on that date
  //
  //      user               day               month             year      weiSold
  mapping(address => mapping(uint16 => mapping(uint16 => mapping(uint16 => uint256)))) ethSellsUserToday;

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
  // Modifiers
  //
  // ------------------------------------------------

  // ------------------------------------------------
  //
  // Functions Setters
  //
  // ------------------------------------------------

  function updateDailySold(bytes2 _countryCode, address _from, uint _amount)
    public
  {
    // if country code or user does not exist, we get back 0
    uint sellDailyLimitUsd = geo.countryTierDailyLimit(_countryCode, getUserTier(_from));
    uint sellDailyLimitEth = priceOracle.getWeiPriceOneUsd().mul(sellDailyLimitUsd);
    _DateTime memory dateNow = parseTimestamp(block.timestamp);
    uint newSoldTodayEth = ethSellsUserToday[_from][dateNow.day][dateNow.month][dateNow.year].add(_amount);
    require(newSoldTodayEth <= sellDailyLimitEth, "exceeded daily sell limit");
    ethSellsUserToday[_from][dateNow.day][dateNow.month][dateNow.year] = newSoldTodayEth;
  }

  function updateLoyaltyPoints(address _from, address _to, uint _amount)
    public
  {
    // _from has to be whitelisted
    if (getUserTier(_to) > 0) { // 1 or 2, doesn't matter
      uint currentSellerLoyaltyPointsPerc = pairSellsLoyaltyPerc[_from][_to];

      if (currentSellerLoyaltyPointsPerc == 0) {
        // this is the first sell between seller and buyer, set to 100%
        pairSellsLoyaltyPerc[_from][_to] = 10000;
        currentSellerLoyaltyPointsPerc = 10000;
      }

      // add percentage of loyaltyPoints of this sell to seller's loyaltyPoints
      loyaltyPoints[_from] = loyaltyPoints[_from].add(_amount.mul(currentSellerLoyaltyPointsPerc).div(10000));

      // update the loyaltyPoints percentage of the seller, there will be a 21% decrease with every sell to the same buyer (100 - 21 = 79)
      pairSellsLoyaltyPerc[_from][_to] = currentSellerLoyaltyPointsPerc.mul(100 - LOYALTY_DECREASE_PERCENTAGE).div(100);

      volumeBuy[_to] = volumeBuy[_to].add(_amount);
      volumeSell[_from] = volumeSell[_from].add(_amount);
      nbTrade[_from] += 1;
    }
  }

  // ------------------------------------------------
  //
  // Functions Getters
  //
  // ------------------------------------------------

  function getUserTier(address _user)
    public
    view
    returns (uint foundTier)
  {
    foundTier = 0;
    if (kycCertifier.certified(_user)) foundTier = 2;
    else if (smsCertifier.certified(_user)) foundTier = 1;
  }
}