import type { LiveStatus, ParkingLot } from '@parkbusan/shared';
import { RealtimeParkingRepository } from '../src/repositories/realtimeParkingRepository.ts';
import { enrichParkingLocation } from '../src/services/parkingLocations.ts';
import type { ParkingLot as RealtimeLot } from '../src/types/parking.ts';
import type { LiveProvider, ParkingDataProvider } from './providers.ts';

const CACHE_MS = 30_000;

/** The Busan feed uses Korea local time when it omits a timezone. */
export function realtimeTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? value.replace(' ', 'T') + '+09:00'
    : value;
  if (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(normalized)) return null;
  const time = Date.parse(normalized);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function mapLot(row: RealtimeLot): ParkingLot {
  const lot = enrichParkingLocation(row);
  return {
    id: lot.id,
    name: lot.name,
    address: lot.address,
    lat: lot.latitude,
    lng: lot.longitude,
    operatingHours: null,
    capacity: lot.totalSpaces,
    // This feed has no fee policies. Never substitute mock fees.
    fee: null,
    liveSupported: true,
    source: '부산시설공단 · Supabase Edge Function',
  };
}

/** Both providers share a snapshot so list, detail and live counts use the same IDs. */
export function createRealtimeProviders(
  url: string,
  key: string,
  request: typeof fetch = fetch,
  now: () => number = Date.now,
): { parking: ParkingDataProvider; live: LiveProvider } {
  const repository = new RealtimeParkingRepository(request, { url, key });
  let cached: { rows: RealtimeLot[]; expiresAt: number } | null = null;
  let pending: Promise<RealtimeLot[]> | null = null;

  async function load(): Promise<RealtimeLot[]> {
    if (cached && now() < cached.expiresAt) return cached.rows;
    if (!pending) {
      pending = repository.findAll().then((rows) => {
        cached = { rows, expiresAt: now() + CACHE_MS };
        return rows;
      }).finally(() => { pending = null; });
    }
    // An expired snapshot is not returned after upstream failure.
    return pending;
  }

  return {
    parking: {
      async listNear() { return (await load()).map(mapLot); },
      async getLot(id) {
        const row = (await load()).find((lot) => lot.id === id);
        return row ? mapLot(row) : null;
      },
    },
    live: {
      async getStatus(ids) {
        const selected = new Set(ids);
        const result: Record<string, LiveStatus> = {};
        for (const row of await load()) {
          if (!selected.has(row.id)) continue;
          result[row.id] = {
            available: row.availableSpaces ?? null,
            total: row.totalSpaces,
            updatedAt: realtimeTimestamp(row.lastUpdated),
          };
        }
        return result;
      },
    },
  };
}
