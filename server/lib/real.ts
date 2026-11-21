// ⚠️ 미검증 코드: 실제 외부 서비스로 요청을 보내 확인한 적이 없습니다.
// 환경 변수가 설정될 때만 선택됩니다(lib/providers.ts). 필드명·엔드포인트는 실제 문서와 대조 후 수정하세요.
import type { LiveStatus, Place } from '@parkbusan/shared';
import type { AIProvider, GeoProvider, LiveProvider } from './providers.ts';
import { templateExplanation } from './ai.ts';
export { supabaseParking } from './supabase-parking.ts';

async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return res.json();
}

/**
 * 미검증: 부산시설공단 실시간 주차 API. 응답 구조와 외부 ID 매핑(source_mappings)은 확인 전이다.
 * 여기서는 items[]에 { id, available, total, updatedAt }가 온다고 가정한다.
 */
export function publicLive(url: string, key: string): LiveProvider {
  return {
    async getStatus(ids) {
      const data = (await getJson(`${url}?serviceKey=${encodeURIComponent(key)}&resultType=json`)) as {
        items?: { id: string; available: number | null; total: number | null; updatedAt: string | null }[];
      };
      const out: Record<string, LiveStatus> = {};
      for (const it of data.items ?? []) {
        if (ids.includes(it.id)) out[it.id] = { available: it.available, total: it.total, updatedAt: it.updatedAt };
      }
      return out;
    },
  };
}

/** 미검증: 카카오 로컬 키워드 검색. rect로 부산 대략 범위만 검색한다. */
export function kakaoGeo(key: string): GeoProvider {
  return {
    async searchPlaces(query) {
      const q = new URLSearchParams({ query, rect: '128.75,34.88,129.32,35.40', size: '10' });
      const data = (await getJson(`https://dapi.kakao.com/v2/local/search/keyword.json?${q}`, {
        headers: { Authorization: `KakaoAK ${key}` },
      })) as { documents: { id: string; place_name: string; road_address_name: string; address_name: string; x: string; y: string }[] };
      return data.documents.map(
        (d): Place => ({
          id: d.id,
          name: d.place_name,
          address: d.road_address_name || d.address_name,
          lat: Number(d.y),
          lng: Number(d.x),
        }),
      );
    },
  };
}

/** 미검증: OpenAI Chat Completions(JSON 모드). 모델 ID는 OPENAI_MODEL로 받는다. */
export function openAI(key: string, model: string): AIProvider {
  async function chat(system: string, user: string, json: boolean): Promise<string> {
    const data = (await getJson('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
    })) as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message.content ?? '';
  }
  return {
    extractConditions(maskedQuery, previous) {
      return chat(
        '부산 주차장 검색 질의에서 바뀐 조건만 JSON으로 출력한다. 키: destination(string|null), ' +
          'durationMinutes(정수, 분), budget(정수, 원|null). 언급되지 않은 키는 넣지 않는다. 다른 키 금지.',
        JSON.stringify({ previous, query: maskedQuery }),
        true,
      );
    },
    explain(facts) {
      return chat(
        '주어진 사실만 사용해 한국어 한두 문장으로 추천 이유를 쓴다. 사실에 없는 숫자(요금·거리·면수)를 만들지 않는다.',
        templateExplanation(facts),
        false,
      );
    },
  };
}
