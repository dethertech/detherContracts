pragma solidity ^0.4.22;

contract CSCShop {

    bytes10 public geohash;
    bytes12 public csc;
    bool public delegated;
    address public shopOwner;
    address public cscShopContractOwner; // loyalty point auction contract for example

    event CscCreated(bytes12 cscId, address cscAddress, address shopOwner, bytes10 geohash);
    event amountReceived(uint weis, uint totalBalance);
    event withdrawFromShop(uint balance);

    modifier onlyshopOwner() {
      require(msg.sender == shopOwner);
      _;
    }

    constructor(bytes10 _geohash, address _shopOwner, address _cscShopContractOwner) public {
      geohash = _geohash;
      csc = computeCSC(geohash, address(this));
      shopOwner = _shopOwner;
      cscShopContractOwner = _cscShopContractOwner;
      delegated = false;
      emit CscCreated(csc, address(this), shopOwner, geohash);
    }

    function()
      payable
      public
    {
      emit amountReceived(msg.value, address(this).balance);
    }

    function computeCSC(bytes10 _geohashArg, address _addr)
      public
      pure
      returns(bytes12)
    {
      return bytes12(keccak256(abi.encodePacked(_geohashArg, _addr)));
    }

    function getGeohash()
      public
      view
      returns(bytes10)
    {
      return geohash;
    }

    function getcscShopContractOwner()
      public
      view
      returns(address)
    {
      return cscShopContractOwner;
    }

    function withdraw()
      onlyshopOwner
    {
      require(address(this).balance > 0);
      msg.sender.transfer(address(this).balance);
      emit withdrawFromShop(address(this).balance);
    }
}
