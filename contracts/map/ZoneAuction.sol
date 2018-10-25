pragma solidity ^0.4.21;

import "../npm/Ownable.sol";

import "../npm/SafeMath.sol";

contract ZoneAuction is Ownable {
  using SafeMath for uint;

  // ------------
  // Variables (Getters)
  // ------------

  // static
  address public owner;
  uint public bidIncrement;
  uint public startBlock;
  uint public endBlock;
  string public ipfsHash;

  // state
  bool public canceled;
  uint public highestBid;
  address public highestBidder;
  mapping(address => uint256) public fundsByBidder;
  bool ownerHasWithdrawn;

  enum State {Started, Ended}
  State public state;

  // ------------
  // Events
  // ------------

  event LogBid(address newHighestBidder, uint newHighestBid);
  event LogWithdrawal(address withdrawer, uint withdrawAmount);
  event LogCanceled();

  // ------------
  // Modifiers
  // ------------

  modifier onlyAfterStart {
    require(block.number > startBlock);
    _;
  }

  modifier onlyBeforeEnd {
    require(block.number <= endBlock);
    _;
  }

  modifier onlyNotCanceled {
    require(canceled);
    _;
  }

  modifier onlyEndedOrCanceled {
    require(block.number >= endBlock || canceled);
    _;
  }

  // ------------
  // Constructor
  // ------------

  constructor(address _owner, address _bidder, uint _bid)
    external
  {
    require(_bidder != address(0), "firstBidder vannot be 0x0");

    owner = _owner;
    highestBidder = _bidder;
    fundsByBidder[_bidder] = _bid;
    started = block.timestamp;
    state = State.Started;
  }

  // ------------
  // Getters
  // ------------

  function getHighestBid()
    public
    view
    returns (uint)
  {
    return fundsByBidder[highestBidder];
  }

  // ------------
  // Setters
  // ------------

  function placeBid(uint _dthAmount)
    internal
    onlyAfterStart
    onlyBeforeEnd
    onlyNotOwner
    returns (bool success)
  {
    require(_dthAmount > fundsByBidder[highestBidder], "bid amount is less than current highest bid");
    
    uint newBid = fundsByBidder[msg.sender] + _dthAmount;
    require(newBid > highestBid);

    fundsByBidder[msg.sender] = newBid;

    if (msg.sender != highestBidder) {
      highestBidder = msg.sender;
    }
    highestBid = newBid;

    emit LogBid(msg.sender, newBid, highestBidder, highestBid);
    return true;
  }

  function cancelAuction()
    public
    onlyOwner
    onlyBeforeEnd
    onlyNotCanceled
    returns (bool success)
  {
    canceled = true;
    emit LogCanceled();
    return true;
  }

  function withdraw()
    public
    onlyEndedOrCanceled
    returns (bool success)
  {
    address withdrawalAccount;
    uint withdrawalAmount;

    if (canceled) {
      // if the auction was canceled, everyone should simply be allowed to withdraw their funds
      withdrawalAccount = msg.sender;
      withdrawalAmount = fundsByBidder[withdrawalAccount];
    } else {
      // the auction finished without being canceled

      if (msg.sender == owner) {
        // the auction's owner should be allowed to withdraw the highestBindingBid
        withdrawalAccount = highestBidder;
        withdrawalAmount = highestBindingBid;
        ownerHasWithdrawn = true;
      } else if (msg.sender == highestBidder) {
        // the highest bidder should only be allowed to withdraw the difference between their
        // highest bid and the highestBindingBid
        withdrawalAccount = highestBidder;
        if (ownerHasWithdrawn) {
            withdrawalAmount = fundsByBidder[highestBidder];
        } else {
            withdrawalAmount = fundsByBidder[highestBidder].sub(highestBindingBid);
        }
      } else {
        // anyone who participated but did not win the auction should be allowed to withdraw
        // the full amount of their funds
        withdrawalAccount = msg.sender;
        withdrawalAmount = fundsByBidder[withdrawalAccount];
      }
    }

    require(withdrawalAmount > 0);

    fundsByBidder[withdrawalAccount] = fundsByBidder[withdrawalAccount].sub(withdrawalAmount);

    // send the funds
    require(!msg.sender.send(withdrawalAmount));

    emit LogWithdrawal(msg.sender, withdrawalAccount, withdrawalAmount);

    return true;
  }
}
