pragma solidity ^0.4.22;

// will be deployed by this factory
import "./Zone.sol";

contract ZoneFactory is Ownable {

  // ------------------------------------------------
  // Constants
  // ------------------------------------------------

  uint private constant MIN_ZONE_DTH_STAKE = 100 ether;

  // ------------------------------------------------
  // Variables (Getters)
  // ------------------------------------------------

  //      geohash   zoneContractAddress
  mapping(bytes7 => address) public zones;

  // ------------------------------------------------
  // Events
  // ------------------------------------------------

  event ZoneFactoryCreatedZone(address indexed zoneAddress, bytes7 indexed zoneGeohash, address indexed zoneOwner, uint dthStake);
  event ZoneFactoryPlacedZoneBid(address indexed zoneAddress, bytes7 indexed zoneGeohash, address indexed zoneOwner, uint dthStake);

  // ------------------------------------------------
  // Getters
  // ------------------------------------------------

  function zoneExists(bytes7 _geohash)
    public
    view
    returns (bool)
  {
    return zones[_geohash] != address(0);
  }

  // ------------------------------------------------
  // Setters
  // ------------------------------------------------

  // any address can call this method
  function bidForZone(address _from, bytes7 _geohash, uint _dthStake)
    external
    onlyOwner
    returns (address)
  {
    require(_dthStake >= MIN_ZONE_DTH_STAKE, "bid dth amount is less than minimum (100 DTH)");

    if (zoneExists(_geohash)) {
      // place a bid, this might be in an existing ZoneAuction or a new ZoneAuction is created
      Zone existingZone = Zone(zones[_geohash]);
      existingZone.bid(msg.sender, _dthStake);

      emit ZoneFactoryPlacedZoneBid(address(existingZone), _geohash, _zoneOwner, _dthStake);

      return address(existingZone);
    } else {
      // zone doesn't exist yet, createit and give it to _from
      Zone newZone = new Zone(_geohash, _from, _dthStake);
      zones[_geohash] = address(newZone);

      emit ZoneFactoryCreatedZone(address(newZone), _geohash, _zoneOwner, _dthStake);

      return address(newZone);
    }
  }
}
