import type {
  ExplainRequest,
  ExplainResponse,
  LotDetailResponse,
  ParseRequest,
  ParseResponse,
  PlacesResponse,
  RecommendRequest,
  RecommendResponse,
} from '@parkbusan/shared';

// 비밀 키는 앱에 두지 않는다. 앱은 서버 주소만 안다.
const BASE = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(
      BASE + path,
      body === undefined
        ? undefined
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );
  } catch {
    throw new ApiError('NETWORK', `서버(${BASE})에 연결할 수 없습니다. 서버 실행 여부와 주소를 확인해 주세요.`);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.error?.code ?? `HTTP_${res.status}`, data?.error?.message ?? '요청에 실패했습니다.');
  }
  return data as T;
}

export const api = {
  parse: (b: ParseRequest) => call<ParseResponse>('/api/parse', b),
  places: (q: string) => call<PlacesResponse>(`/api/places?q=${encodeURIComponent(q)}`),
  recommend: (b: RecommendRequest) => call<RecommendResponse>('/api/recommend', b),
  lot: (id: string, q: { minutes?: number; lat?: number; lng?: number }) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v != null) sp.set(k, String(v));
    return call<LotDetailResponse>(`/api/parking-lots/${encodeURIComponent(id)}?${sp}`);
  },
  explain: (b: ExplainRequest) => call<ExplainResponse>('/api/explain', b),
};

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.');
