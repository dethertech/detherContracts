pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/token/ERC20/DetailedERC20.sol";
import "zeppelin-solidity/contracts/token/ERC20/MintableToken.sol";

import './ERC223BasicToken.sol';


/// @title ExampleToken that uses MintableToken, DetailedERC20 and ERC223BasicToken.
contract ExampleToken is DetailedERC20, MintableToken, ERC223BasicToken {
    string constant NAME = "Example";
    string constant SYMBOL = "EXM";
    uint8 constant DECIMALS = 18;

    /// @dev Constructor that sets the details of the ERC20 token.
    function ExampleToken()
        DetailedERC20(NAME, SYMBOL, DECIMALS)
        public
    {}
}
