import type { ParkingLot } from '../types/parking';
import type { SearchPlace } from '../types/place';

export interface ParkingFilters { query: string; available: boolean; sort: 'name' | 'spaces'; placeId?: string; }
function normalize(value: string) { return value.toLowerCase().replace(/[\s,·()]/g, ''); }

export function parseParkingQuery(query: string) {
  const nearby = /\s(?:근처|주변|인근|부근)(?:\s|$)|(?:근처|주변|인근|부근)(?:\s*(?:공영\s*)?주차장)?$/.test(query);
  const term = query.replace(/(?:공영\s*)?주차장(?:을|를)?/g, ' ').replace(nearby ? /(?:근처|주변|인근|부근)(?:에|의)?/g : /$^/g, ' ').replace(/(?:찾아줘|찾아주세요|검색해줘|알려줘)\s*$/g, '').replace(/^부산(?:광역시|시)?(?:\s+|$)/, '').replace(/\s+/g, ' ').trim();
  return { term, nearby: nearby || /역$/.test(term) };
}

export function distanceMeters(a: Pick<SearchPlace, 'latitude' | 'longitude'>, b: Pick<SearchPlace, 'latitude' | 'longitude'>): number {
  const radians = (value: number) => value * Math.PI / 180;
  const lat = radians(b.latitude - a.latitude), lon = radians(b.longitude - a.longitude);
  const h = Math.sin(lat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(lon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export function filterParking(items: ParkingLot[], filters: ParkingFilters, origin?: SearchPlace): ParkingLot[] {
  if (origin) {
    return items.flatMap((parking) => {
      if (parking.latitude == null || parking.longitude == null || !Number.isFinite(parking.latitude) || !Number.isFinite(parking.longitude) || (!parking.latitude && !parking.longitude)) return [];
      const distance = distanceMeters(origin, { latitude: parking.latitude, longitude: parking.longitude });
      return distance <= 1000 && (!filters.available || parking.liveStatus === 'available') ? [{ ...parking, distanceMeters: Math.round(distance) }] : [];
    }).sort((a, b) => (filters.sort === 'spaces' ? (b.availableSpaces ?? -1) - (a.availableSpaces ?? -1) : 0) || a.distanceMeters - b.distanceMeters || a.name.localeCompare(b.name, 'ko'));
  }
  const tokens = parseParkingQuery(filters.query).term.split(/\s+/).map(normalize).filter((token) => token && !['부산', '부산시', '부산광역시', '공영', '주차장', '공영주차장'].includes(token));
  return items.filter((parking) => {
    const text = normalize(`${parking.name} ${parking.address ?? ''} ${parking.locationSearchText ?? ''}`);
    return tokens.every((token) => text.includes(token)) && (!filters.available || parking.liveStatus === 'available');
  }).sort((a, b) => filters.sort === 'spaces'
    ? (b.availableSpaces ?? -1) - (a.availableSpaces ?? -1) || a.name.localeCompare(b.name, 'ko')
    : a.name.localeCompare(b.name, 'ko'));
}

export function readParkingFilters(params: { query?: string; available?: string; sort?: string; placeId?: string }): ParkingFilters {
  return { query: params.query ?? '', available: params.available === '1', sort: params.sort === 'spaces' ? 'spaces' : 'name', ...(params.placeId ? { placeId: params.placeId } : {}) };
}

export function parkingFilterParams(filters: ParkingFilters) {
  return { query: filters.query, available: filters.available ? '1' : '0', sort: filters.sort, placeId: filters.placeId ?? '' };
}
