import { getApiUrl } from './appUrls';
import type { SearchPlace } from '@/types/place';

export async function resolvePlaceFromServer(query: string): Promise<SearchPlace[]> {
  const api = getApiUrl();
  if (!api) throw new Error('지역 검색에는 API 서버 연결이 필요합니다.');
  const response = await fetch(`${api}/api/places?query=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(15000) });
  if (response.status === 503) throw new Error('지역 검색 설정이 필요합니다. 서버의 KAKAO_REST_API_KEY를 확인해 주세요.');
  if (!response.ok) throw new Error('검색 장소의 위치를 확인하지 못했습니다. 다시 시도해 주세요.');
  const body = await response.json() as { data: SearchPlace[] };
  return body.data;
}
