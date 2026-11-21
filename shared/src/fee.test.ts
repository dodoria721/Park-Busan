import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateFee } from './fee.ts';
import type { FeePolicy } from './types.ts';

// 기본 30분 1,000원, 10분당 300원, 일 최대 20,000원
const policy: FeePolicy = {
  isFree: false,
  baseMinutes: 30,
  baseFee: 1000,
  unitMinutes: 10,
  unitFee: 300,
  dailyMax: 20000,
};
const fee = (p: FeePolicy | null, m: number) => {
  const r = calculateFee(p, m);
  return r.status === 'ok' ? r.fee : 'unknown';
};

test('기본시간 전후', () => {
  assert.equal(fee(policy, 1), 1000);
  assert.equal(fee(policy, 30), 1000);
  assert.equal(fee(policy, 31), 1300);
});

test('추가 단위 경계는 올림', () => {
  assert.equal(fee(policy, 40), 1300);
  assert.equal(fee(policy, 41), 1600);
  assert.equal(fee(policy, 120), 1000 + 9 * 300);
});

test('일 최대요금 상한', () => {
  assert.equal(fee(policy, 1440), 20000);
  assert.equal(fee({ ...policy, dailyMax: null }, 1440), 1000 + 141 * 300);
});

test('1일 초과는 추정하지 않음', () => {
  assert.equal(fee(policy, 1441), 'unknown');
});

test('무료는 0원', () => {
  assert.equal(fee({ ...policy, isFree: true, baseFee: null }, 300), 0);
});

test('정보 누락은 계산 불가', () => {
  assert.equal(fee(null, 60), 'unknown');
  assert.equal(fee({ ...policy, baseFee: null }, 10), 'unknown');
  assert.equal(fee({ ...policy, baseMinutes: null }, 10), 'unknown');
  // 추가요금이 없어도 기본시간 안이면 계산 가능
  assert.equal(fee({ ...policy, unitFee: null }, 30), 1000);
  assert.equal(fee({ ...policy, unitFee: null }, 31), 'unknown');
  assert.equal(fee({ ...policy, unitMinutes: null }, 31), 'unknown');
});

test('잘못된 시간', () => {
  assert.equal(fee(policy, 0), 'unknown');
  assert.equal(fee(policy, Number.NaN), 'unknown');
});
