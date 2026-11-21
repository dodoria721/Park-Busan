// ⚠️ 가상 데이터입니다. 실제 부산 공영주차장의 이름·위치·요금·면수가 아닙니다.
// 서면·남포동·해운대 주변에 예외 사례(요금 누락, 무료, 실시간 미제공, 만차, 오래된 갱신 시각,
// 실시간 응답 누락, 반경 밖)를 일부러 섞어 두었습니다.
import type { FeePolicy, LiveStatus, ParkingLot, Place } from '@parkbusan/shared';
import type { GeoProvider, LiveProvider, ParkingDataProvider } from './providers.ts';

const SOURCE = 'MOCK (가상 데이터)';

const fee = (
  baseMinutes: number | null,
  baseFee: number | null,
  unitMinutes: number | null,
  unitFee: number | null,
  dailyMax: number | null = null,
): FeePolicy => ({ isFree: false, baseMinutes, baseFee, unitMinutes, unitFee, dailyMax });
const FREE: FeePolicy = { isFree: true, baseMinutes: null, baseFee: null, unitMinutes: null, unitFee: null, dailyMax: null };

type Row = [id: string, name: string, address: string | null, lat: number, lng: number, hours: string | null, capacity: number | null, fee: FeePolicy | null, liveSupported: boolean];

const rows: Row[] = [
  // 서면 (서면역 35.1578, 129.0600 기준)
  ['sm-01', '서면중앙 공영주차장', '부산진구 중앙대로 (가상)', 35.1565, 129.0587, '00:00~24:00', 120, fee(30, 1000, 10, 300, 15000), true],
  ['sm-02', '부전시장 공영주차장', '부산진구 부전동 (가상)', 35.1622, 129.0617, '07:00~22:00', 80, fee(30, 600, 10, 200, 10000), true],
  ['sm-03', '전포카페거리 노상공영주차장', '부산진구 전포동 (가상)', 35.1546, 129.0645, '09:00~21:00', 30, fee(30, 1000, 10, 500), false],
  ['sm-04', '서면 환승 공영주차장', '부산진구 부전동 (가상)', 35.159, 129.057, '00:00~24:00', 200, null, true],
  ['sm-05', '범내골 공영주차장', '부산진구 범천동 (가상)', 35.1478, 129.0598, '00:00~24:00', 60, fee(60, 1000, 30, 500, 8000), true],
  ['sm-06', '부암동 무료 공영주차장', '부산진구 부암동 (가상)', 35.165, 129.053, null, 25, FREE, false],
  ['sm-07', '양정 공영주차장', '부산진구 양정동 (가상)', 35.17, 129.072, '08:00~22:00', 50, fee(30, 1000, 15, 500, 12000), true],
  ['sm-08', '부산진역 공영주차장', '동구 초량동 (가상)', 35.129, 129.047, '00:00~24:00', 100, fee(30, 800, 10, 300), true],
  // 남포동 (남포역 35.0977, 129.0346 기준)
  ['np-01', '남포동 공영주차장', '중구 남포동 (가상)', 35.099, 129.03, '00:00~24:00', 150, fee(30, 1000, 10, 300, 20000), true],
  ['np-02', '자갈치 공영주차장', '중구 남포동 (가상)', 35.0962, 129.0315, '06:00~23:00', 90, fee(30, 900, 10, 300), true],
  ['np-03', '광복로 노상공영주차장', '중구 광복동 (가상)', 35.0995, 129.033, '09:00~20:00', 20, fee(30, 1500, 10, 500), false],
  ['np-04', '용두산공원 공영주차장', '중구 광복동 (가상)', 35.1008, 129.0325, '00:00~24:00', 300, fee(60, 2000, null, null), true],
  ['np-05', '영도대교 공영주차장', '중구 중앙동 (가상)', 35.0955, 129.0365, '00:00~24:00', 70, fee(30, 1000, 10, 300, 10000), true],
  ['np-06', '충무동 공영주차장', null, 35.0935, 129.024, null, null, null, false],
  // 해운대 (해운대해수욕장 35.1587, 129.1604 기준)
  ['hd-01', '해운대해수욕장 공영주차장', '해운대구 우동 (가상)', 35.1595, 129.159, '00:00~24:00', 250, fee(30, 1000, 10, 500, 25000), true],
  ['hd-02', '해운대역 공영주차장', '해운대구 우동 (가상)', 35.163, 129.16, '00:00~24:00', 120, fee(30, 600, 10, 300), true],
  ['hd-03', '구남로 노상공영주차장', '해운대구 우동 (가상)', 35.1612, 129.1575, '09:00~21:00', 40, fee(30, 1000, 10, 300), false],
  ['hd-04', '해운대시장 공영주차장', '해운대구 중동 (가상)', 35.162, 129.163, '07:00~23:00', 60, fee(60, 2000, 30, 1000, 10000), true],
  ['hd-05', '미포 무료 공영주차장', '해운대구 중동 (가상)', 35.158, 129.17, '00:00~24:00', 100, FREE, true],
  ['hd-06', '동백섬 공영주차장', '해운대구 우동 (가상)', 35.153, 129.152, '06:00~22:00', 80, null, true],
];

export const MOCK_LOTS: ParkingLot[] = rows.map(
  ([id, name, address, lat, lng, operatingHours, capacity, fee, liveSupported]) => ({
    id, name, address, lat, lng, operatingHours, capacity, fee, liveSupported, source: SOURCE,
  }),
);

export const mockParking: ParkingDataProvider = {
  async listNear() {
    return MOCK_LOTS;
  },
  async getLot(id) {
    return MOCK_LOTS.find((l) => l.id === id) ?? null;
  },
};

// [available, total, 몇 분 전 갱신(null이면 기관 갱신 시각 없음)]
// hd-06은 liveSupported지만 응답에서 빠져 "확인 불가"가 된다.
const LIVE: Record<string, [number | null, number | null, number | null]> = {
  'sm-01': [12, 120, 1],
  'sm-02': [0, 80, 2], // 만차(유효)
  'sm-04': [30, 200, 0],
  'sm-05': [0, 60, 12], // 오래된 정보 → 자리 확인 필요
  'sm-07': [5, 50, null], // 갱신 시각 없음 → 자리 확인 필요
  'sm-08': [10, 100, 1],
  'np-01': [25, 150, 1],
  'np-02': [8, 90, 3],
  'np-04': [40, 300, 2],
  'np-05': [3, 70, 20], // 오래된 정보
  'hd-01': [15, 250, 1],
  'hd-02': [0, 120, 1], // 만차(유효)
  'hd-04': [6, 60, 4],
  'hd-05': [20, 100, 0],
};

export const mockLive: LiveProvider = {
  async getStatus(ids) {
    // FR-017 시연: MOCK_LIVE_FAIL=1 이면 실시간 조회 실패를 흉내 낸다.
    if (process.env.MOCK_LIVE_FAIL === '1') throw new Error('mock live failure');
    const now = Date.now();
    const out: Record<string, LiveStatus> = {};
    for (const id of ids) {
      const v = LIVE[id];
      if (!v) continue;
      const [available, total, ago] = v;
      out[id] = { available, total, updatedAt: ago == null ? null : new Date(now - ago * 60000).toISOString() };
    }
    return out;
  },
};

const PLACES: (Place & { aliases: string[] })[] = [
  { id: 'p-seomyeon-stn', name: '서면역', address: '부산진구 (가상 좌표)', lat: 35.1578, lng: 129.06, aliases: [] },
  { id: 'p-seomyeon-lotte', name: '서면 백화점 앞', address: '부산진구 (가상 좌표)', lat: 35.1572, lng: 129.0563, aliases: [] },
  { id: 'p-nampo-stn', name: '남포역', address: '중구 (가상 좌표)', lat: 35.0977, lng: 129.0346, aliases: ['남포동역'] },
  { id: 'p-biff', name: 'BIFF광장', address: '중구 남포동 (가상 좌표)', lat: 35.0985, lng: 129.0276, aliases: ['남포동', '비프광장'] },
  { id: 'p-jagalchi', name: '자갈치시장', address: '중구 남포동 (가상 좌표)', lat: 35.0966, lng: 129.0306, aliases: ['자갈치'] },
  { id: 'p-haeundae-beach', name: '해운대해수욕장', address: '해운대구 우동 (가상 좌표)', lat: 35.1587, lng: 129.1604, aliases: [] },
  { id: 'p-haeundae-stn', name: '해운대역', address: '해운대구 우동 (가상 좌표)', lat: 35.1636, lng: 129.1588, aliases: [] },
  { id: 'p-taejongdae', name: '태종대', address: '영도구 (가상 좌표, 주변 Mock 주차장 없음)', lat: 35.0533, lng: 129.087, aliases: [] },
];

export const mockGeo: GeoProvider = {
  async searchPlaces(query) {
    const q = query.replace(/\s/g, '');
    if (!q) return [];
    return PLACES.filter((p) => [p.name, ...p.aliases].some((n) => n.replace(/\s/g, '').includes(q))).map(
      ({ id, name, address, lat, lng }) => ({ id, name, address, lat, lng }),
    );
  },
};
