import type { FeePolicy, ParkingLot } from '@parkbusan/shared';
import type { ParkingDataProvider } from './providers.ts';

export interface SupabaseFeePolicyRow {
  id: string;
  base_minutes: number | null;
  base_fee_won: number | null;
  additional_minutes: number | null;
  additional_fee_won: number | null;
  daily_max_fee_won: number | null;
  notes: string | null;
  effective_from: string | null;
  effective_to: string | null;
  created_at: string | null;
}

export interface SupabaseSourceMappingRow {
  source_name: string;
  last_seen_at: string | null;
}

export interface SupabaseParkingLotRow {
  id: string;
  external_id: string | null;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  total_spaces: number | null;
  operating_hours: string | null;
  live_status: string | null;
  live_updated_at: string | null;
  fee_policies: SupabaseFeePolicyRow[] | null;
  source_mappings: SupabaseSourceMappingRow[] | null;
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const PARKING_SELECT = [
  'id',
  'external_id',
  'name',
  'address',
  'latitude',
  'longitude',
  'total_spaces',
  'operating_hours',
  'live_status',
  'live_updated_at',
  'fee_policies(id,base_minutes,base_fee_won,additional_minutes,additional_fee_won,daily_max_fee_won,notes,effective_from,effective_to,created_at)',
  'source_mappings(source_name,last_seen_at)',
].join(',');

export class SupabaseParkingError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(
    message: string,
    status: number,
    code: string | null = null,
  ) {
    super(message);
    this.name = 'SupabaseParkingError';
    this.status = status;
    this.code = code;
  }
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function activeFeePolicy(rows: SupabaseFeePolicyRow[] | null, asOf: Date): SupabaseFeePolicyRow | null {
  if (!Array.isArray(rows)) return null;
  const day = asOf.toISOString().slice(0, 10);
  return (
    rows
      .filter((row) => (!row.effective_from || row.effective_from <= day) && (!row.effective_to || row.effective_to >= day))
      .sort((a, b) => (b.effective_from ?? '').localeCompare(a.effective_from ?? '') || (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0] ?? null
  );
}

function mapFeePolicy(row: SupabaseFeePolicyRow | null): FeePolicy | null {
  if (!row) return null;
  const baseFee = nullableNumber(row.base_fee_won);
  const unitFee = nullableNumber(row.additional_fee_won);
  const dailyMax = nullableNumber(row.daily_max_fee_won);
  const explicitlyFree = row.notes?.includes('무료') === true;
  // A zero base fee can describe a free initial period. Do not classify the
  // whole parking lot as free unless the source says so explicitly.
  return {
    isFree: explicitlyFree,
    baseMinutes: nullableNumber(row.base_minutes),
    baseFee,
    unitMinutes: nullableNumber(row.additional_minutes),
    unitFee,
    dailyMax,
  };
}

function sourceName(rows: SupabaseSourceMappingRow[] | null): string {
  if (!Array.isArray(rows) || rows.length === 0) return '정보 없음';
  return [...rows].sort((a, b) => (b.last_seen_at ?? '').localeCompare(a.last_seen_at ?? ''))[0]?.source_name || '정보 없음';
}

export function mapSupabaseParkingLot(row: SupabaseParkingLotRow, asOf = new Date()): ParkingLot {
  if (!row || typeof row.id !== 'string' || typeof row.name !== 'string') {
    throw new SupabaseParkingError('Supabase parking row has an invalid required field', 502, 'INVALID_ROW');
  }
  const liveStatus = typeof row.live_status === 'string' ? row.live_status : 'unknown';
  return {
    id: row.id,
    name: row.name,
    address: typeof row.address === 'string' ? row.address : null,
    lat: nullableNumber(row.latitude),
    lng: nullableNumber(row.longitude),
    operatingHours: typeof row.operating_hours === 'string' ? row.operating_hours : null,
    capacity: nullableNumber(row.total_spaces),
    fee: mapFeePolicy(activeFeePolicy(row.fee_policies, asOf)),
    liveSupported: liveStatus !== 'unknown' || typeof row.live_updated_at === 'string',
    source: sourceName(row.source_mappings),
  };
}

async function readRows(fetcher: FetchLike, requestUrl: URL, secretKey: string): Promise<SupabaseParkingLotRow[]> {
  let response: Response;
  try {
    response = await fetcher(requestUrl, {
      headers: { Accept: 'application/json', apikey: secretKey },
      cache: 'no-store',
    });
  } catch {
    throw new SupabaseParkingError('Supabase parking request failed', 503, 'NETWORK_ERROR');
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { code?: unknown } | null;
    const code = typeof payload?.code === 'string' ? payload.code : null;
    throw new SupabaseParkingError(`Supabase parking request returned HTTP ${response.status}`, response.status, code);
  }
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!Array.isArray(payload)) throw new SupabaseParkingError('Supabase parking response is not an array', 502, 'INVALID_RESPONSE');
  return payload as SupabaseParkingLotRow[];
}

function queryUrl(baseUrl: string, id?: string): URL {
  const url = new URL('/rest/v1/parking_lots', `${baseUrl.replace(/\/$/, '')}/`);
  url.searchParams.set('select', PARKING_SELECT);
  if (id) {
    url.searchParams.set('id', `eq.${id}`);
    url.searchParams.set('limit', '1');
  } else {
    url.searchParams.set('order', 'name.asc');
  }
  return url;
}

export function supabaseParking(baseUrl: string, secretKey: string, fetcher: FetchLike = fetch): ParkingDataProvider {
  return {
    async listNear() {
      const rows = await readRows(fetcher, queryUrl(baseUrl), secretKey);
      return rows.map((row) => mapSupabaseParkingLot(row));
    },
    async getLot(id) {
      const rows = await readRows(fetcher, queryUrl(baseUrl, id), secretKey);
      return rows[0] ? mapSupabaseParkingLot(rows[0]) : null;
    },
  };
}
