pragma solidity ^0.5.3;

contract IControl {
    function cmo() view public returns(address);
    function cfo() view public returns(address);
    function paused() view public returns(bool);
    function shopModerators(address) view public returns(bool);
    function cso() view public returns(address);
    function ceo() view public returns(address);
    function tellerModerators(address) view public returns(bool);
    function setCEO(address _who) external;
    function setCSO(address _who) external;
    function setCMO(address _who) external;
    function setCFO(address _who) external;
    function setShopModerator(address _who) external;
    function removeShopModerator(address _who) external;
    function setTellerModerator(address _who) external;
    function removeTellerModerator(address _who) external;
    function pause() external;
    function unpause() external;
    function isCEO(address _who) view external returns(bool);
    function isCSO(address _who) view external returns(bool);
    function isCMO(address _who) view external returns(bool);
    function isCFO(address _who) view external returns(bool);
    function isTellerModerator(address _who) view external returns(bool);
    function isShopModerator(address _who) view external returns(bool);
}
