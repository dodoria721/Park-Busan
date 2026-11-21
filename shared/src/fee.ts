import type { FeePolicy, FeeResult } from './types.ts';

const DAY = 24 * 60;

/**
 * 예상 요금 계산 (FR-008).
 * 기본시간 이하 → 기본요금, 초과분은 추가 단위로 올림, 일 최대요금으로 상한.
 * 1일 초과·시간대별·할인 정책은 추정하지 않고 계산 불가로 둔다.
 */
export function calculateFee(policy: FeePolicy | null, minutes: number): FeeResult {
  if (!Number.isFinite(minutes) || minutes <= 0) return unknown('주차 시간이 올바르지 않음');
  if (!policy) return unknown('요금 정보 없음');
  if (policy.isFree) return { status: 'ok', fee: 0 };
  if (minutes > DAY) return unknown('1일 초과 요금은 지원하지 않음');

  const { baseMinutes, baseFee, unitMinutes, unitFee, dailyMax } = policy;
  if (baseMinutes == null || baseFee == null) return unknown('기본요금 정보 없음');

  let fee = baseFee;
  if (minutes > baseMinutes) {
    if (!unitMinutes || unitFee == null) return unknown('추가요금 정보 없음');
    fee += Math.ceil((minutes - baseMinutes) / unitMinutes) * unitFee;
  }
  if (dailyMax != null) fee = Math.min(fee, dailyMax);
  return { status: 'ok', fee };
}

function unknown(reason: string): FeeResult {
  return { status: 'unknown', reason };
}
