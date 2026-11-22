// NFR-007~008: 외부 연동은 아래 인터페이스 뒤에 둔다.
// 환경 변수가 모두 있을 때만 실제 구현을 고르고, 없으면 Mock으로 동작한다.
import type { LatLng, LiveStatus, LiveView, FeeResult, ParkingLot, Place, SearchConditions } from '@parkbusan/shared';
import { mockAI } from './mock-ai.ts';
import { mockGeo, mockLive, mockParking } from './mock-data.ts';
import { kakaoGeo, openAI, publicLive, supabaseParking } from './real.ts';
import { logError, withTimeout } from './http.ts';
import { createRealtimeProviders } from './realtime-parking.ts';

export interface ParkingDataProvider {
  /** 반경 안의 후보. 최종 거리 필터는 Recommender가 다시 적용한다. */
  listNear(center: LatLng, radiusM: number): Promise<ParkingLot[]>;
  getLot(id: string): Promise<ParkingLot | null>;
}

export interface LiveProvider {
  /** id → 실시간 상태. 응답에 없는 id는 "확인 불가"로 처리된다. 전체 실패는 throw. */
  getStatus(lotIds: string[]): Promise<Record<string, LiveStatus>>;
}

export interface GeoProvider {
  searchPlaces(query: string): Promise<Place[]>;
}

/** 설명 생성에 넘기는 사실. 서버가 조회·계산한 값만 담는다(AI-REQ-01). */
export interface ExplainFacts {
  name: string;
  distanceM: number;
  durationMinutes: number;
  budget: number | null;
  fee: FeeResult;
  live: LiveView;
}

export interface AIProvider {
  /** 마스킹된 질의에서 바뀐 조건만 담은 JSON 문자열을 돌려준다. 검증은 호출하는 쪽에서 한다. */
  extractConditions(maskedQuery: string, previous: SearchConditions | null): Promise<string>;
  explain(facts: ExplainFacts): Promise<string>;
}

const env = process.env;

export type ParkingProviderName = 'mock' | 'supabase' | 'supabase-misconfigured' | 'edge-function' | 'edge-function-misconfigured';
export interface ParkingProviderEnvironment {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PARKING_REALTIME_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
}

function misconfiguredParking(): ParkingDataProvider {
  const error = () => Promise.reject(new Error('Supabase parking environment is incomplete'));
  return { listNear: error, getLot: error };
}

export function selectParkingProvider(source: ParkingProviderEnvironment): { provider: ParkingDataProvider; name: ParkingProviderName; live?: LiveProvider } {
  const realtimeUrl = source.PARKING_REALTIME_URL?.trim();
  if (realtimeUrl) {
    const key = source.SUPABASE_PUBLISHABLE_KEY?.trim() || source.SUPABASE_SECRET_KEY?.trim() || source.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!key) return { provider: misconfiguredParking(), name: 'edge-function-misconfigured' };
    const realtime = createRealtimeProviders(realtimeUrl, key);
    return { provider: realtime.parking, live: realtime.live, name: 'edge-function' };
  }
  const url = source.SUPABASE_URL?.trim();
  const secret = source.SUPABASE_SECRET_KEY?.trim() || source.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url && !secret) return { provider: mockParking, name: 'mock' };
  if (!url || !secret) return { provider: misconfiguredParking(), name: 'supabase-misconfigured' };
  return { provider: supabaseParking(url, secret), name: 'supabase' };
}

const selectedParking = selectParkingProvider({
  SUPABASE_URL: env.SUPABASE_URL,
  SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY,
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
  PARKING_REALTIME_URL: env.PARKING_REALTIME_URL,
  SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_PUBLISHABLE_KEY,
});
export const parkingData = selectedParking.provider;

export const live: LiveProvider = selectedParking.live ?? (
  env.BUSAN_LIVE_API_URL && env.BUSAN_LIVE_API_KEY
    ? publicLive(env.BUSAN_LIVE_API_URL, env.BUSAN_LIVE_API_KEY)
    : mockLive);

export const geo: GeoProvider = env.KAKAO_REST_API_KEY ? kakaoGeo(env.KAKAO_REST_API_KEY) : mockGeo;

export const ai: AIProvider =
  env.OPENAI_API_KEY && env.OPENAI_MODEL ? openAI(env.OPENAI_API_KEY, env.OPENAI_MODEL) : mockAI;

export const providerNames = {
  parking: selectedParking.name,
  live: selectedParking.live ? 'edge-function' : live === mockLive ? 'mock' : 'busan-public-api',
  geo: geo === mockGeo ? 'mock' : 'kakao',
  ai: ai === mockAI ? 'mock' : 'openai',
};

export const LIVE_WARNING = '실시간 주차 정보를 불러오지 못했습니다. 주차 가능 여부는 확인 불가로 표시하며, 기본 정보와 요금은 그대로 제공합니다.';

/**
 * 실시간 조회(제한 시간 1.5초). 실패하면 null을 돌려 "확인 불가" + 경고로 처리한다(FR-017).
 * Edge Function Provider는 목록·상세와 함께 최대 30초의 응답 캐시를 공유한다.
 */
export async function fetchLive(lots: ParkingLot[]): Promise<Record<string, LiveStatus> | null> {
  const ids = lots.filter((l) => l.liveSupported).map((l) => l.id);
  if (ids.length === 0) return {};
  try {
    return await withTimeout(live.getStatus(ids), 1500);
  } catch (e) {
    logError('live', e);
    return null;
  }
}
