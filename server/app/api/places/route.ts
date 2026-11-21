import type { PlacesResponse } from '@parkbusan/shared';
import { fail, logError } from '@/lib/http.ts';
import { geo } from '@/lib/providers.ts';

// GET /api/places?q=서면 → { places }  (FR-004, 2개 이상이면 앱에서 선택)
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (!q || q.length > 50) return fail(400, 'INVALID_QUERY', '목적지를 1~50자로 입력해 주세요.');
  try {
    const res: PlacesResponse = { places: await geo.searchPlaces(q) };
    return Response.json(res);
  } catch (e) {
    logError('places', e);
    return fail(502, 'GEO_FAILED', '목적지 검색에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  }
}
