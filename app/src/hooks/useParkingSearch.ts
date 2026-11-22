import { useEffect, useState } from 'react';
import { filterParking, parseParkingQuery, type ParkingFilters } from '@/services/filterParking';
import { resolvePlace } from '@/services/resolvePlace';
import type { ParkingLot } from '@/types/parking';
import type { SearchPlace } from '@/types/place';

const cache = new Map<string, { expiresAt: number; request: Promise<SearchPlace[]> }>();
function lookup(query: string) {
  const cached = cache.get(query);
  if (cached && cached.expiresAt > Date.now()) return cached.request;
  const request = resolvePlace(query).catch((error: unknown) => { cache.delete(query); throw error; });
  if (cache.size >= 100) cache.delete(cache.keys().next().value!);
  cache.set(query, { expiresAt: Date.now() + 600000, request });
  return request;
}

export function useParkingSearch(items: ParkingLot[], filters: ParkingFilters) {
  const parsed = parseParkingQuery(filters.query);
  const textResults = filterParking(items, filters);
  // Availability filters must not change whether a query refers to a place.
  const hasTextMatch = filterParking(items, { ...filters, available: false }).length > 0;
  const spatial = Boolean(parsed.term && items.length && (parsed.nearby || !hasTextMatch));
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ query: string; places: SearchPlace[]; error: string | null }>({ query: '', places: [], error: null });
  useEffect(() => {
    if (!spatial) return;
    let active = true;
    lookup(parsed.term).then((places) => { if (active) setState({ query: parsed.term, places, error: null }); })
      .catch((error: unknown) => { if (active) setState({ query: parsed.term, places: [], error: error instanceof Error ? error.message : '장소 확인에 실패했습니다.' }); });
    return () => { active = false; };
  }, [parsed.term, spatial, attempt]);
  const current = state.query === parsed.term;
  const places = spatial && current ? state.places : [];
  const origin = places.find((place) => place.id === filters.placeId) ?? (places.length === 1 ? places[0] : undefined);
  const loading = spatial && !current;
  const error = spatial && current ? state.error : null;
  const results = spatial ? origin ? filterParking(items, filters, origin) : [] : textResults;
  return {
    results, places, origin, loading, error,
    needsSelection: spatial && places.length > 1 && !origin,
    message: origin ? `${origin.name} 기준 반경 1km · 직선거리${filters.sort === 'name' ? ' 가까운 순' : ''}` : spatial && current && !places.length && !error ? '검색 장소를 찾지 못했습니다. 장소명이나 주소를 더 구체적으로 입력해 주세요.' : null,
    missingLocations: spatial ? items.filter((parking) => parking.latitude == null || parking.longitude == null).length : 0,
    retry: () => { cache.delete(parsed.term); setState({ query: '', places: [], error: null }); setAttempt((value) => value + 1); },
  };
}
