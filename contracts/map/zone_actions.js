const getLiveZoneOwner = async () => { // pas in a timestamp (in seconds)
  const zoneOwnerAddr = await zoneInstance.getZoneOwner();
  if (zoneOwnerAddr === '0x0000000000000000000000000000000000000000') {
    // there is currently no zone owner
  }
  const endTimeIdx = 3;
  const highestBidderIdx = 4;
  const now = Math.floor(Date.now() / 1000);

  const lastAuction = await zoneInstance.getLastAuction();

  if ()
  const liveZoneOwner =
    (lastAuction[endTimeIdx].toNumber() > now
     && zoneOwnerAddr !== lastAuction[highestBidderIdx])
      ? lastAuction[highestBidderIdx]
      : zoneOwnerAddr
  return liveZoneOwner
}

const canPlaceBid = (now, walletAddress) => {
  // is there currently
}