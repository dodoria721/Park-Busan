import { RADIUS_M, recommend, type RecommendResponse } from '@parkbusan/shared';
import { MAX_BUDGET, MAX_MINUTES } from '@/lib/ai.ts';
import { asLatLng, fail, isInt, logError, readJson } from '@/lib/http.ts';
import { fetchLive, LIVE_WARNING, parkingData } from '@/lib/providers.ts';

// POST /api/recommend { destination:{lat,lng}, durationMinutes, budget|null }
export async function POST(req: Request) {
  const body = (await readJson(req)) as Record<string, unknown> | undefined;
  const destination = asLatLng(body?.destination);
  if (!destination) return fail(400, 'INVALID_DESTINATION', '목적지 좌표가 올바르지 않습니다.');
  if (!isInt(body?.durationMinutes, 1, MAX_MINUTES))
    return fail(400, 'INVALID_DURATION', '주차 시간을 1분 이상 7일 이하의 분 단위 정수로 보내 주세요.');
  const budget = body?.budget ?? null;
  if (budget !== null && !isInt(budget, 0, MAX_BUDGET))
    return fail(400, 'INVALID_BUDGET', '예산은 0원 이상 정수이거나 null이어야 합니다.');

  let lots;
  try {
    lots = await parkingData.listNear(destination, RADIUS_M);
  } catch (e) {
    logError('recommend', e);
    // UC-001 5a: 자체 DB 조회 실패 → 안내 후 종료
    return fail(503, 'PARKING_DATA_FAILED', '주차장 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }

  const live = await fetchLive(lots);
  const result = recommend({
    destination,
    durationMinutes: body!.durationMinutes as number,
    budget,
    lots,
    live,
    now: new Date(),
  });
  const res: RecommendResponse = { ...result, liveWarning: live === null ? LIVE_WARNING : null };
  return Response.json(res);
}
