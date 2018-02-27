pragma solidity ^0.4.18;

import './dth/DetherToken.sol';
import './certifier/SmsCertifier.sol';
import './DthRegistry.sol';
import './DetherAccessControl.sol';

/*
 * This contract aim to manage the generals value fo the contracts
 */

// add zone management

contract DetherSetup is DetherAccessControl  {

  bool public run = false;
  uint public licenceShop = 1;
  SmsCertifier public smsCertifier;
  modifier isSmsWhitelisted(address _user) {
    require(smsCertifier.isCertified(_user));
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

}
