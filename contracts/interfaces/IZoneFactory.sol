pragma solidity ^0.5.10;

contract IZoneFactory {
    function dth() view public returns(address);
    function zoneToGeohash(address) view public returns(bytes6);
    function geohashToZone(bytes6) view public returns(address);
    function activeBidderToZone(address) view public returns(address);
    function ownerToZone(address) view public returns(address);
    function zoneImplementation() view public returns(address);
    function tellerImplementation() view public returns(address);
    function geo() view public returns(address);
    function users() view public returns(address);
    // function getActiveBidderZone(address _bidder) view public returns(address);
    function transferOwnership(address newOwner) public;
    function changeOwner( address _newOwner, address _oldOwner, address _zone) public;
    function zoneExists(bytes6 _geohash) view external returns(bool);
    function proxyUpdateUserDailySold(bytes2 _countryCode, address _from, address _to, uint256 _amount) external;
    function emitAuctionCreated(bytes6 zoneFrom, address sender, uint auctionId, uint bidAmount) public;
    function emitAuctionEnded(bytes6 zoneFrom, address newOwner, uint auctionId,  uint winningBid) public; 
    function emitBid(bytes6 zoneFrom, address sender, uint auctionId, uint bidAmount) public;
    function emitClaimFreeZone(bytes6 zoneFrom, address newOwner,  uint bidAmount) public;
    function emitReleaseZone(bytes6 zoneFrom, address sender) public;
    function fillCurrentZoneBidder(address bidder) public;
    function removeActiveBidder(address activeBidder) public;
    function removeCurrentZoneBidders() public;
    function tokenFallback(address _from, uint256 _value, bytes memory _data) public;
}
