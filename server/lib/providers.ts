// NFR-007~008: 외부 연동은 아래 인터페이스 뒤에 둔다.
// 환경 변수가 모두 있을 때만 실제 구현을 고르고, 없으면 Mock으로 동작한다.
import type { LatLng, LiveStatus, LiveView, FeeResult, ParkingLot, Place, SearchConditions } from '@parkbusan/shared';
import { mockAI } from './mock-ai.ts';
import { mockGeo, mockLive, mockParking } from './mock-data.ts';
import { kakaoGeo, openAI, publicLive, supabaseParking } from './real.ts';
import { logError, withTimeout } from './http.ts';
import { createRealtimeLiveProvider } from './realtime-parking.ts';

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

export type ParkingProviderName = 'mock' | 'supabase' | 'supabase-misconfigured';
export interface ParkingProviderEnvironment {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PARKING_REALTIME_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
}

export type LiveProviderName = 'mock' | 'busan-public-api' | 'busan-public-api-misconfigured' | 'edge-function' | 'edge-function-misconfigured';
export interface LiveProviderEnvironment extends ParkingProviderEnvironment {
  BUSAN_LIVE_API_URL?: string;
  BUSAN_LIVE_API_KEY?: string;
}

function misconfiguredParking(): ParkingDataProvider {
  const error = () => Promise.reject(new Error('Supabase parking environment is incomplete'));
  return { listNear: error, getLot: error };
}

export function selectParkingProvider(source: ParkingProviderEnvironment): { provider: ParkingDataProvider; name: ParkingProviderName } {
  const url = source.SUPABASE_URL?.trim();
  const secret = source.SUPABASE_SECRET_KEY?.trim() || source.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url && !secret) return { provider: mockParking, name: 'mock' };
  if (!url || !secret) return { provider: misconfiguredParking(), name: 'supabase-misconfigured' };
  return { provider: supabaseParking(url, secret), name: 'supabase' };
}

function misconfiguredLive(message: string): LiveProvider {
  return { getStatus: () => Promise.reject(new Error(message)) };
}

export function selectLiveProvider(source: LiveProviderEnvironment): { provider: LiveProvider; name: LiveProviderName } {
  const busanUrl = source.BUSAN_LIVE_API_URL?.trim();
  const busanKey = source.BUSAN_LIVE_API_KEY?.trim();
  if (busanUrl || busanKey) {
    if (!busanUrl || !busanKey) {
      return { provider: misconfiguredLive('Busan live parking environment is incomplete'), name: 'busan-public-api-misconfigured' };
    }
    return { provider: publicLive(busanUrl, busanKey), name: 'busan-public-api' };
  }

  const realtimeUrl = source.PARKING_REALTIME_URL?.trim();
  const realtimeKey =
    source.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    source.SUPABASE_SECRET_KEY?.trim() ||
    source.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (realtimeUrl || source.SUPABASE_PUBLISHABLE_KEY?.trim()) {
    if (!realtimeUrl || !realtimeKey) {
      return { provider: misconfiguredLive('Parking Edge Function environment is incomplete'), name: 'edge-function-misconfigured' };
    }
    return { provider: createRealtimeLiveProvider(realtimeUrl, realtimeKey), name: 'edge-function' };
  }

  return { provider: mockLive, name: 'mock' };
}

const selectedParking = selectParkingProvider({
  SUPABASE_URL: env.SUPABASE_URL,
  SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY,
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
  PARKING_REALTIME_URL: env.PARKING_REALTIME_URL,
  SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_PUBLISHABLE_KEY,
});
export const parkingData = selectedParking.provider;

const selectedLive = selectLiveProvider({
  BUSAN_LIVE_API_URL: env.BUSAN_LIVE_API_URL,
  BUSAN_LIVE_API_KEY: env.BUSAN_LIVE_API_KEY,
  PARKING_REALTIME_URL: env.PARKING_REALTIME_URL,
  SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY,
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
});
export const live: LiveProvider = selectedLive.provider;

export const geo: GeoProvider = env.KAKAO_REST_API_KEY ? kakaoGeo(env.KAKAO_REST_API_KEY) : mockGeo;

export const ai: AIProvider =
  env.OPENAI_API_KEY && env.OPENAI_MODEL ? openAI(env.OPENAI_API_KEY, env.OPENAI_MODEL) : mockAI;

export const providerNames = {
  parking: selectedParking.name,
  live: selectedLive.name,
  geo: geo === mockGeo ? 'mock' : 'kakao',
  ai: ai === mockAI ? 'mock' : 'openai',
};

export const LIVE_WARNING = '실시간 주차 정보를 불러오지 못했습니다. 주차 가능 여부는 확인 불가로 표시하며, 기본 정보와 요금은 그대로 제공합니다.';

/**
 * Supabase UUID와 부산시설공단 코드를 연결한 실시간 조회.
 * 외부 API 응답은 시설공단 코드 기준으로 받은 뒤 UUID 기준으로 변환한다.
 */
export async function fetchLive(
  lots: ParkingLot[]
): Promise<Record<string, LiveStatus> | null> {
  const supportedLots = lots.filter(
    (lot) => lot.liveSupported
  );

  if (supportedLots.length === 0) return {};

  try {
    // 기존 Mock Provider 동작 유지
    if (live === mockLive) {
      return await withTimeout(
        live.getStatus(supportedLots.map((lot) => lot.id)),
        1500
      );
    }

    // 실제 부산시설공단 API 연동
    const mappedLots = supportedLots.filter(
      (
        lot
      ): lot is ParkingLot & { liveSourceId: string } =>
        typeof lot.liveSourceId === 'string' &&
        lot.liveSourceId.length > 0
    );

    if (mappedLots.length === 0) return {};

    const facilityCodes = [
      ...new Set(mappedLots.map((lot) => lot.liveSourceId)),
    ];

    const statusByCode = await withTimeout(
      live.getStatus(facilityCodes),
      1500
    );

    const result: Record<string, LiveStatus> = {};

    for (const lot of mappedLots) {
      const status = statusByCode[lot.liveSourceId];

      if (status) {
        result[lot.id] = status;
      }
    }

    return result;
  } catch (error) {
    logError('live', error);
    return null;
  }
}

