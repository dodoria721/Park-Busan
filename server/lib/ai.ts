// AI 처리 흐름(개발계획서 3.2): 마스킹 → 조건 추출 → JSON 검증(1회 재시도) → 이전 조건과 병합.
// 설명은 서버가 조회·계산한 사실만 넘기고, 그 외 숫자가 섞이면 정형 문구로 바꾼다.
import {
  formatDistance,
  formatFee,
  formatLive,
  formatMinutes,
  maskPersonalInfo,
  type SearchConditions,
} from '@parkbusan/shared';
import type { AIProvider, ExplainFacts } from './providers.ts';
import { withTimeout } from './http.ts';

const KEYS = ['destination', 'durationMinutes', 'budget'] as const;
export const MAX_MINUTES = 7 * 24 * 60;
export const MAX_BUDGET = 1_000_000;

/** 조건 JSON 스키마 검증. 모든 키는 선택이며, 정의되지 않은 키가 있으면 거부한다. */
export function validateConditions(v: unknown): Partial<SearchConditions> | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (Object.keys(o).some((k) => !(KEYS as readonly string[]).includes(k))) return null;
  const out: Partial<SearchConditions> = {};
  if ('destination' in o) {
    const d = o.destination;
    if (d === null) out.destination = null;
    else if (typeof d === 'string' && d.trim() && d.length <= 50) out.destination = d.trim();
    else return null;
  }
  if ('durationMinutes' in o) {
    const d = o.durationMinutes;
    if (d === null || (Number.isInteger(d) && (d as number) > 0 && (d as number) <= MAX_MINUTES))
      out.durationMinutes = d as number | null;
    else return null;
  }
  if ('budget' in o) {
    const b = o.budget;
    if (b === null || (Number.isInteger(b) && (b as number) >= 0 && (b as number) <= MAX_BUDGET))
      out.budget = b as number | null;
    else return null;
  }
  return out;
}

/**
 * 스키마를 만족하는 결과가 나올 때까지 최대 2회(=1회 재시도) 호출한다. 전체 제한 시간은 5초.
 * 실패하면 null → 호출한 쪽에서 수동 입력을 안내한다(FR-018, AI-REQ-07).
 */
export async function extractWithRetry(
  ai: AIProvider,
  query: string,
  previous: SearchConditions | null,
  totalMs = 5000,
): Promise<Partial<SearchConditions> | null> {
  const masked = maskPersonalInfo(query);
  const deadline = Date.now() + totalMs;
  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      const raw = await withTimeout(ai.extractConditions(masked, previous), remaining);
      const parsed = validateConditions(JSON.parse(raw));
      if (parsed) return parsed;
    } catch {
      // 다음 시도로 넘어간다
    }
  }
  return null;
}

export function templateExplanation(f: ExplainFacts): string {
  const parts = [
    `목적지에서 직선거리 ${formatDistance(f.distanceM)}`,
    `${formatMinutes(f.durationMinutes)} 주차 시 예상 요금 ${formatFee(f.fee)}`,
  ];
  if (f.budget != null && f.fee.status === 'ok') parts.push(`예산 ${f.budget.toLocaleString('ko-KR')}원 이내`);
  parts.push(formatLive(f.live));
  return `${f.name}: ${parts.join(', ')}.`;
}

const numbersIn = (s: string) => (s.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => String(Number(n.replace(/,/g, ''))));

/** AI-REQ-01: 설명문에 사실에 없는 숫자가 있으면 근거 없는 응답으로 본다. */
export function isGrounded(text: string, f: ExplainFacts): boolean {
  const allowed = new Set([...numbersIn(templateExplanation(f)), ...numbersIn(f.name), String(f.distanceM)]);
  return numbersIn(text).every((n) => allowed.has(n));
}

export async function explainWithFallback(ai: AIProvider, f: ExplainFacts): Promise<{ text: string; fallback: boolean }> {
  try {
    const text = (await withTimeout(ai.explain(f), 5000)).trim();
    if (text && isGrounded(text, f)) return { text, fallback: false };
  } catch {
    // 정형 문구로 대체
  }
  return { text: templateExplanation(f), fallback: true };
}
