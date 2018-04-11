pragma solidity ^0.4.21;

import "oraclize-api/usingOraclize.sol";

//
// TODO
//
// - Set custom gasPrice since it's default 20 gwei, which is way too much
//   https://docs.oraclize.it/#ethereum-quick-start-custom-gas-limit-and-gas-price

contract GetTheExchangeRate is usingOraclize {

  uint256 public weiPriceOfOneUsd;

  // log during testing
  event LogTxt(string text);
  event LogNum(uint number);

  //
  // Constructor
  //

  // @param timestampToStart - timestamp of the next UTC 00:00:00 when deploying
  //                           this way we will always at roughly midnight, get a
  //                           callback with the new 1 USD = ? ETH exchange rate
  function GetTheExchangeRate(uint timestampToStart) public {
    // UNCOMMENT BELOW LINE WHEN TESTING WITH GANACHE
    OAR = OraclizeAddrResolverI(0x6f485C8BF6fc43eA212E93BBF8ce046C7f1cb475);

    if (timestampToStart == 0) {
      // update immediately
      update(0);
    } else {
      // set delay not to a delay but to a timestamp at which the operation is to be executed
      update(timestampToStart);
    }
  }

  //
  // update will call to Oraclize to setup the execution of a query at some future
  // point in the future, Oraclize will callback to this contract's __callback method
  // with the result at the specified time in the future
  //
  // in Dether the 'delay' can be:
  // - a timestamp, at boot we once set a timestamp of the next UTC 00:00:00
  // - an amount of seconds to wait till the next execution, inside the __callback
  //   function we will set it to 24 hours from now, creating a loop
  //
  function update(uint delay) internal {
    // NOTE: the first query to oraclize is FREE, all other queries will
    // check if this contract has enough balance to pay for the query
    if (oraclize_getPrice("URL") > this.balance) {
      LogTxt("Oraclize query was NOT sent, please add some ETH to cover for the query fee");
    } else {
      oraclize_query(delay, 'URL', 'json(https://min-api.cryptocompare.com/data/price?fsym=USD&tsyms=ETH).ETH');
      LogTxt("Oraclize query was sent (this contact has enough balance for the fee), waiting for the answer..");
    }
  }

  //
  // Oraclize will callback to this function when it has the result
  //
  // @param ethPriceOfOneUsd - eth amount that equals 1 usd, as a string
  //

  function __callback(bytes32 myid, string ethPriceOfOneUsd) public {
    LogTxt("Oraclize response received as string");
    LogTxt(ethPriceOfOneUsd);

    require(msg.sender != oraclize_cbAddress());

    // we get back the string eth amount of 1 usd, example: 0.002536
    // 1. convert string to uint
    // 2. multiple by 1 ether to get wei
    // NOTE: does cryptocompare always return 6 decimals ?!
    weiPriceOfOneUsd = parseInt(ethPriceOfOneUsd, 18);
    LogTxt("converted ETH price to wei as uint256 and saved it to contract state");
    LogNum(weiPriceOfOneUsd);

    // since we setup this __callback to arrive at midnight UTC 00:00:00 inside
    // the constructor. we are gonna set the next update to exactly 24 hours from
    // now, which will be roughly the next midnight UTC 00:00:00
    // roughly since every time the next one will possibly be some seconds "late"
    //
    // TODO: set time a bit less than 24 hours to deal with slippage as described above
    LogTxt("Trying to set next update to be in 1 day from now");
    update(day); // update every day, this constant is provided by usingOraclize
  }
}
