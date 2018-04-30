pragma solidity ^0.4.21;

/// @title A facet of Dether that manages special access privileges.
/// @author Axiom Zen (https://www.axiomzen.co) && dether.io
/// Thanks to the Cryptokitties

contract DetherAccessControl {
    // This facet controls access control for Dether. There are four roles managed here:
    //
    //     - The CEO: The CEO can reassign other roles and change the addresses of our dependent smart
    //         contracts. It is also the only role that can unpause the smart contract.
    //
    //     - The CMO: The CMO is in charge to open or close activity in zone
    //
    // It should be noted that these roles are distinct without overlap in their access abilities, the
    // abilities listed for each role above are exhaustive. In particular, while the CEO can assign any
    // address to any role, the CEO address itself doesn't have the ability to act in those roles. This
    // restriction is intentional so that we aren't tempted to use the CEO address frequently out of
    // convenience. The less we use an address, the less likely it is that we somehow compromise the
    // account.

    /// @dev Emited when contract is upgraded
    event ContractUpgrade(address newContract);

    // The addresses of the accounts (or contracts) that can execute actions within each roles.
    address public ceoAddress;
    address public cmoAddress;
    address public csoAddress; // CHIEF SHOP OFFICER
    address public cfoAddress; // CHIEF FINANCIAL OFFICER
	  mapping (address => bool) public shopModerators;   // centralised moderator, would become decentralised
    mapping (address => bool) public tellerModerators;   // centralised moderator, would become decentralised

    // @dev Keeps track whether the contract is paused. When that is true, most actions are blocked
    bool public paused = false;

    /// @dev Access modifier for CEO-only functionality
    modifier onlyCEO() {
        require(msg.sender == ceoAddress);
        _;
    }

    /// @dev Access modifier for CMO-only functionality
    modifier onlyCMO() {
        require(msg.sender == cmoAddress);
        _;
    }

    modifier onlyCSO() {
        require(msg.sender == csoAddress);
        _;
    }

    modifier onlyCFO() {
        require(msg.sender == cfoAddress);
        _;
    }

    modifier isShopModerator(address _user) {
      require(shopModerators[_user]);
      _;
    }
    modifier isTellerModerator(address _user) {
      require(tellerModerators[_user]);
      _;
    }

    /// @dev Assigns a new address to act as the CEO. Only available to the current CEO.
    /// @param _newCEO The address of the new CEO
    function setCEO(address _newCEO) external onlyCEO {
        require(_newCEO != address(0));
        ceoAddress = _newCEO;
    }

    /// @dev Assigns a new address to act as the CMO. Only available to the current CEO.
    /// @param _newCMO The address of the new CMO
    function setCMO(address _newCMO) external onlyCEO {
        require(_newCMO != address(0));
        cmoAddress = _newCMO;
    }

    function setCSO(address _newCSO) external onlyCEO {
        require(_newCSO != address(0));
        csoAddress = _newCSO;
    }

    function setCFO(address _newCFO) external onlyCEO {
        require(_newCFO != address(0));
        cfoAddress = _newCFO;
    }

    function setShopModerator(address _moderator) external onlyCEO {
      require(_moderator != address(0));
      shopModerators[_moderator] = true;
    }

    function removeShopModerator(address _moderator) external onlyCEO {
      shopModerators[_moderator] = false;
    }

    function setTellerModerator(address _moderator) external onlyCEO {
      require(_moderator != address(0));
      tellerModerators[_moderator] = true;
    }

    function removeTellerModerator(address _moderator) external onlyCEO {
      tellerModerators[_moderator] = false;
    }
    /*** Pausable functionality adapted from OpenZeppelin ***/

    /// @dev Modifier to allow actions only when the contract IS NOT paused
    modifier whenNotPaused() {
        require(!paused);
        _;
    }

    /// @dev Modifier to allow actions only when the contract IS paused
    modifier whenPaused {
        require(paused);
        _;
    }

    /// @dev Called by any "C-level" role to pause the contract. Used only when
    ///  a bug or exploit is detected and we need to limit damage.
    function pause() external onlyCEO whenNotPaused {
        paused = true;
    }

    /// @dev Unpauses the smart contract. Can only be called by the CEO, since
    ///  one reason we may pause the contract is when CMO account are
    ///  compromised.
    /// @notice This is public rather than external so it can be called by
    ///  derived contracts.
    function unpause() public onlyCEO whenPaused {
        // can't unpause if contract was upgraded
        paused = false;
    }
}
