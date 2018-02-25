pragma solidity ^0.4.18;
pragma experimental ABIEncoderV2;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import 'zeppelin-solidity/contracts/lifecycle/Pausable.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import 'zeppelin-solidity/contracts/ReentrancyGuard.sol';
import './DetherTellerStorage.sol';
import './dth/DetherToken.sol';
import './certifier/SmsCertifier.sol';
import './dth/tokenfoundry/ERC223ReceivingContract.sol';
import './DthRegistry.sol';

// TODO
// NEED DTH TO DEPOSIT AND TRADE
// MINT LOYALTY WHEN TRADE
// limitation

contract DetherInterface is Ownable, Pausable, ReentrancyGuard,  ERC223ReceivingContract {
  using SafeMath for uint256;
  bool public run;
  DetherTellerStorage public tellerStorage;
  SmsCertifier public smsCertifier;
  DetherToken public dth;
  DthRegistry public dthRegistry;
  uint public limit = 2 ether;
  uint public licencePrice = 10;
  mapping (bytes2 => bool) authorisedTellerCountry;
  mapping (bytes2 => bool) authorisedShopCountry;

  event RegisterTeller(address indexed tellerAddress);
  event DeleteTeller(address indexed tellerAddress);
  event UpdateTeller(address indexed tellerAddress);
  event Sent(address indexed _from, address indexed _to, uint amount);
  event receiveDth(address indexed _from, uint _amount, bytes _bytes);

// modifier

  modifier isSmsWhitelisted(address _teller) {
    require(smsCertifier.isCertified(_teller));
    _;
  }

  modifier hasStaked(uint amount) {
    require(dthRegistry.getStaked(msg.sender) >= amount);
    _;
  }

  modifier isTellerCountryOn(bytes2 country) {
    require(authorisedTellerCountry[country]);
    _;
  }

  modifier isShopCountryOn(bytes2 country) {
    require(authorisedShopCountry[country]);
    _;
  }

  function emergencyTurnOff() public onlyOwner  {
    run = false;
  }

  function openTellerCountry(bytes2 country) {
    authorisedTellerCountry[country] = true;
  }

  function closeShopCountry(bytes2 country) {
    authorisedShopCountry[country] = false;
  }

  function DetherInterface(address _tellerStorageAddress, address _smsCertifier, address _dthRegistry) public {
    tellerStorage = DetherTellerStorage(_tellerStorageAddress);
    smsCertifier = SmsCertifier(_smsCertifier);
    dthRegistry = DthRegistry(_dthRegistry);
  }

  function addDth(address _dth) public onlyOwner {
    dth = DetherToken(_dth);
    run = true;
  }

  /* function updateLimit(uint newLimit)  public onlyOwner {
    limit = newLimit;
  } */

  /// @notice Register a teller
  /// @dev gasUsed: 360000
  function registerTeller(
    uint _lat,
    uint _lng,
    string _countryCode,
    int32 _postalcode,
    int8 _avatarId,
    int8 _currencyId,
    string _messagingAddress,
    string _messagingAddress2,
    int16 _rates
    ) public payable whenNotPaused isSmsWhitelisted(msg.sender) hasStaked(licencePrice) {
      // Conditions
      require(tellerStorage.isOnline(msg.sender) != true);
      uint bal = tellerStorage.getTellerBalance(msg.sender);
      require(bal.add(msg.value) <= limit);
      tellerStorage.setTellerPosition(msg.sender, _lat, _lng, _countryCode, _postalcode);
      tellerStorage.setTellerProfile(msg.sender, _avatarId, _currencyId, _messagingAddress,_messagingAddress2, _rates);
      tellerStorage.addBalance.value(msg.value)(msg.sender, msg.value); // send money
      RegisterTeller(msg.sender);
  }

  function sendCoin (address _receiver, uint _amount) public whenNotPaused nonReentrant returns (bool) {
    require(_receiver != msg.sender);
    tellerStorage.releaseEth(msg.sender ,_receiver, _amount);
    Sent(msg.sender, _receiver, _amount);
    return true;
  }

  function updateProfile(
    int8 _avatarId,
    int8 _currencyId,
    string _messagingAddr,
    string _messagingAddr2,
    int16 _rates
    ) public payable whenNotPaused {
      require(tellerStorage.isTeller(msg.sender) == true);
      tellerStorage.setTellerProfile(msg.sender, _avatarId, _currencyId, _messagingAddr,_messagingAddr2, _rates);
      tellerStorage.addBalance.value(msg.value)(msg.sender, msg.value); // send money
      UpdateTeller(msg.sender);
  }

  // 103495 gas
  function updatePosition(
    uint _lat,
    uint _lng,
    string _countryCode,
    int32 _postalcode
    ) public payable whenNotPaused  {
      require(tellerStorage.isTeller(msg.sender) == true);
      tellerStorage.setTellerPosition(msg.sender, _lat, _lng, _countryCode, _postalcode);
      tellerStorage.addBalance.value(msg.value)(msg.sender, msg.value); // send money
      UpdateTeller(msg.sender);
  }

  function addBalance() public payable whenNotPaused {
    require(tellerStorage.isOnline(msg.sender) == true);
    tellerStorage.addBalance.value(msg.value)(msg.sender, msg.value); // send money
    UpdateTeller(msg.sender);
  }

  // Maybe remove the modifier
  function deleteMyProfile() hasStaked(licencePrice) whenNotPaused  {
    tellerStorage.deleteTeller(msg.sender);
    // unstack token
    dthRegistry.withdraw(msg.sender);
    DeleteTeller(msg.sender);
  }

  function switchTellerOffline() public whenNotPaused {
    // delete point on map and messagery
    assert(tellerStorage.isOnline(msg.sender));
    tellerStorage.turnOffline(msg.sender);
    DeleteTeller(msg.sender);
  }

  function changeStorageOwnership(address newOwner) public whenPaused onlyOwner {
    tellerStorage.transferOwnership(newOwner);
  }

  function changeDthRegistryOwnership(address newOwner) public whenPaused onlyOwner {
    dthRegistry.transferOwnership(newOwner);
  }

    /*function importTellers(
      int256 _lat,
      int256 _lng,
      uint _zoneId,
      int16 _rate,
      int8 _avatarId,
      int8 _currencyId,
      bytes32 _messagingAddress,
      bytes32 _name,
      uint _balance
      ) public onlyOwner isLockedForInitialMigration {
      tellerStorage.setTellerIndex(msg.sender);
      tellerStorage.setTellerZone(msg.sender, _zoneId);
      tellerStorage.setTellerPosition(msg.sender, _lat, _lng, _zoneId);
      tellerStorage.setTellerProfile(msg.sender, _avatarId, _currencyId, _messagingAddress, _name, _rate);
      tellerStorage.setTellerBalance(msg.sender, _balance);
    }*/

    /* function addressToBytes(address i)  returns (bytes by) {
      by = new bytes(20);
      assembly {
        let count := 0
        let byptr := add(by, 32)
        loop:
            jumpi(end, eq(count, 20))
            mstore8(byptr, byte(add(count,12), i))
            byptr := add(byptr, 1)
            count := add(count, 1)
            jump(loop)
        end:
      }
      return by;
    }

    function toBytes(address x) returns (bytes b) {
        b = new bytes(20);
        for (uint i = 0; i < 20; i++)
            b[i] = byte(uint8(uint(x) / (2**(8*(19 - i)))));
    }

    function bytes32ToString (bytes32 data) returns (string) {
        bytes memory bytesString = new bytes(32);
        for (uint j=0; j<32; j++) {
          byte char = byte(bytes32(uint(data) * 2 ** (8 * j)));
          if (char != 0) {
            bytesString[j] = char;
          }
        }

        return string(bytesString);
      }

       function My_integ(bytes32 myInteger) returns (string){

            string memory myString= bytes32ToString( myInteger );
    return myString;
    } */




    // gasused 109111
    function tokenFallback(address _from, uint _value, bytes _data) public {
      //TKN memory tkn;
      receiveDth(_from, _value, _data);

      // with tokenfallback (consume more gas)
      /* bytes memory addr = addressToBytes(_from);
      dth.transfer(address(dthRegistry), _value, addr); */

      // with a secondary function
      dth.transfer(address(dthRegistry), _value);
      dthRegistry.addToken(_from ,_value);

      /* tkn variable is analogue of msg variable of Ether transaction
      *  tkn.sender is person who initiated this token transaction   (analogue of msg.sender)
      *  tkn.value the number of tokens that were sent   (analogue of msg.value)
      *  tkn.data is data of token transaction   (analogue of msg.data)
      */
    }

}
