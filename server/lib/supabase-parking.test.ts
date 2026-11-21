import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mockParking } from './mock-data.ts';
import { selectParkingProvider } from './providers.ts';
import {
  mapSupabaseParkingLot,
  SupabaseParkingError,
  supabaseParking,
  type SupabaseParkingLotRow,
} from './supabase-parking.ts';

const fixture: SupabaseParkingLotRow = {
  id: '00000000-0000-0000-0000-000000000001',
  external_id: 'busan-1',
  name: '부산 공영주차장',
  address: '부산광역시 부산진구',
  latitude: 35.1578,
  longitude: 129.06,
  total_spaces: 120,
  operating_hours: '24시간',
  live_status: 'unknown',
  live_updated_at: null,
  fee_policies: [
    {
      id: 'fee-1',
      base_minutes: 30,
      base_fee_won: 1000,
      additional_minutes: 10,
      additional_fee_won: 500,
      daily_max_fee_won: 10000,
      notes: null,
      effective_from: '2026-01-01',
      effective_to: null,
      created_at: '2026-01-01T00:00:00Z',
    },
  ],
  source_mappings: [{ source_name: '전국주차장정보표준데이터', last_seen_at: '2026-11-20T00:00:00Z' }],
};

test('Supabase 행을 shared ParkingLot과 FeePolicy로 변환', () => {
  assert.deepEqual(mapSupabaseParkingLot(fixture, new Date('2026-11-21T00:00:00Z')), {
    id: fixture.id,
    name: fixture.name,
    address: fixture.address,
    lat: fixture.latitude,
    lng: fixture.longitude,
    operatingHours: fixture.operating_hours,
    capacity: fixture.total_spaces,
    fee: { isFree: false, baseMinutes: 30, baseFee: 1000, unitMinutes: 10, unitFee: 500, dailyMax: 10000 },
    liveSupported: false,
    source: '전국주차장정보표준데이터',
  });
});

test('요금 정책과 선택 필드가 없으면 임의 값을 만들지 않음', () => {
  const lot = mapSupabaseParkingLot({
    ...fixture,
    address: null,
    latitude: null,
    longitude: null,
    total_spaces: null,
    operating_hours: null,
    fee_policies: null,
    source_mappings: null,
  });
  assert.equal(lot.address, null);
  assert.equal(lot.lat, null);
  assert.equal(lot.lng, null);
  assert.equal(lot.capacity, null);
  assert.equal(lot.operatingHours, null);
  assert.equal(lot.fee, null);
  assert.equal(lot.source, '정보 없음');
});

test('0원 기본요금만으로 무료 주차장이라고 단정하지 않음', () => {
  const lot = mapSupabaseParkingLot({
    ...fixture,
    fee_policies: [{ ...fixture.fee_policies![0], base_fee_won: 0, additional_minutes: null, additional_fee_won: null, daily_max_fee_won: null }],
  });
  assert.equal(lot.fee?.isFree, false);
});

test('원천 요금 정책에 무료가 명시된 경우에만 무료로 변환', () => {
  const lot = mapSupabaseParkingLot({
    ...fixture,
    fee_policies: [{ ...fixture.fee_policies![0], base_fee_won: 0, additional_fee_won: null, notes: '무료' }],
  });
  assert.equal(lot.fee?.isFree, true);
});

test('빈 Supabase 결과는 빈 목록과 null 상세로 처리', async () => {
  const seen: { authorization: string | null; apikey: string | null; url: string }[] = [];
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    seen.push({ authorization: headers.get('authorization'), apikey: headers.get('apikey'), url: String(input) });
    return Response.json([]);
  };
  const provider = supabaseParking('https://project.supabase.co', 'sb_secret_test', fetcher);
  assert.deepEqual(await provider.listNear({ lat: 35, lng: 129 }, 2000), []);
  assert.equal(await provider.getLot('missing'), null);
  assert.equal(seen[0]?.apikey, 'sb_secret_test');
  assert.equal(seen[0]?.authorization, null);
  assert.match(seen[0]?.url ?? '', /fee_policies/);
});

test('잘못된 Secret Key 오류를 전달하고 Mock으로 전환하지 않음', async () => {
  const provider = supabaseParking('https://project.supabase.co', 'sb_secret_wrong', async () =>
    Response.json({ message: 'Invalid API key' }, { status: 401 }),
  );
  await assert.rejects(
    provider.listNear({ lat: 35, lng: 129 }, 2000),
    (error: unknown) => error instanceof SupabaseParkingError && error.status === 401,
  );
});

test('Provider 선택: Secret 우선, legacy 호환, 불완전 설정은 명시적 오류', async () => {
  assert.equal(selectParkingProvider({}).provider, mockParking);
  assert.equal(selectParkingProvider({ SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_x' }).name, 'supabase');
  assert.equal(selectParkingProvider({ SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'legacy' }).name, 'supabase');
  const incomplete = selectParkingProvider({ SUPABASE_URL: 'https://project.supabase.co' });
  assert.equal(incomplete.name, 'supabase-misconfigured');
  await assert.rejects(incomplete.provider.listNear({ lat: 35, lng: 129 }, 2000));
});

