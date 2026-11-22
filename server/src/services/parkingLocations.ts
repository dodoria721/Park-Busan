import catalogue from '../data/parking-locations.json';
import type { ParkingLot } from '../types/parking';

function normalizeName(name: string) { return name.normalize('NFKC').replace(/[\s,·()]/g, '').toLowerCase(); }

export function enrichParkingLocation(parking: ParkingLot): ParkingLot {
  // Only an unambiguous exact name match is allowed; preserve numbers and directions.
  const matches = catalogue.locations.filter((location) => normalizeName(location.name) === normalizeName(parking.name));
  if (matches.length !== 1) return parking;
  const location = matches[0];
  return {
    ...parking, address: parking.address ?? location.address,
    latitude: parking.latitude ?? location.latitude, longitude: parking.longitude ?? location.longitude,
    locationSearchText: `${location.address} ${location.landAddress}`,
    locationSource: catalogue.source, locationUpdatedAt: catalogue.retrievedAt,
  };
}
