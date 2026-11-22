import type { LiveStatus } from '@parkbusan/shared';
import { RealtimeParkingRepository } from '../src/repositories/realtimeParkingRepository.ts';
import type { ParkingLot as RealtimeLot } from '../src/types/parking.ts';
import type { LiveProvider } from './providers.ts';

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

/**
 * Optional Edge Function live feed. It returns statuses keyed by the Busan
 * facility code only; Supabase UUID conversion remains in fetchLive().
 */
export function createRealtimeLiveProvider(
  url: string,
  key: string,
  request: typeof fetch = fetch,
  now: () => number = Date.now,
): LiveProvider {
  const repository = new RealtimeParkingRepository(request, { url, key });
  let cached: { rows: RealtimeLot[]; expiresAt: number } | null = null;
  let pending: Promise<RealtimeLot[]> | null = null;

  async function load(): Promise<RealtimeLot[]> {
    if (cached && now() < cached.expiresAt) return cached.rows;
    if (!pending) {
      pending = repository
        .findAll()
        .then((rows) => {
          cached = { rows, expiresAt: now() + CACHE_MS };
          return rows;
        })
        .finally(() => {
          pending = null;
        });
    }
    // Never return an expired snapshot after an upstream failure.
    return pending;
  }

  return {
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
  };
}
