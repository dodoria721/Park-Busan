import { calculateFee, distanceMeters, toLiveView, type ExplainResponse } from '@parkbusan/shared';
import { explainWithFallback, MAX_BUDGET, MAX_MINUTES } from '@/lib/ai.ts';
import { asLatLng, fail, isInt, logError, readJson } from '@/lib/http.ts';
import { ai, fetchLive, parkingData } from '@/lib/providers.ts';

// POST /api/explain { lotId, destination, durationMinutes, budget } → { text, fallback }  (FR-013)
// 앱이 보낸 수치는 믿지 않고, 서버가 다시 조회·계산한 사실만 AI에 넘긴다(AI-REQ-01).
export async function POST(req: Request) {
  const body = (await readJson(req)) as Record<string, unknown> | undefined;
  const destination = asLatLng(body?.destination);
  const budget = body?.budget ?? null;
  if (
    typeof body?.lotId !== 'string' ||
    !destination ||
    !isInt(body.durationMinutes, 1, MAX_MINUTES) ||
    (budget !== null && !isInt(budget, 0, MAX_BUDGET))
  ) {
    return fail(400, 'INVALID_REQUEST', 'lotId, destination, durationMinutes, budget 값을 확인해 주세요.');
  }

  let lot;
  try {
    lot = await parkingData.getLot(body.lotId);
  } catch (e) {
    logError('explain', e);
    return fail(503, 'PARKING_DATA_FAILED', '주차장 정보를 불러오지 못했습니다.');
  }
  if (!lot) return fail(404, 'NOT_FOUND', '주차장을 찾을 수 없습니다.');
  if (lot.lat == null || lot.lng == null) return fail(422, 'NO_COORDINATES', '좌표 정보가 없어 추천 이유를 만들 수 없습니다.');

  const live = await fetchLive([lot]);
  const res: ExplainResponse = await explainWithFallback(ai, {
    name: lot.name,
    distanceM: Math.round(distanceMeters(destination, { lat: lot.lat, lng: lot.lng })),
    durationMinutes: body.durationMinutes as number,
    budget,
    fee: calculateFee(lot.fee, body.durationMinutes as number),
    live: toLiveView(lot, live, new Date()),
  });
  return Response.json(res);
}
