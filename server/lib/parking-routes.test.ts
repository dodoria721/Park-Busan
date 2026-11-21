import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLotHandler, createRecommendHandler } from './parking-handlers.ts';
import type { ParkingDataProvider } from './providers.ts';

const apiFixture = {
  id: '00000000-0000-0000-0000-000000000001',
  name: '부산 공영주차장',
  address: '부산광역시 부산진구',
  lat: 35.1578,
  lng: 129.06,
  operatingHours: '24시간',
  capacity: 120,
  fee: { isFree: false, baseMinutes: 30, baseFee: 1000, unitMinutes: 10, unitFee: 500, dailyMax: 10000 },
  liveSupported: false,
  source: '전국주차장정보표준데이터',
};

const empty: ParkingDataProvider = { listNear: async () => [], getLot: async () => null };
const broken: ParkingDataProvider = {
  listNear: async () => Promise.reject(new Error('db failed')),
  getLot: async () => Promise.reject(new Error('db failed')),
};

test('추천 API는 DB 0건을 정상 빈 결과로 반환', async () => {
  const handler = createRecommendHandler(empty, async () => ({}));
  const response = await handler(
    new Request('http://localhost/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination: { lat: 35.1578, lng: 129.06 }, durationMinutes: 120, budget: 5000 }),
    }),
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.top, []);
  assert.deepEqual(body.all, []);
});

test('추천 API는 DB 오류를 503으로 반환', async () => {
  const handler = createRecommendHandler(broken);
  const response = await handler(
    new Request('http://localhost/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination: { lat: 35.1578, lng: 129.06 }, durationMinutes: 120, budget: null }),
    }),
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'PARKING_DATA_FAILED');
});

test('상세 API 계약은 Mapper 결과와 null 요금을 유지', async () => {
  const provider: ParkingDataProvider = { listNear: async () => [apiFixture], getLot: async () => apiFixture };
  const handler = createLotHandler(provider, async () => ({}));
  const response = await handler(new Request('http://localhost/api/parking-lots/id'), { params: Promise.resolve({ id: apiFixture.id }) });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.lot.id, apiFixture.id);
  assert.equal(body.fee, null);
});

test('상세 API는 없는 행 404, DB 오류 503을 구분', async () => {
  const notFound = await createLotHandler(empty)(new Request('http://localhost/api/parking-lots/missing'), {
    params: Promise.resolve({ id: 'missing' }),
  });
  assert.equal(notFound.status, 404);
  const failed = await createLotHandler(broken)(new Request('http://localhost/api/parking-lots/id'), {
    params: Promise.resolve({ id: 'id' }),
  });
  assert.equal(failed.status, 503);
});
