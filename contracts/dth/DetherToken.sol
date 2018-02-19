pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/token/ERC20/DetailedERC20.sol";
import "zeppelin-solidity/contracts/token/ERC20/MintableToken.sol";

import './tokenfoundry/ERC223BasicToken.sol';


/**
  * @title Token for the Dether project.
  */
contract DetherToken is DetailedERC20, MintableToken, ERC223BasicToken {
    string constant NAME = "Dether";
    string constant SYMBOL = "DTH";
    uint8 constant DECIMALS = 18;

    /**
      *@dev Constructor that set Detailed of the ERC20 token.
      */
    function DetherToken()
        DetailedERC20(NAME, SYMBOL, DECIMALS)
        public
    {}
}
