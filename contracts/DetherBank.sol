pragma solidity ^0.4.21;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import './zepellin/SafeMath.sol';
import './dth/tokenfoundry/ERC223ReceivingContract.sol';
import './dth/tokenfoundry/ERC223Basic.sol';
import 'bytes/BytesLib.sol';
import 'ethereum-datetime/contracts/DateTime.sol';

/// @title Contract that will store the Dth from user
contract DetherBank is ERC223ReceivingContract, Ownable, SafeMath, DateTime {
  using BytesLib for bytes;

  /*
   * Event
   */
  event receiveDth(address _from, uint amount);
  event receiveEth(address _from, uint amount);
  event sendDth(address _from, uint amount);
  event sendEth(address _from, uint amount);

  mapping(address => uint) public dthShopBalance;
  mapping(address => uint) public dthTellerBalance;
  mapping(address => uint) public ethShopBalance;
  mapping(address => uint) public ethTellerBalance;


  // store a mapping with per day/month/year a uint256 containing the wei sold amount on that date
  //
  //      user               day               month             year      weiSold
  mapping(address => mapping(uint16 => mapping(uint16 => mapping(uint16 => uint256)))) ethSellsUserToday;

  ERC223Basic public dth;
  bool public isInit = false;

  /**
   * INIT
   */
  function setDth (address _dth) external onlyOwner {
    require(!isInit);
    dth = ERC223Basic(_dth);
    isInit = true;
  }

  /**
   * Core fonction
   */
  // withdraw DTH when teller delete
  function withdrawDthTeller(address _receiver) external onlyOwner {
    require(dthTellerBalance[_receiver] > 0);
    uint tosend = dthTellerBalance[_receiver];
    dthTellerBalance[_receiver] = 0;
    require(dth.transfer(_receiver, tosend));
  }
  // withdraw DTH when shop delete
  function withdrawDthShop(address _receiver) external onlyOwner  {
    require(dthShopBalance[_receiver] > 0);
    uint tosend = dthShopBalance[_receiver];
    dthShopBalance[_receiver] = 0;
    require(dth.transfer(_receiver, tosend));
  }
  // withdraw DTH when a shop add by admin is delete
  function withdrawDthShopAdmin(address _from, address _receiver) external onlyOwner  {
    require(dthShopBalance[_from]  > 0);
    uint tosend = dthShopBalance[_from];
    dthShopBalance[_from] = 0;
    require(dth.transfer(_receiver, tosend));
  }

  // add DTH when shop register
  function addTokenShop(address _from, uint _value) external onlyOwner {
    dthShopBalance[_from] = SafeMath.add(dthShopBalance[_from], _value);
  }
  // add DTH when token register
  function addTokenTeller(address _from, uint _value) external onlyOwner{
    dthTellerBalance[_from] = SafeMath.add(dthTellerBalance[_from], _value);
  }
  // add ETH for escrow teller
  function addEthTeller(address _from, uint _value) external payable onlyOwner returns (bool) {
    ethTellerBalance[_from] = SafeMath.add(ethTellerBalance[_from] ,_value);
    return true;
  }
  // helper function to extra date info from block.timestamp
  function getDateInfo(uint timestamp) internal view returns(_DateTime) {
    // use DateTime.sol to extract date info from the timestamp
    _DateTime memory date = parseTimestamp(timestamp);
    return date;
  }
  // withdraw ETH for teller escrow + save amount sold today for the _from user
  function withdrawEth(address _from, address _to, uint _amount) external onlyOwner {
    require(ethTellerBalance[_from] >= _amount);
    ethTellerBalance[_from] = SafeMath.sub(ethTellerBalance[_from], _amount);

    uint256 weiSoldToday = getWeiSoldToday(_from);

    _DateTime memory date = getDateInfo(block.timestamp);

    // add the sold amount, should not exceed daily limit (checked in DetherCore)
    ethSellsUserToday[_from][date.day][date.month][date.year] = SafeMath.add(weiSoldToday, _amount);

    _to.transfer(_amount);
  }
  // refund all ETH from teller contract
  function refundEth(address _from) external onlyOwner {
    uint toSend = ethTellerBalance[_from];
    if (toSend > 0) {
      ethTellerBalance[_from] = 0;
      _from.transfer(toSend);
    }
  }

  /**
   * GETTER
   */
  function getDthTeller(address _user) public view returns (uint) {
    return dthTellerBalance[_user];
  }
  function getDthShop(address _user) public view returns (uint) {
    return dthShopBalance[_user];
  }

  function getEthBalTeller(address _user) public view returns (uint) {
    return ethTellerBalance[_user];
  }

  // get amount wei sold today for this user
  function getWeiSoldToday(address _user) public view returns (uint256 weiSoldToday) {
    // use DateTime.sol to extract date info from the timestamp
    _DateTime memory date = getDateInfo(block.timestamp);
    weiSoldToday = ethSellsUserToday[_user][date.day][date.month][date.year];
  }

  /// @dev Standard ERC223 function that will handle incoming token transfers.
  // DO NOTHING but allow to receive token when addToken* function are called
  // by the dethercore contract
  function tokenFallback(address _from, uint _value, bytes _data) {
    require(msg.sender == address(dth));
  }

}
