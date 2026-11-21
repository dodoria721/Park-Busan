import { calculateFee } from './fee.ts';
import { distanceMeters } from './geo.ts';
import type { Candidate, LatLng, LiveStatus, LiveView, ParkingLot, RecommendResponse } from './types.ts';

export const RADIUS_M = 2000;
export const TOP_N = 5;
export const LIVE_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * 실시간 응답을 화면·판단용 상태로 바꾼다.
 * live === null 이면 실시간 조회 자체가 실패한 것으로 본다.
 */
export function toLiveView(lot: ParkingLot, live: Record<string, LiveStatus> | null, now: Date): LiveView {
  if (!lot.liveSupported) return { state: 'unsupported' };
  const s = live?.[lot.id];
  if (!s) return { state: 'error' };
  const t = s.updatedAt ? Date.parse(s.updatedAt) : NaN;
  if (!s.updatedAt || Number.isNaN(t) || now.getTime() - t > LIVE_MAX_AGE_MS) {
    return { state: 'stale', available: s.available, total: s.total, updatedAt: s.updatedAt };
  }
  return { state: 'ok', available: s.available, total: s.total, updatedAt: s.updatedAt };
}

export function isConfirmedFull(v: LiveView): boolean {
  return v.state === 'ok' && v.available === 0;
}

export interface RecommendInput {
  destination: LatLng;
  durationMinutes: number;
  budget: number | null;
  lots: ParkingLot[];
  live: Record<string, LiveStatus> | null;
  now: Date;
}

/** 개발계획서 3.1 추천 규칙 (FR-005, FR-008~012) */
export function recommend(input: RecommendInput): Omit<RecommendResponse, 'liveWarning'> {
  const { destination, durationMinutes, budget, lots, live, now } = input;
  const included: Candidate[] = [];
  const needsCheck: Candidate[] = [];
  const excluded = { full: 0, overBudget: 0 };

  for (const lot of lots) {
    if (lot.lat == null || lot.lng == null) continue; // 좌표가 없으면 거리 계산 불가
    const distanceM = Math.round(distanceMeters(destination, { lat: lot.lat, lng: lot.lng }));
    if (distanceM > RADIUS_M) continue;

    const c: Candidate = {
      lot,
      distanceM,
      fee: calculateFee(lot.fee, durationMinutes),
      live: toLiveView(lot, live, now),
    };
    if (isConfirmedFull(c.live)) {
      excluded.full++;
      continue;
    }
    if (budget != null) {
      if (c.fee.status === 'unknown') {
        needsCheck.push(c);
        continue;
      }
      if (c.fee.fee > budget) {
        excluded.overBudget++;
        continue;
      }
    }
    included.push(c);
  }

  included.sort(compare);
  needsCheck.sort(compare);
  return { top: included.slice(0, TOP_N), all: included, needsCheck, excluded };
}

// 거리 → 요금(계산 불가는 뒤로) → 내부 ID
function compare(a: Candidate, b: Candidate): number {
  return (
    a.distanceM - b.distanceM ||
    feeKey(a) - feeKey(b) ||
    (a.lot.id < b.lot.id ? -1 : a.lot.id > b.lot.id ? 1 : 0)
  );
}

function feeKey(c: Candidate): number {
  return c.fee.status === 'ok' ? c.fee.fee : Number.POSITIVE_INFINITY;
}
