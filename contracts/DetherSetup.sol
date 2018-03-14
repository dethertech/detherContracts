pragma solidity ^0.4.18;

import './certifier/Certifier.sol';
import './DetherAccessControl.sol';

/*
 * This contract aim to manage the generals value fo the contracts
 */

contract DetherSetup is DetherAccessControl  {

  bool public run = false;
  /* uint public licenceShop = 1;
  uint public licenceTeller = 1; */
  Certifier public smsCertifier;
  Certifier public kycCertifier;
  mapping(bytes2 => bool) public openedCountryShop;
  mapping(bytes2 => bool) public openedCountryTeller;
  mapping(bytes2 => uint) public licenceShop;
  mapping(bytes2 => uint) public licenceTeller;

  modifier tier1(address _user) {
    require(smsCertifier.certified(_user));
    _;
  }
  modifier tier2(address _user) {
    require(kycCertifier.certified(_user));
    _;
  }
  modifier isZoneShopOpen(bytes2 _country) {
    require(openedCountryShop[_country]);
    _;
  }
  modifier isZoneTellerOpen(bytes2 _country) {
    require(openedCountryShop[_country]);
    _;
  }

  function setSmsCertifier (address _smsCertifier) onlyCEO {
    require(!run);
    smsCertifier = Certifier(_smsCertifier);
    run = true;
  }
  function setKycCertifier (address _kycCertifier) onlyCEO {
    require(!run);
    kycCertifier = Certifier(_kycCertifier);
    run = true;
  }
  function setLicenceShopPrice(bytes2 country, uint price) onlyCEO {
    licenceShop[country] = price;
  }
  function setLicenceTellerPrice(bytes2 country, uint price) onlyCEO {
    licenceTeller[country] = price;
  }
  function openZoneShop(bytes2 _country) onlyCMO {
    openedCountryShop[_country] = true;
  }
  function closeZoneShop(bytes2 _country) onlyCMO {
    openedCountryShop[_country] = false;
  }
  function openZoneTeller(bytes2 _country) onlyCMO {
    openedCountryTeller[_country] = true;
  }
  function closeZoneTeller(bytes2 _country) onlyCMO {
    openedCountryTeller[_country] = false;
  }

  /*
   * getter
   */

}
