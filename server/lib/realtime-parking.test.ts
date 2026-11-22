import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recommend, toLiveView } from '@parkbusan/shared';
import { createRealtimeProviders, realtimeTimestamp } from './realtime-parking.ts';
import { selectParkingProvider } from './providers.ts';

const url = 'https://example.supabase.co/functions/v1/parking-realtime';
const row = { code: 'A01', name: '반송1, 3동 공영', totalSpaces: 152, occupiedSpaces: 101, availableSpaces: 51, lastUpdated: '2026-11-22 22:05:00' };
const response = (rows = [row]) => Response.json({ success: true, parkingLots: rows });

test('Edge Function 설정을 DB와 Mock보다 우선하고 키 누락은 실패', async () => {
  const selected = selectParkingProvider({ PARKING_REALTIME_URL: url, SUPABASE_PUBLISHABLE_KEY: 'test-key' });
  assert.equal(selected.name, 'edge-function');
  assert.ok(selected.live);
  const incomplete = selectParkingProvider({ PARKING_REALTIME_URL: url });
  assert.equal(incomplete.name, 'edge-function-misconfigured');
  await assert.rejects(incomplete.provider.getLot('A01'));
});

test('실제 코드와 공식 좌표를 연결하고 없는 요금은 생성하지 않음', async () => {
  const provider = createRealtimeProviders(url, 'test-key', async (_url, options) => {
    assert.equal(new Headers(options?.headers).get('apikey'), 'test-key');
    return response();
  });
  const lot = await provider.parking.getLot('A01');
  assert.ok(lot);
  assert.equal(lot.lat, 35.219446);
  assert.equal(lot.lng, 129.153934);
  assert.equal(lot.fee, null);
  assert.equal(lot.capacity, 152);
  assert.equal(lot.id, 'A01');
  const live = await provider.live.getStatus(['A01']);
  assert.equal(live.A01.available, 51);
  assert.equal(live.A01.updatedAt, '2026-11-22T13:05:00.000Z');
  assert.equal(toLiveView(lot, live, new Date('2026-11-22T13:06:00Z')).state, 'ok');
  assert.equal(toLiveView(lot, live, new Date('2026-11-22T13:11:00Z')).state, 'stale');
});

test('날짜를 한국 시각에서 ISO로 변환하고 잘못된 시각은 null 처리', () => {
  assert.equal(realtimeTimestamp(row.lastUpdated), '2026-11-22T13:05:00.000Z');
  assert.equal(realtimeTimestamp('2026-11-22T13:05:00Z'), '2026-11-22T13:05:00.000Z');
  assert.equal(realtimeTimestamp('invalid'), null);
  assert.equal(realtimeTimestamp(null), null);
});

test('동시 목록·상세·실시간 요청은 30초 동안 한 응답을 공유하고 만료 후 실패를 전달', async () => {
  let requests = 0;
  let time = 0;
  const provider = createRealtimeProviders(url, 'test-key', async () => {
    requests++;
    if (requests > 1) return Response.json({ secret: 'must-not-leak' }, { status: 502 });
    return response();
  }, () => time);
  await Promise.all([provider.parking.listNear({ lat: 35, lng: 129 }, 2000), provider.parking.getLot('A01'), provider.live.getStatus(['A01'])]);
  assert.equal(requests, 1);
  time = 30_001;
  await assert.rejects(provider.parking.getLot('A01'), /Parking Edge Function HTTP 502/);
  assert.equal(requests, 2);
});

test('매칭할 수 없는 이름에는 좌표를 만들지 않고 상세 404와 빈 목록을 지원', async () => {
  const provider = createRealtimeProviders(url, 'test-key', async () => response([{ ...row, name: 'unmatched' }]));
  assert.equal((await provider.parking.getLot('A01'))?.lat, null);
  assert.equal(await provider.parking.getLot('missing'), null);
  assert.deepEqual(await provider.live.getStatus(['missing']), {});
  const empty = createRealtimeProviders(url, 'test-key', async () => response([]));
  assert.deepEqual(await empty.parking.listNear({ lat: 35, lng: 129 }, 2000), []);
});

test('실시간 만차 제외와 예산이 있을 때 요금 확인 필요 분류를 유지', async () => {
  let full = false;
  const get = async () => response([{ ...row, availableSpaces: full ? 0 : 51 }]);
  const input = { destination: { lat: 35.219446, lng: 129.153934 }, durationMinutes: 120, budget: 5000, now: new Date('2026-11-22T13:06:00Z') };
  async function run() {
    const provider = createRealtimeProviders(url, 'test-key', get);
    const lots = await provider.parking.listNear(input.destination, 2000);
    return recommend({ ...input, lots, live: await provider.live.getStatus(lots.map(l => l.id)) });
  }
  assert.equal((await run()).needsCheck[0]?.lot.id, 'A01');
  full = true;
  const result = await run();
  assert.equal(result.excluded.full, 1);
  assert.equal(result.needsCheck.length, 0);
});

test('원천 API의 실패·잘못된 응답·음수 면수는 Mock으로 대체하지 않음', async () => {
  for (const body of [{ success: false, parkingLots: [] }, { success: true, parkingLots: [{ ...row, availableSpaces: -1 }] }]) {
    const provider = createRealtimeProviders(url, 'test-key', async () => Response.json(body));
    await assert.rejects(provider.parking.getLot('A01'));
  }
});
