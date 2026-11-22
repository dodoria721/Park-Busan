import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicLive } from './real.ts';

const endpoint = 'https://apis.data.go.kr/B552587/ParkingInfoService_v2/getParkingInfoList_v2';

test('부산시설공단 응답 필드를 시설공단 코드 기준 LiveStatus로 변환', async () => {
  let requestedUrl = '';
  const provider = publicLive(endpoint, 'service-key', async (input) => {
    requestedUrl = String(input);
    return Response.json({
      response: {
        header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
        body: {
          totalCount: 2,
          items: {
            item: [
              { parkgcd: 'A01', parknm: '주차장 1', curravacnt: '12', maxcnt: '100', lastupdatetime: '2026-11-22 22:05:00' },
              { parkgcd: 'A02', parknm: '주차장 2', curravacnt: '101', maxcnt: '100', lastupdatetime: null },
            ],
          },
        },
      },
    });
  });

  const result = await provider.getStatus(['A01', 'A02', 'A03']);
  const requested = new URL(requestedUrl);
  assert.equal(requested.searchParams.get('serviceKey'), 'service-key');
  assert.equal(requested.searchParams.get('resultType'), 'json');
  assert.deepEqual(result.A01, { available: 12, total: 100, updatedAt: '2026-11-22T13:05:00.000Z' });
  assert.deepEqual(result.A02, { available: null, total: 100, updatedAt: null });
  assert.equal(result.A03, undefined);
});

test('부산시설공단 오류와 누락된 페이지를 성공으로 숨기지 않음', async () => {
  const apiError = publicLive(endpoint, 'service-key', async () =>
    Response.json({ response: { header: { resultCode: '30', resultMsg: 'SERVICE KEY IS NOT REGISTERED' } } }),
  );
  await assert.rejects(apiError.getStatus(['A01']), /부산시설공단 API 오류/);

  const partial = publicLive(endpoint, 'service-key', async () =>
    Response.json({
      response: {
        header: { resultCode: '00' },
        body: { totalCount: 2, items: { item: [{ parkgcd: 'A01', parknm: '주차장', curravacnt: 1, maxcnt: 2, lastupdatetime: null }] } },
      },
    }),
  );
  await assert.rejects(partial.getStatus(['A01']), /일부 페이지가 누락/);
});
