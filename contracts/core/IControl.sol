pragma solidity ^0.5.3;

contract IControl {
  function isCEO(address _who) external view returns (bool);
  function isCSO(address _who) external view returns (bool);
  function isCMO(address _who) external view returns (bool);
  function isCFO(address _who) external view returns (bool);
  function isTellerModerator(address _who) external view returns (bool);
  function isShopModerator(address _who) external view returns (bool);
  function paused() public returns (bool);
}