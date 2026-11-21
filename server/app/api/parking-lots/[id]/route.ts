import { calculateFee, distanceMeters, toLiveView, type LotDetailResponse } from '@parkbusan/shared';
import { MAX_MINUTES } from '@/lib/ai.ts';
import { asLatLng, fail, isInt, logError } from '@/lib/http.ts';
import { fetchLive, LIVE_WARNING, parkingData } from '@/lib/providers.ts';

// GET /api/parking-lots/:id?minutes=120&lat=..&lng=..  (FR-007)
// minutes, lat/lng를 주면 예상 요금과 거리를 함께 돌려준다.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sp = new URL(req.url).searchParams;

  let lot;
  try {
    lot = await parkingData.getLot(id);
  } catch (e) {
    logError('lot', e);
    return fail(503, 'PARKING_DATA_FAILED', '주차장 정보를 불러오지 못했습니다.');
  }
  if (!lot) return fail(404, 'NOT_FOUND', '주차장을 찾을 수 없습니다.');

  const minutes = sp.has('minutes') ? Number(sp.get('minutes')) : null;
  if (minutes !== null && !isInt(minutes, 1, MAX_MINUTES)) return fail(400, 'INVALID_DURATION', '주차 시간이 올바르지 않습니다.');
  const dest = sp.has('lat') ? asLatLng({ lat: Number(sp.get('lat')), lng: Number(sp.get('lng')) }) : null;

  const live = await fetchLive([lot]);
  const res: LotDetailResponse = {
    lot,
    live: toLiveView(lot, live, new Date()),
    liveWarning: live === null ? LIVE_WARNING : null,
    distanceM: dest && lot.lat != null && lot.lng != null ? Math.round(distanceMeters(dest, { lat: lot.lat, lng: lot.lng })) : null,
    fee: minutes === null ? null : calculateFee(lot.fee, minutes),
  };
  return Response.json(res);
}
