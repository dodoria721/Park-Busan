import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRealtimeLiveProvider, realtimeTimestamp } from './realtime-parking.ts';
import { selectLiveProvider, selectParkingProvider } from './providers.ts';

const edgeUrl = 'https://example.supabase.co/functions/v1/parking-realtime';
const busanUrl = 'https://apis.data.go.kr/B552587/ParkingInfoService_v2/getParkingInfoList_v2';
const row = {
  code: 'A01',
  name: '반송1, 3동 공영',
  totalSpaces: 152,
  occupiedSpaces: 101,
  availableSpaces: 51,
  lastUpdated: '2026-11-22 22:05:00',
};
const response = (rows = [row]) => Response.json({ success: true, parkingLots: rows });

test('Edge Function 설정은 Supabase UUID Parking Provider를 대체하지 않음', () => {
  const selected = selectParkingProvider({
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SECRET_KEY: 'sb_secret_test',
    PARKING_REALTIME_URL: edgeUrl,
    SUPABASE_PUBLISHABLE_KEY: 'publishable-test',
  });
  assert.equal(selected.name, 'supabase');
});

test('부산시설공단 직접 API가 Edge Function보다 우선하고 불완전 설정은 오류 Provider가 됨', async () => {
  assert.equal(
    selectLiveProvider({
      BUSAN_LIVE_API_URL: busanUrl,
      BUSAN_LIVE_API_KEY: 'service-key',
      PARKING_REALTIME_URL: edgeUrl,
      SUPABASE_PUBLISHABLE_KEY: 'publishable-test',
    }).name,
    'busan-public-api',
  );
  assert.equal(
    selectLiveProvider({ PARKING_REALTIME_URL: edgeUrl, SUPABASE_PUBLISHABLE_KEY: 'publishable-test' }).name,
    'edge-function',
  );
  const incomplete = selectLiveProvider({ PARKING_REALTIME_URL: edgeUrl });
  assert.equal(incomplete.name, 'edge-function-misconfigured');
  await assert.rejects(incomplete.provider.getStatus(['A01']));
});

test('Edge Function은 apikey 헤더를 쓰고 시설공단 코드 기준 실시간 상태만 반환', async () => {
  const provider = createRealtimeLiveProvider(edgeUrl, 'publishable-test', async (_url, options) => {
    assert.equal(new Headers(options?.headers).get('apikey'), 'publishable-test');
    return response();
  });
  const live = await provider.getStatus(['A01', 'missing']);
  assert.deepEqual(live.A01, {
    available: 51,
    total: 152,
    updatedAt: '2026-11-22T13:05:00.000Z',
  });
  assert.equal(live.missing, undefined);
});

test('날짜를 한국 시각에서 ISO로 변환하고 잘못된 시각은 null 처리', () => {
  assert.equal(realtimeTimestamp(row.lastUpdated), '2026-11-22T13:05:00.000Z');
  assert.equal(realtimeTimestamp('2026-11-22T13:05:00Z'), '2026-11-22T13:05:00.000Z');
  assert.equal(realtimeTimestamp('invalid'), null);
  assert.equal(realtimeTimestamp(null), null);
});

test('동시 요청은 30초 동안 한 응답을 공유하고 만료 후 오류를 전달', async () => {
  let requests = 0;
  let time = 0;
  const provider = createRealtimeLiveProvider(
    edgeUrl,
    'publishable-test',
    async () => {
      requests++;
      if (requests > 1) return Response.json({ secret: 'must-not-leak' }, { status: 502 });
      return response();
    },
    () => time,
  );
  await Promise.all([provider.getStatus(['A01']), provider.getStatus(['A01']), provider.getStatus(['A01'])]);
  assert.equal(requests, 1);
  time = 30_001;
  await assert.rejects(provider.getStatus(['A01']), /Parking Edge Function HTTP 502/);
  assert.equal(requests, 2);
});

test('원천 API의 실패·잘못된 응답·음수 면수는 Mock으로 대체하지 않음', async () => {
  for (const body of [
    { success: false, parkingLots: [] },
    { success: true, parkingLots: [{ ...row, availableSpaces: -1 }] },
  ]) {
    const provider = createRealtimeLiveProvider(edgeUrl, 'publishable-test', async () => Response.json(body));
    await assert.rejects(provider.getStatus(['A01']));
  }
});
