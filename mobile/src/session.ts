import type { Place, RecommendResponse, SearchConditions } from '@parkbusan/shared';
import { api } from './api';

export interface HistoryItem {
  conditions: SearchConditions;
  place: Place;
  at: number;
}

// 화면 사이에서 공유하는 현재 검색 상태. 로그인·저장 없이 앱 메모리에만 둔다.
// ponytail: 모듈 변수 하나로 충분. 화면 간 동기화가 복잡해지면 Context로 옮긴다.
// ponytail: 검색 기록도 메모리에만 둔다(앱 재시작 시 사라짐). 유지가 필요하면 AsyncStorage로 옮긴다.
export const session: {
  conditions: SearchConditions | null;
  place: Place | null;
  result: RecommendResponse | null;
  history: HistoryItem[];
} = { conditions: null, place: null, result: null, history: [] };

/** 확정된 조건과 목적지로 추천을 요청하고 세션과 검색 기록에 저장한다. */
export async function runRecommend(conditions: SearchConditions, place: Place): Promise<RecommendResponse> {
  const result = await api.recommend({
    destination: { lat: place.lat, lng: place.lng, name: place.name },
    durationMinutes: conditions.durationMinutes!,
    budget: conditions.budget,
  });
  session.conditions = conditions;
  session.place = place;
  session.result = result;
  const same = (h: HistoryItem) => h.place.id === place.id && JSON.stringify(h.conditions) === JSON.stringify(conditions);
  session.history = [{ conditions, place, at: Date.now() }, ...session.history.filter((h) => !same(h))].slice(0, 10);
  return result;
}
