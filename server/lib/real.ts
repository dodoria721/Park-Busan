// 외부 Provider는 환경 변수가 설정될 때만 선택됩니다(lib/providers.ts).
import type { LiveStatus, Place } from '@parkbusan/shared';
import type { AIProvider, GeoProvider, LiveProvider } from './providers.ts';
import { templateExplanation } from './ai.ts';
export { supabaseParking } from './supabase-parking.ts';

async function getJson(url: string, init?: RequestInit, request: typeof fetch = fetch): Promise<unknown> {
  const res = await request(url, init);
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return res.json();
}

/** 부산시설공단 실시간 주차정보 API 응답 */
interface BusanLiveItem {
  parkgcd: string;
  parknm: string;
  curravacnt: number | string | null;
  maxcnt: number | string | null;
  parkingcnt?: number | string | null;
  lastupdatetime: string | null;
}

interface BusanLiveResponse {
  response?: {
    header?: {
      resultCode?: string;
      resultMsg?: string;
    };
    body?: {
      items?: {
        item?: BusanLiveItem[];
      };
      totalCount?: string | number;
    };
  };
}

function parseParkingCount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const count = Number(value);

  return Number.isInteger(count) && count >= 0
    ? count
    : null;
}

function parseBusanUpdatedAt(value: string | null): string | null {
  if (!value) return null;

  // API 시간은 한국 현지 시각(KST)으로 해석
  const normalized = value.trim().replace(' ', 'T');

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized)) {
    return null;
  }

  const date = new Date(`${normalized}+09:00`);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

/**
 * 부산시설공단 실시간 주차현황 제공자.
 *
 * 주의:
 * 이 단계에서 ids는 시설공단 코드(A01, A35 등)여야 한다.
 * Supabase UUID 변환은 source_mappings 연동 단계에서 구현한다.
 */
export function publicLive(url: string, key: string, request: typeof fetch = fetch): LiveProvider {
  return {
    async getStatus(ids) {
      if (ids.length === 0) return {};

      const requestUrl = new URL(url);

      requestUrl.searchParams.set('serviceKey', key);
      requestUrl.searchParams.set('resultType', 'json');
      requestUrl.searchParams.set('pageNo', '1');
      requestUrl.searchParams.set('numOfRows', '100');

      const data = (await getJson(
        requestUrl.toString(),
        undefined,
        request,
      )) as BusanLiveResponse;

      const response = data.response;

      if (response?.header?.resultCode !== '00') {
        throw new Error(
          `부산시설공단 API 오류: ${
            response?.header?.resultMsg ?? '응답 확인 필요'
          }`
        );
      }

      const items = response.body?.items?.item;
      const totalCount = Number(response.body?.totalCount ?? 0);

      if (!Array.isArray(items)) {
        if (totalCount === 0) return {};
        throw new Error('부산시설공단 API 응답 구조가 올바르지 않습니다.');
      }

      if (totalCount > items.length) {
        throw new Error(
          '부산시설공단 API 응답에 일부 페이지가 누락되었습니다.'
        );
      }

      const requestedIds = new Set(ids);
      const result: Record<string, LiveStatus> = {};

      for (const item of items) {
        if (!requestedIds.has(item.parkgcd)) continue;

        const available = parseParkingCount(item.curravacnt);
        const total = parseParkingCount(item.maxcnt);

        result[item.parkgcd] = {
          available:
            available !== null &&
            total !== null &&
            available > total
              ? null
              : available,
          total,
          updatedAt: parseBusanUpdatedAt(item.lastupdatetime),
        };
      }

      return result;
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
