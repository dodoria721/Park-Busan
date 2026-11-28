import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommend, type ParkingLot } from '@parkbusan/shared';
import { resultGroups } from './result-groups.ts';

const destination = { lat: 35.157939, lng: 129.059301 };
const now = new Date('2026-11-28T12:00:00Z');
const liveLot: ParkingLot = {
  id: 'live', name: '부전복개도로1', address: null, ...destination,
  operatingHours: null, capacity: 20, fee: null, liveSupported: true,
  liveSourceId: 'A43', source: 'busan_facilities_live',
};
const pricedLot: ParkingLot = {
  ...liveLot, id: 'priced', liveSupported: false,
  fee: { isFree: false, baseMinutes: 120, baseFee: 3000, unitMinutes: null, unitFee: null, dailyMax: null },
};
function search(lots: ParkingLot[], budget: number | null, available = 15) {
  return {
    ...recommend({ destination, durationMinutes: 120, budget, lots, now,
      live: { live: { available, total: 20, updatedAt: now.toISOString() } } }),
    liveWarning: null,
  };
}

test('예산 검색에서도 요금 없는 실시간 시설이 별도 상단 목록에 남는다', () => {
  const result = search([pricedLot, liveLot], 5000);
  const groups = resultGroups(result);
  assert.deepEqual(result.top.map(c => c.lot.id), ['priced']);
  assert.deepEqual(groups.liveNeedsCheck.map(c => c.lot.id), ['live']);
  assert.equal(groups.liveNeedsCheck[0].live.state, 'ok');
  assert.equal(groups.total, 2);
  assert.equal(groups.liveCount, 1);
});

test('요금 확인 필요 시설만 있어도 빈 검색 결과로 표시하지 않는다', () => {
  const result = search([liveLot], 5000);
  assert.equal(result.all.length, 0);
  assert.equal(resultGroups(result).total, 1);
});

test('예산 미설정 시 기존 추천과 중복해서 표시하지 않는다', () => {
  const result = search([liveLot], null);
  assert.equal(result.all[0].lot.id, 'live');
  assert.equal(resultGroups(result).liveNeedsCheck.length, 0);
});

test('만차와 예산 초과 시설은 실시간 목록에도 다시 나타나지 않는다', () => {
  const result = search([liveLot, pricedLot], 1000, 0);
  assert.deepEqual(result.excluded, { full: 1, overBudget: 1 });
  assert.equal(resultGroups(result).total, 0);
});
