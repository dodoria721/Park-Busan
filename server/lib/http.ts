import type { ApiError, LatLng } from '@parkbusan/shared';

/** 표준 오류 응답: { error: { code, message } } */
export function fail(status: number, code: string, message: string): Response {
  const body: ApiError = { error: { code, message } };
  return Response.json(body, { status });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

export function isInt(v: unknown, min: number, max: number): v is number {
  return Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
}

export function asLatLng(v: unknown): LatLng | null {
  if (typeof v !== 'object' || v === null) return null;
  const { lat, lng } = v as Record<string, unknown>;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) return null;
  return { lat, lng };
}

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

/** 서버 로그. 사용자 질의 원문은 남기지 않는다(AI-REQ-03). */
export function logError(where: string, e: unknown): void {
  console.error(`[${where}]`, e instanceof Error ? e.message : String(e));
}
