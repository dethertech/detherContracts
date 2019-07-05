pragma solidity ^0.5.10;
pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../datetime/DateTime.sol";

import "../interfaces/IExchangeRateOracle.sol";
import "../interfaces/ICertifier.sol";
import "../interfaces/IGeoRegistry.sol";
import "../interfaces/ICertifierRegistry.sol";

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
  ICertifierRegistry public certifierRegistry;

  address public zoneFactoryAddress;
  bool public isInit = false;

  // ------------------------------------------------
  //
  // Constructor
  //
  // ------------------------------------------------

    constructor(address _priceOracle, address _geo, address _smsCertifier, address _kycCertifier, address _certifierRegistry)
    public
  {
    geo = IGeoRegistry(_geo);
    smsCertifier = ICertifier(_smsCertifier);
    kycCertifier = ICertifier(_kycCertifier);
    certifierRegistry = ICertifierRegistry(_certifierRegistry);
  }

  // ------------------------------------------------
  //
  // Functions Setters
  //
  // ------------------------------------------------

  function setZoneFactory(address _zoneFactory)
    external
  {
    require(isInit == false, 'cannot be called more than once');
    zoneFactoryAddress = _zoneFactory;
    isInit = true;
  }

  // ------------------------------------------------
  //
  // Functions Getters
  //
  // ------------------------------------------------

  function getCertifications(address _who)
    external view
    returns ( ICertifierRegistry.Certification[] memory)
    {
      return certifierRegistry.getCerts(_who);
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