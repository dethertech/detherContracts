pragma solidity ^0.4.22;

contract CSCZone {

    bytes7 public geohash;
    bytes12 public csc;
    bool public delegated;
    address public zoneOwner;
    address public cscZoneContractOwner; // loyalty point auction contract for example

    event CscCreated(bytes12 cscId, address cscAddress, address zoneOwner, bytes7 geohash);
    event AmountReceived(uint weis, uint totalBalance);
    event WithdrawFromZone(uint balance);

    modifier onlyZoneOwner() {
      require(msg.sender == zoneOwner);
      _;
    }

    constructor(bytes7 _geohash, address _zoneOwner, address _cscZoneContractOwner)
      public
    {
      geohash = _geohash;
      csc = computeCSC(geohash, address(this));
      zoneOwner = _zoneOwner;
      cscZoneContractOwner = _cscZoneContractOwner;
      delegated = false;
      emit CscCreated(csc, address(this), zoneOwner, geohash);
    }

    function()
      payable
      public
    {
      emit AmountReceived(msg.value, address(this).balance);
    }

    function computeCSC(bytes7 _geohashArg, address _addr)
      public
      pure
      returns(bytes12)
    {
      return bytes12(keccak256(abi.encodePacked(_geohashArg, _addr)));
    }

    function withdraw()
      external
      onlyZoneOwner
    {
      require(address(this).balance > 0);
      msg.sender.transfer(address(this).balance);
      emit WithdrawFromZone(address(this).balance);
    }
}
