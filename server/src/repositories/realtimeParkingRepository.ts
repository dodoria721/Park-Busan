import { getServerEnv } from '../lib/env.ts';
import type { ParkingLot, ParkingRepository } from '../types/parking.ts';

function count(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' && typeof value !== 'string') throw new Error('Invalid parking count');
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error('Invalid parking count');
  return number;
}

function toParkingLot(value: unknown): ParkingLot {
  if (!value || typeof value !== 'object') throw new Error('Invalid parking row');
  const row = value as Record<string, unknown>;
  if ((typeof row.code !== 'string' && typeof row.code !== 'number') || !String(row.code).trim() || typeof row.name !== 'string' || !row.name.trim()) {
    throw new Error('Missing parking code or name');
  }
  const availableSpaces = count(row.availableSpaces);
  return {
    id: String(row.code), name: row.name,
    address: null, latitude: null, longitude: null, isPublic: null,
    totalSpaces: count(row.totalSpaces), occupiedSpaces: count(row.occupiedSpaces),
    availableSpaces, lastUpdated: typeof row.lastUpdated === 'string' ? row.lastUpdated : null,
    distanceMeters: null, estimatedFeeWon: null, operatingHours: null,
    liveStatus: availableSpaces === null ? 'unknown' : availableSpaces > 0 ? 'available' : 'full',
  };
}

export class RealtimeParkingRepository implements ParkingRepository {
  private readonly request: typeof fetch;
  private readonly config?: { url: string; key: string };

  constructor(
    request: typeof fetch = fetch,
    config?: { url: string; key: string },
  ) {
    this.request = request;
    this.config = config;
  }

  private async load(code?: string): Promise<ParkingLot[]> {
    const url = new URL(this.config?.url ?? getServerEnv('PARKING_REALTIME_URL'));
    if (code !== undefined) url.searchParams.set('code', code);
    const key = this.config?.key ?? (process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || getServerEnv('SUPABASE_SECRET_KEY'));
    const response = await this.request(url, {
      headers: { apikey: key, Accept: 'application/json' },
      cache: 'no-store', signal: AbortSignal.timeout(15000),
    });
    // Do not expose upstream bodies, which may include provider credentials.
    if (!response.ok) throw new Error(`Parking Edge Function HTTP ${response.status}`);
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !('success' in body) || body.success !== true || !('parkingLots' in body) || !Array.isArray(body.parkingLots)) {
      throw new Error('Invalid Parking Edge Function response');
    }
    return body.parkingLots.map(toParkingLot);
  }

  findAll() { return this.load(); }
  async findById(id: string): Promise<ParkingLot | null> {
    return (await this.load(id)).find((parking) => parking.id === id) ?? null;
  }
}
