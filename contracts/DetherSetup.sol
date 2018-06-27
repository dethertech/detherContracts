pragma solidity ^0.4.21;

import './certifier/Certifier.sol';
import './DetherAccessControl.sol';
import './zepellin/SafeMath.sol';

/*
 * This contract aim to manage the generals value fo the contracts
 */

contract DetherSetup is DetherAccessControl  {

  bool public run1 = false;
  bool public run2 = false;
  // -Need to be whitelisted to be able to register in the contract as a shop or
  // teller, there is two level of identification.
  // -This identification method are now centralised and processed by dether, but
  // will be decentralised soon
  Certifier public smsCertifier;
  Certifier public kycCertifier;
  // Zone need to be open by the CMO before accepting registration
  // The bytes2 parameter wait for a country ID (ex: FR (0x4652 in hex) for france cf:README)
  mapping(bytes2 => bool) public openedCountryShop;
  mapping(bytes2 => bool) public openedCountryTeller;
  // For registering in a zone you need to stake DTH
  // The price can differ by country
  // Uts now a fixed price by the CMO but the price will adjusted automatically
  // regarding different factor in the futur smart contract
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
    require(openedCountryTeller[_country]);
    _;
  }

  function isTier1(address _user) public view returns(bool) {
    return smsCertifier.certified(_user);
  }
  
  function isTier2(address _user) public view returns(bool) {
    return kycCertifier.certified(_user);
  }

  /**
   * INIT
   */
  function setSmsCertifier (address _smsCertifier) external onlyCEO {
    require(!run1);
    smsCertifier = Certifier(_smsCertifier);
    run1 = true;
  }
  /**
   * CORE FUNCTION
   */
  function setKycCertifier (address _kycCertifier) external onlyCEO {
    require(!run2);
    kycCertifier = Certifier(_kycCertifier);
    run2 = true;
  }
  function setLicenceShopPrice(bytes2 country, uint price) external onlyCMO {
    licenceShop[country] = price;
  }
  function setLicenceTellerPrice(bytes2 country, uint price) external onlyCMO {
    licenceTeller[country] = price;
  }
  function openZoneShop(bytes2 _country) external onlyCMO {
    openedCountryShop[_country] = true;
  }
  function closeZoneShop(bytes2 _country) external onlyCMO {
    openedCountryShop[_country] = false;
  }
  function openZoneTeller(bytes2 _country) external onlyCMO {
    openedCountryTeller[_country] = true;
  }
  function closeZoneTeller(bytes2 _country) external onlyCMO {
    openedCountryTeller[_country] = false;
  }
}
