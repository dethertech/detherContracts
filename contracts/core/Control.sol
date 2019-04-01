pragma solidity ^0.5.5;

contract Control {
  // ------------------------------------------------
  //
  // Variables Public
  //
  // ------------------------------------------------

  bool public paused;

  address public ceo;
  address public cso;
  address public cmo;
  address public cfo;

  // TODO: centralised moderator, would become decentralised
  mapping (address => bool) public shopModerators;
  mapping (address => bool) public tellerModerators;

  // ------------------------------------------------
  //
  // Modifiers
  //
  // ------------------------------------------------


  /// @dev Access modifier for CEO-only functionality
  modifier onlyCEO() {
      require(msg.sender == ceo, "caller needs to be ceo");
      _;
  }

  /// @dev Access modifier for CMO-only functionality
  modifier onlyCMO() {
      require(msg.sender == cmo, "caller needs to be cmo");
      _;
  }

  modifier onlyCSO() {
      require(msg.sender == cso, "caller needs to be cso");
      _;
  }

  modifier onlyCFO() {
      require(msg.sender == cfo, "caller needs to be cfo");
      _;
  }

  modifier isValidAddress(address _addr) {
    require(_addr != address(0), "address cannot be 0x0");
    _;
  }

  modifier whenPaused() {
    require(paused == true, "can only be called when paused");
    _;
  }


  // ------------------------------------------------
  //
  // Constructor
  //
  // ------------------------------------------------

  constructor()
    public
  {
    paused = false;
    ceo = msg.sender;
    cso = msg.sender;
    cmo = msg.sender;
    cfo = msg.sender;
  }

  // ------------------------------------------------
  //
  // Functions Setters Public
  //
  // ------------------------------------------------

  function setCEO(address _who) external onlyCEO isValidAddress(_who) { ceo = _who; }
  function setCSO(address _who) external onlyCEO isValidAddress(_who) { cso = _who; }
  function setCMO(address _who) external onlyCEO isValidAddress(_who) { cmo = _who; }
  function setCFO(address _who) external onlyCEO isValidAddress(_who) { cfo = _who; }
  function setShopModerator(address _who) external onlyCEO isValidAddress(_who) { shopModerators[_who] = true; }
  function removeShopModerator(address _who) external onlyCEO isValidAddress(_who) { shopModerators[_who] = false; }
  function setTellerModerator(address _who) external onlyCEO isValidAddress(_who) { tellerModerators[_who] = true; }
  function removeTellerModerator(address _who) external onlyCEO isValidAddress(_who) { tellerModerators[_who] = false; }
  // function pause() external onlyCEO whenNotPaused { paused = true; }
  // function unpause() external onlyCEO whenPaused { paused = false; }

  // ------------------------------------------------
  //
  // Functions Getters
  //
  // ------------------------------------------------

  function isCEO(address _who) external view returns (bool) { return ceo == _who; }
  function isCSO(address _who) external view returns (bool) { return cso == _who; }
  function isCMO(address _who) external view returns (bool) { return cmo == _who; }
  function isCFO(address _who) external view returns (bool) { return cfo == _who; }
  function isTellerModerator(address _who) external view returns (bool) { return tellerModerators[_who] == true; }
  function isShopModerator(address _who) external view returns (bool) { return shopModerators[_who] == true; }
}