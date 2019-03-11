pragma solidity ^0.5.3;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../interfaces/IUsers.sol";
import "../interfaces/IControl.sol";
import "../interfaces/IShops.sol";
import "../interfaces/IKlerosArbitrable.sol";

contract ShopsDispute {
  // ------------------------------------------------
  //
  // Libraries
  //
  // ------------------------------------------------

  using SafeMath for uint;

  // ------------------------------------------------
  //
  // Enums
  //
  // ------------------------------------------------

  enum RulingOptions {NoRuling, ShopWins, ChallengerWins}
  /* enum DisputeStatus {Waiting, Appealable, Solved} // copied from IKlerosArbitrable.sol */

  // ------------------------------------------------
  //
  // Structs
  //
  // ------------------------------------------------

  struct ShopDispute {
    uint id;
    address shop;
    address challenger;
    uint disputeType;
    RulingOptions ruling;
    IKlerosArbitrable.DisputeStatus status;
  }

  // ------------------------------------------------
  //
  // Variables Public
  //
  // ------------------------------------------------

  // links to other contracts
  IShops public shops;
  IUsers public users;
  IControl public control;
  IKlerosArbitrable public arbitrator; // <-- kleros

  // kleros related
  string public constant RULING_OPTIONS = "Shop wins;Challenger wins";
  uint8 public constant AMOUNT_OF_CHOICES = 2;
  bytes public arbitratorExtraData;
  string[] public disputeTypes;

  // ------------------------------------------------
  //
  // Variables Private
  //
  // ------------------------------------------------

  //      disputeId disputeStruct
  mapping(uint =>   ShopDispute) private disputeIdToDispute;

  // ------------------------------------------------
  //
  // Events
  //
  // ------------------------------------------------

  event MetaEvidence(uint indexed _metaEvidenceID, string _evidence);
  event Dispute(address indexed _arbitrator, uint indexed _disputeID, uint _metaEvidenceID);
  event Evidence(address indexed _arbitrator, uint indexed _disputeID, address indexed _party, string _evidence);
  event Ruling(address indexed _arbitrator, uint indexed _disputeID, uint _ruling);

  // ------------------------------------------------
  //
  // Modifiers
  //
  // ------------------------------------------------

  modifier onlyArbitrator {
    require(msg.sender == address(arbitrator), "Can only be called by the arbitrator.");
    _;
  }

  modifier onlyWhenCallerIsCEO {
    require(control.isCEO(msg.sender), "can only be called by CEO");
    _;
  }

  modifier onlyWhenCallerIsCertified {
    require(users.getUserTier(msg.sender) > 0, "user not certified");
    _;
  }

  modifier onlyWhenNotPaused {
    require(control.paused() == false, "contract is paused");
    _;
  }

  // ------------------------------------------------
  //
  // Events
  //
  // ------------------------------------------------

  // ------------------------------------------------
  //
  // Constructor
  //
  // ------------------------------------------------

  constructor(address _shops, address _users, address _control, address _arbitrator, bytes memory _arbitratorExtraData)
    public
  {
    require(_shops != address(0), "shops address cannot be 0x0");
    require(_users != address(0), "users address cannot be 0x0");
    require(_control != address(0), "control address cannot be 0x0");
    require(_arbitrator != address(0), "arbitrator cannot be 0x0");

    shops = IShops(_shops);
    users = IUsers(_users);
    control = IControl(_control);

    // kleros
    arbitrator = IKlerosArbitrable(_arbitrator);
    arbitratorExtraData = _arbitratorExtraData;
  }

  // ------------------------------------------------
  //
  // Functions Getters Public
  //
  // ------------------------------------------------

  function getDisputeCreateCost()
    public
    view
    returns (uint)
  {
    return arbitrator.arbitrationCost(arbitratorExtraData) * 2;
  }

  function getDisputeAppealCost(address _shopAddress)
    external
    view
    returns (uint)
  {
    uint disputeID = shops.getShopDisputeID(_shopAddress);

    return arbitrator.appealCost(disputeID, arbitratorExtraData);
  }

  function getDisputeStatus(uint _disputeID)
    private
    view
    returns (IKlerosArbitrable.DisputeStatus disputeStatus)
  {
    ShopDispute memory dispute = disputeIdToDispute[_disputeID];

    if (dispute.status == IKlerosArbitrable.DisputeStatus.Solved) {
      // rule() in this contract was called, it set status to Solved and set the final Ruling
      disputeStatus = dispute.status;
    } else {
      // dispute is not yet finalized, get current values from arbitrator contract
      disputeStatus = arbitrator.disputeStatus(_disputeID); // returns IKlerosArbitrable.DisputeStatus
    }
  }

  function getDisputeRuling(uint _disputeID)
    private
    view
    returns (RulingOptions disputeRuling)
  {
    ShopDispute memory dispute = disputeIdToDispute[_disputeID];

    if (dispute.status == IKlerosArbitrable.DisputeStatus.Solved) {
      // rule() in this contract was called, it set status to Solved and set the final Ruling
      disputeRuling = dispute.ruling;
    } else {
      // dispute is not yet finalized, get current values from arbitrator contract
      disputeRuling = RulingOptions(arbitrator.currentRuling(_disputeID));
    }
  }

  function getDispute(address _shopAddress)
    public
    view
    returns (uint, address, address, uint, uint, uint)
  {
    ShopDispute memory dispute = disputeIdToDispute[shops.getShopDisputeID(_shopAddress)];

    return (
      dispute.id,
      dispute.shop,
      dispute.challenger,
      dispute.disputeType,

      // from arbitrator contract or this contract if finalized
      uint(getDisputeRuling(dispute.id)),
      uint(getDisputeStatus(dispute.id))
    );
  }

  // ------------------------------------------------
  //
  // Functions Setters Public
  //
  // ------------------------------------------------

  // so we can add new types of dispute in the future
  function addDisputeType(string calldata _disputeTypeLink)
    external
    onlyWhenCallerIsCEO
  {
    require(bytes(_disputeTypeLink).length > 0, "dispute type link is empty");

    uint metaEvidenceId = disputeTypes.push(_disputeTypeLink) - 1;

    emit MetaEvidence(metaEvidenceId, _disputeTypeLink);
  }

  // called by somebody who wants to start a dispute with a shop
  function createDispute(address _shopAddress, uint _metaEvidenceId, string memory _evidenceLink)
    public
    payable
    onlyWhenNotPaused
    onlyWhenCallerIsCertified
  {
    require(_metaEvidenceId < disputeTypes.length, "dispute type does not exist");
    require(bytes(_evidenceLink).length > 0, "evidence link is empty");
    require(msg.sender != _shopAddress, "shop owner cannot start dispute on own shop");
    require(!shops.hasDispute(_shopAddress), "shop already has a dispute");

    uint arbitrationCost = getDisputeCreateCost();
    require(msg.value >= arbitrationCost, "sent eth is lower than arbitration cost");

    uint disputeID = arbitrator.createDispute.value(arbitrationCost)(AMOUNT_OF_CHOICES, arbitratorExtraData);

    // create new Dispute
    ShopDispute storage dispute = disputeIdToDispute[disputeID];
    dispute.id = disputeID;
    dispute.challenger = msg.sender;
    dispute.shop = _shopAddress;
    dispute.disputeType = _metaEvidenceId;
    dispute.ruling = RulingOptions.NoRuling;
    dispute.status = IKlerosArbitrable.DisputeStatus.Waiting;

    shops.setDispute(_shopAddress, disputeID);

    emit Dispute(address(arbitrator), disputeID, _metaEvidenceId);
    emit Evidence(address(arbitrator), disputeID, msg.sender, _evidenceLink);

    uint excessEth = arbitrationCost.sub(msg.value);
    if (excessEth > 0) msg.sender.transfer(excessEth);
  }

  function appealDispute(address _shopAddress, string calldata _evidenceLink)
    external
    payable
    onlyWhenNotPaused
    onlyWhenCallerIsCertified
  {
    require(bytes(_evidenceLink).length > 0, "evidence link is empty");

    uint disputeID = shops.getShopDisputeID(_shopAddress);

    ShopDispute storage dispute = disputeIdToDispute[disputeID];
    require(getDisputeStatus(dispute.id) == IKlerosArbitrable.DisputeStatus.Appealable, "dispute is not appealable");

    RulingOptions currentRuling = getDisputeRuling(dispute.id);
    if (currentRuling == RulingOptions.ShopWins) {
      require(msg.sender == dispute.challenger, "shop ruled to win, only challenger can appeal");
    } else if (currentRuling == RulingOptions.ChallengerWins) {
      require(msg.sender == dispute.shop, "challenger ruled to win, only shop can appeal");
    } else {
      require(msg.sender == dispute.challenger, "no ruling given, only challenger can appeal");
    }

    uint appealCost = arbitrator.appealCost(dispute.id, arbitratorExtraData);
    require(msg.value >= appealCost, "sent eth is lower than appeal cost");

    arbitrator.appeal.value(appealCost)(dispute.id, arbitratorExtraData);

    emit Evidence(address(arbitrator), dispute.id, msg.sender, _evidenceLink);

    uint excessEth = appealCost.sub(msg.value);
    if (excessEth > 0) msg.sender.transfer(excessEth);
  }

  // called by rule() which is called by Kleros IKlerosArbitrable contract
  function executeRuling(uint _disputeID, uint _ruling)
    private
  {
    RulingOptions finalRuling = RulingOptions(_ruling);

    ShopDispute storage dispute = disputeIdToDispute[_disputeID];

    if (finalRuling == RulingOptions.ShopWins) {
      shops.unsetDispute(dispute.shop);
    } else if (finalRuling == RulingOptions.ChallengerWins) {
      shops.removeDisputedShop(dispute.shop, dispute.challenger);
    } else if (finalRuling == RulingOptions.NoRuling) {
      shops.unsetDispute(dispute.shop);
    }
    delete disputeIdToDispute[_disputeID];
  }
  function rule(uint _disputeID, uint _ruling)
    public
    onlyArbitrator
  {
    emit Ruling(msg.sender, _disputeID, _ruling);

    executeRuling(_disputeID,_ruling);
  }
}
