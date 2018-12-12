pragma solidity ^0.4.24;

import "./CentralizedArbitrator.sol";

/**
 *  @title AppealableArbitrator
 *  @author Enrique Piqueras - <epiquerass@gmail.com>
 *  @dev A centralized arbitrator that can be appealed.
 */
contract AppealableArbitrator is CentralizedArbitrator, Arbitrable {
    /* Structs */

    struct AppealDispute {
        uint rulingTime;
        Arbitrator arbitrator;
        uint appealDisputeID;
    }

    /* Storage */

    uint public timeOut;
    mapping(uint => AppealDispute) public appealDisputes;
    mapping(uint => uint) public appealDisputeIDsToDisputeIDs;

    /* Constructor */

    /** @dev Constructs the `AppealableArbitrator` contract.
     *  @param _arbitrationPrice The amount to be paid for arbitration.
     *  @param _arbitrator The back up arbitrator.
     *  @param _arbitratorExtraData Not used by this contract.
     *  @param _timeOut The time out for the appeal period.
     */
    constructor(
        uint _arbitrationPrice,
        Arbitrator _arbitrator,
        bytes _arbitratorExtraData,
        uint _timeOut
    ) public CentralizedArbitrator(_arbitrationPrice) Arbitrable(_arbitrator, _arbitratorExtraData) {
        timeOut = _timeOut;
    }

    /* External */

    /** @dev Changes the back up arbitrator.
     *  @param _arbitrator The new back up arbitrator.
     */
    function changeArbitrator(Arbitrator _arbitrator) external onlyOwner {
        arbitrator = _arbitrator;
    }

    /** @dev Changes the time out.
     *  @param _timeOut The new time out.
     */
    function changeTimeOut(uint _timeOut) external onlyOwner {
        timeOut = _timeOut;
    }

    /* External Views */

    /** @dev Gets the specified dispute's latest appeal ID.
     *  @param _disputeID The ID of the dispute.
     */
    function getAppealDisputeID(uint _disputeID) external view returns(uint disputeID) {
        if (appealDisputes[_disputeID].arbitrator != Arbitrator(address(0)))
            disputeID = AppealableArbitrator(appealDisputes[_disputeID].arbitrator).getAppealDisputeID(appealDisputes[_disputeID].appealDisputeID);
        else disputeID = _disputeID;
    }

    /* Public */

    /** @dev Appeals a ruling.
     *  @param _disputeID The ID of the dispute.
     *  @param _extraData Additional info about the appeal.
     */
    function appeal(uint _disputeID, bytes _extraData) public payable requireAppealFee(_disputeID, _extraData) {
        super.appeal(_disputeID, _extraData);
        if (appealDisputes[_disputeID].arbitrator != Arbitrator(address(0)))
            appealDisputes[_disputeID].arbitrator.appeal.value(msg.value)(appealDisputes[_disputeID].appealDisputeID, _extraData);
        else {
            appealDisputes[_disputeID].arbitrator = arbitrator;
            appealDisputes[_disputeID].appealDisputeID = arbitrator.createDispute.value(msg.value)(disputes[_disputeID].choices, _extraData);
            appealDisputeIDsToDisputeIDs[appealDisputes[_disputeID].appealDisputeID] = _disputeID;
        }
    }

    /** @dev Gives a ruling.
     *  @param _disputeID The ID of the dispute.
     *  @param _ruling The ruling.
     */
    function giveRuling(uint _disputeID, uint _ruling) public {
        require(disputes[_disputeID].status != DisputeStatus.Solved, "The specified dispute is already resolved.");
        if (appealDisputes[_disputeID].arbitrator != Arbitrator(address(0))) {
            require(Arbitrator(msg.sender) == appealDisputes[_disputeID].arbitrator, "Appealed disputes must be ruled by their back up arbitrator.");
            super._giveRuling(_disputeID, _ruling);
        } else {
            require(msg.sender == owner, "Not appealed disputes must be ruled by the owner.");
            if (disputes[_disputeID].status == DisputeStatus.Appealable) {
                if (now - appealDisputes[_disputeID].rulingTime > timeOut)
                    super._giveRuling(_disputeID, disputes[_disputeID].ruling);
                else revert("Time out time has not passed yet.");
            } else {
                disputes[_disputeID].ruling = _ruling;
                disputes[_disputeID].status = DisputeStatus.Appealable;
                appealDisputes[_disputeID].rulingTime = now;
                emit AppealPossible(_disputeID, disputes[_disputeID].arbitrated);
            }
        }
    }

    /* Public Views */

    /** @dev Gets the cost of appeal for the specified dispute.
     *  @param _disputeID The ID of the dispute.
     *  @param _extraData Additional info about the appeal.
     *  @return The cost of the appeal.
     */
    function appealCost(uint _disputeID, bytes _extraData) public view returns(uint cost) {
        if (appealDisputes[_disputeID].arbitrator != Arbitrator(address(0)))
            cost = appealDisputes[_disputeID].arbitrator.appealCost(appealDisputes[_disputeID].appealDisputeID, _extraData);
        else if (disputes[_disputeID].status == DisputeStatus.Appealable) cost = arbitrator.arbitrationCost(_extraData);
        else cost = NOT_PAYABLE_VALUE;
    }

    /** @dev Gets the status of the specified dispute.
     *  @param _disputeID The ID of the dispute.
     *  @return The status.
     */
    function disputeStatus(uint _disputeID) public view returns(DisputeStatus status) {
        if (appealDisputes[_disputeID].arbitrator != Arbitrator(address(0)))
            status = appealDisputes[_disputeID].arbitrator.disputeStatus(appealDisputes[_disputeID].appealDisputeID);
        else status = disputes[_disputeID].status;
    }

    /* Internal */

    /** @dev Executes the ruling of the specified dispute.
     *  @param _disputeID The ID of the dispute.
     *  @param _ruling The ruling.
     */
    function executeRuling(uint _disputeID, uint _ruling) internal {
        require(
            appealDisputes[appealDisputeIDsToDisputeIDs[_disputeID]].arbitrator != Arbitrator(address(0)),
            "The dispute must have been appealed."
        );
        giveRuling(appealDisputeIDsToDisputeIDs[_disputeID], _ruling);
    }
}
