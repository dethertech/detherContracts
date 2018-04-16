pragma solidity ^0.4.21;

import "oraclize-api/usingOraclize.sol";

//
// TODO
//
// - Set custom gasPrice since it's default 20 gwei, which is way too much
//   https://docs.oraclize.it/#ethereum-quick-start-custom-gas-limit-and-gas-price

contract ExchangeRateOracle is usingOraclize {

  uint256 public weiPriceOneUsd;

  event LogNotEnoughBalance(uint256 _weiContractBalance, uint256 _weiQueryPrice);
  event LogScheduledExecution(uint256 _now, uint256 _delay);
  event LogNewUsdPrice(uint256 _weiPriceOneUsd);
  event LogCallback(address _sender, address _cbAddress);

  /**
   * @dev constructor which will do the initial update() call
   *
   * @param _timestampToStart  Should be timestamp of the next UTC 00:00:00
   *                          could also be zero, in which case will update
   *                          immediately (used in testing)
   */
  function ExchangeRateOracle(uint _timestampToStart) public payable {
    if (_timestampToStart == 0) {
      // update immediately
      update(0);
    } else {
      // set update to fire at a timestamp int he future
      update(_timestampToStart);
    }
  }

  /**
   * @dev Send the query schedule message to oraclize, will check if this contract
   *      has enough eth balance, if not query will NOT be scheduled and contract needs
   *      to be manually restarted by Owner
   *
   * @param _delay Delay in seconds OR timestamp, to schedule oraclize call at
   */
  function update(uint _delay) internal {
    // NOTE: the first query to oraclize is FREE, all other queries will require a fee in wei

    uint _weiQueryPrice = oraclize_getPrice("URL");

    // check if this contract has enough balance to pay for the query
    if (_weiQueryPrice > this.balance) {
      emit LogNotEnoughBalance(this.balance, _weiQueryPrice);
    } else {
      oraclize_query(_delay, 'URL', 'json(https://min-api.cryptocompare.com/data/price?fsym=USD&tsyms=ETH).ETH');
      emit LogScheduledExecution(block.timestamp, _delay);
    }
  }

  /**
   * @dev Oraclize will callback the result of the execution of the scheduled query.
   *      This function will also setup the next update to be 24 hours (exactly) from
   *      now (block.timestamp)
   *
   * @param _myid            Oraclize assigned query id, we dont use this (yet)
   * @param _ethPriceOneUsd  eth price of 1 usd from cryptocompare as string, e.g. 0.001957
   */
  function __callback(bytes32 _myid, string _ethPriceOneUsd) public {
    emit LogCallback(msg.sender, oraclize_cbAddress());
    require(msg.sender == oraclize_cbAddress());

    // convert eth as string to wei as uint256, e.g. 0.001957 --> 1957000000000000
    // and store the result in the contract state
    weiPriceOneUsd = parseInt(_ethPriceOneUsd, 18);
    emit LogNewUsdPrice(weiPriceOneUsd);

    // since we setup this __callback to arrive at midnight UTC 00:00:00 inside
    // the constructor. we are gonna set the next update to exactly 24 hours from
    // now, which will be roughly the next midnight UTC 00:00:00
    // roughly since every time the next one will possibly be some seconds "late"
    //
    // TODO: set time a bit less than 24 hours to deal with slippage as described above
    update(day); // update every day, this constant is provided by usingOraclize
  }

  /**
   * @dev Return wei price of 1 USD from the contract state (updated in __callback)
   */
  function getWeiPriceOneUsd() external view returns(uint256) {
    return weiPriceOneUsd;
  }
}
