pragma solidity ^0.4.18;

import './certifier/SmsCertifier.sol';
import './DetherAccessControl.sol';

/*
 * This contract aim to manage the generals value fo the contracts
 */

contract DetherSetup is DetherAccessControl  {

  bool public run = false;
  uint public licenceShop = 1;
  SmsCertifier public smsCertifier;
  mapping(bytes2 => bool) public openedCountryShop;

  modifier isSmsWhitelisted(address _user) {
    require(smsCertifier.isCertified(_user));
    _;
  }
  modifier isZoneShopOpen(bytes2 _country) {
    require(openedCountryShop[_country]);
    _;
  }
  function setCertifier (address _smsCertifier) onlyCEO {
    require(!run);
    smsCertifier = SmsCertifier(_smsCertifier);
    run = true;
  }
  function setLicenceShopPrice(uint price) onlyCEO {
    licenceShop = price;
  }
  function openZoneShop(bytes2 _country) onlyCMO {
    openedCountryShop[_country] = true;
  }
  function closeZoneShop(bytes2 _country) onlyCMO {
    openedCountryShop[_country] = false;
  }
}
