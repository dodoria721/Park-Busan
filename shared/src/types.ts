// 앱과 서버가 공유하는 요청·응답 타입

export interface LatLng {
  lat: number;
  lng: number;
}

/** 요금 정책. null 필드는 "데이터에 없음"을 뜻한다. */
export interface FeePolicy {
  isFree: boolean;
  baseMinutes: number | null;
  baseFee: number | null;
  unitMinutes: number | null;
  unitFee: number | null;
  dailyMax: number | null;
}

export interface ParkingLot {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  operatingHours: string | null;
  capacity: number | null;
  fee: FeePolicy | null;
  /** 실시간 면수를 제공하는 주차장인지 */
  liveSupported: boolean;
  source: string;
  liveSourceId?: string;
}

/** 실시간 제공기관 응답. updatedAt은 기관 갱신 시각(ISO), 없으면 null. */
export interface LiveStatus {
  available: number | null;
  total: number | null;
  updatedAt: string | null;
}

/**
 * 화면에 보여 줄 실시간 상태.
 * - unsupported: 실시간 미제공 → "정보 없음"
 * - error: 조회 실패 → "확인 불가"
 * - stale: 갱신 시각 없음 또는 5분 초과 → "자리 확인 필요" (만차 판단에 쓰지 않음)
 * - ok: 유효한 정보
 */
export type LiveView =
  | { state: 'unsupported' }
  | { state: 'error' }
  | { state: 'stale'; available: number | null; total: number | null; updatedAt: string | null }
  | { state: 'ok'; available: number | null; total: number | null; updatedAt: string };

export type FeeResult = { status: 'ok'; fee: number } | { status: 'unknown'; reason: string };

export interface Candidate {
  lot: ParkingLot;
  distanceM: number;
  fee: FeeResult;
  live: LiveView;
}

export interface SearchConditions {
  destination: string | null;
  durationMinutes: number | null;
  budget: number | null;
}

export interface Place {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

// ---- API 계약 ----

export interface ApiError {
  error: { code: string; message: string };
}

export interface ParseRequest {
  query: string;
  previous?: SearchConditions | null;
}
export interface ParseResponse {
  conditions: SearchConditions;
  /** 이번 질의로 바뀐 항목 */
  changed: (keyof SearchConditions)[];
}

export interface PlacesResponse {
  places: Place[];
}

export interface RecommendRequest {
  destination: LatLng & { name?: string };
  durationMinutes: number;
  budget: number | null;
}
export interface RecommendResponse {
  top: Candidate[];
  all: Candidate[];
  /** 예산이 있을 때 요금 계산 불가로 별도 확인이 필요한 주차장 */
  needsCheck: Candidate[];
  excluded: { full: number; overBudget: number };
  /** 실시간 조회 실패 안내(FR-017). 정상이면 null */
  liveWarning: string | null;
}

export interface LotDetailResponse {
  lot: ParkingLot;
  live: LiveView;
  liveWarning: string | null;
  distanceM: number | null;
  fee: FeeResult | null;
}

export interface ExplainRequest {
  lotId: string;
  destination: LatLng;
  durationMinutes: number;
  budget: number | null;
}
export interface ExplainResponse {
  text: string;
  /** true면 AI 설명 실패로 정형 문구를 사용함 */
  fallback: boolean;
}
