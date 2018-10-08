pragma solidity ^0.4.22;

contract CSCZone {

    bytes7 public geohash;
    bytes12 public csc;
    bool public delegated;
    address public zoneOwner;
    address public cscZoneContractOwner; // loyalty point auction contract for example

    event CscCreated(bytes12 cscId, address cscAddress, address zoneOwner, bytes7 geohash);
    event amountReceived(uint weis, uint totalBalance);
    event withdrawFromZone(uint balance);

    modifier onlyZoneOwner() {
      require(msg.sender == zoneOwner);
      _;
    }

    constructor(bytes7 _geohash, address _zoneOwner, address _cscZoneContractOwner) public {
      geohash = _geohash;
      csc = computeCSC(geohash, address(this));
      zoneOwner = _zoneOwner;
      cscZoneContractOwner = _cscZoneContractOwner;
      delegated = false;
      emit CscCreated(csc, address(this), zoneOwner, geohash);
    }

    function() payable {
      emit amountReceived(msg.value, address(this).balance);
    }

    function computeCSC(bytes7 geohash_arg, address addr) internal pure returns(bytes12) {
      return bytes12(keccak256(geohash_arg, addr));
    }

    function getGeohash() public view returns(bytes7) {
      return geohash;
    }

    function getCscZoneContractOwner() public view returns(address) {
      return cscZoneContractOwner;
    }

    function withdraw() onlyZoneOwner() {
      require(address(this).balance > 0);
      emit withdrawFromZone(address(this).balance);
      msg.sender.transfer(address(this).balance);

    }
}
