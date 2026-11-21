import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommend, toLiveView } from './recommend.ts';
import { maskPersonalInfo } from './mask.ts';
import type { FeePolicy, LiveStatus, ParkingLot } from './types.ts';

const DEST = { lat: 35.1578, lng: 129.06 };
const NOW = new Date('2026-11-21T12:00:00Z');
const M_PER_DEG_LAT = (6371000 * Math.PI) / 180;

// 기본 60분 1,000원, 30분당 500원 → 2시간 2,000원
const cheap: FeePolicy = { isFree: false, baseMinutes: 60, baseFee: 1000, unitMinutes: 30, unitFee: 500, dailyMax: null };

function lot(id: string, metersNorth: number, over: Partial<ParkingLot> = {}): ParkingLot {
  return {
    id,
    name: id,
    address: null,
    lat: DEST.lat + metersNorth / M_PER_DEG_LAT,
    lng: DEST.lng,
    operatingHours: null,
    capacity: null,
    fee: cheap,
    liveSupported: false,
    source: 'test',
    ...over,
  };
}
const ago = (min: number) => new Date(NOW.getTime() - min * 60000).toISOString();
const run = (lots: ParkingLot[], budget: number | null, live: Record<string, LiveStatus> | null = {}) =>
  recommend({ destination: DEST, durationMinutes: 120, budget, lots, live, now: NOW });
const ids = (cs: { lot: ParkingLot }[]) => cs.map((c) => c.lot.id);

test('반경 2km 경계: 2000m 포함, 2001m 제외, 좌표 없음 제외', () => {
  const r = run([lot('in', 2000), lot('out', 2001), lot('nocoord', 0, { lat: null })], null);
  assert.deepEqual(ids(r.all), ['in']);
  assert.equal(r.all[0].distanceM, 2000);
});

test('유효한 실시간 정보로 확인된 만차만 제외', () => {
  const lots = [
    lot('full', 100, { liveSupported: true }),
    lot('stale', 200, { liveSupported: true }),
    lot('noTime', 300, { liveSupported: true }),
    lot('ok', 400, { liveSupported: true }),
    lot('nolive', 500),
  ];
  const live: Record<string, LiveStatus> = {
    full: { available: 0, total: 50, updatedAt: ago(1) },
    stale: { available: 0, total: 50, updatedAt: ago(6) },
    noTime: { available: 0, total: 50, updatedAt: null },
    ok: { available: 3, total: 50, updatedAt: ago(5) },
  };
  const r = run(lots, null, live);
  assert.deepEqual(ids(r.all), ['stale', 'noTime', 'ok', 'nolive']);
  assert.equal(r.excluded.full, 1);
  assert.deepEqual(
    r.all.map((c) => c.live.state),
    ['stale', 'stale', 'ok', 'unsupported'],
  );
});

test('실시간 조회 실패 시 확인 불가로 두고 제외하지 않음', () => {
  const r = run([lot('a', 100, { liveSupported: true })], null, null);
  assert.equal(r.all[0].live.state, 'error');
});

test('예산: 같으면 포함, 초과 제외, 계산 불가는 별도 목록', () => {
  const lots = [
    lot('eq', 100), // 2,000원
    lot('over', 200, { fee: { ...cheap, baseFee: 1001 } }),
    lot('unknown', 300, { fee: null }),
    lot('free', 400, { fee: { ...cheap, isFree: true } }),
  ];
  const r = run(lots, 2000);
  assert.deepEqual(ids(r.all), ['eq', 'free']);
  assert.deepEqual(ids(r.needsCheck), ['unknown']);
  assert.equal(r.excluded.overBudget, 1);
});

test('예산 없음: 계산 불가 포함, 같은 거리에서는 확인된 요금 우선', () => {
  const lots = [lot('a-unknown', 100, { fee: null }), lot('b-known', 100)];
  const r = run(lots, null);
  assert.deepEqual(ids(r.all), ['b-known', 'a-unknown']);
  assert.equal(r.needsCheck.length, 0);
});

test('정렬: 거리 → 요금 → 내부 ID', () => {
  const pricey = { ...cheap, baseFee: 3000 };
  const lots = [lot('c', 100), lot('b', 100), lot('a', 100, { fee: pricey }), lot('near', 50, { fee: pricey })];
  assert.deepEqual(ids(run(lots, null).all), ['near', 'b', 'c', 'a']);
});

test('상위 5개와 전체 목록', () => {
  const lots = Array.from({ length: 7 }, (_, i) => lot(`l${i}`, 100 * (7 - i)));
  const r = run(lots, null);
  assert.equal(r.top.length, 5);
  assert.equal(r.all.length, 7);
  assert.deepEqual(ids(r.top), ['l6', 'l5', 'l4', 'l3', 'l2']);
});

test('검색 결과 없음', () => {
  const r = run([lot('far', 5000)], 1000);
  assert.equal(r.all.length, 0);
  assert.equal(r.top.length, 0);
});

test('방금 갱신된 정보는 ok', () => {
  const v = toLiveView(lot('x', 0, { liveSupported: true }), { x: { available: 1, total: 2, updatedAt: ago(0) } }, NOW);
  assert.equal(v.state, 'ok');
});

test('개인정보 마스킹 (AI-REQ-03)', () => {
  assert.equal(
    maskPersonalInfo('12가3456 차량, 010-1234-5678로 연락. 서면역 2시간 5000원'),
    '[차량번호] 차량, [전화번호]로 연락. 서면역 2시간 5000원',
  );
  assert.equal(maskPersonalInfo('123 가 4567 / 01012345678 / 051-123-4567'), '[차량번호] / [전화번호] / [전화번호]');
});
