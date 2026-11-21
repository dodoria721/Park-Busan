import { calculateFee, distanceMeters, RADIUS_M, recommend, toLiveView, type LotDetailResponse, type RecommendResponse } from '@parkbusan/shared';
import { MAX_BUDGET, MAX_MINUTES } from './ai.ts';
import { asLatLng, fail, isInt, logError, readJson } from './http.ts';
import { fetchLive, LIVE_WARNING, parkingData, type ParkingDataProvider } from './providers.ts';

export function createRecommendHandler(dataProvider: ParkingDataProvider = parkingData, liveLoader = fetchLive) {
  return async function POST(req: Request) {
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
      lots = await dataProvider.listNear(destination, RADIUS_M);
    } catch (error) {
      logError('recommend', error);
      return fail(503, 'PARKING_DATA_FAILED', '주차장 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }

    const live = await liveLoader(lots);
    const result = recommend({
      destination,
      durationMinutes: body!.durationMinutes as number,
      budget,
      lots,
      live,
      now: new Date(),
    });
    const response: RecommendResponse = { ...result, liveWarning: live === null ? LIVE_WARNING : null };
    return Response.json(response);
  };
}

export function createLotHandler(dataProvider: ParkingDataProvider = parkingData, liveLoader = fetchLive) {
  return async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    const searchParams = new URL(req.url).searchParams;

    let lot;
    try {
      lot = await dataProvider.getLot(id);
    } catch (error) {
      logError('lot', error);
      return fail(503, 'PARKING_DATA_FAILED', '주차장 정보를 불러오지 못했습니다.');
    }
    if (!lot) return fail(404, 'NOT_FOUND', '주차장을 찾을 수 없습니다.');

    const minutes = searchParams.has('minutes') ? Number(searchParams.get('minutes')) : null;
    if (minutes !== null && !isInt(minutes, 1, MAX_MINUTES)) return fail(400, 'INVALID_DURATION', '주차 시간이 올바르지 않습니다.');
    const destination = searchParams.has('lat')
      ? asLatLng({ lat: Number(searchParams.get('lat')), lng: Number(searchParams.get('lng')) })
      : null;

    const live = await liveLoader([lot]);
    const response: LotDetailResponse = {
      lot,
      live: toLiveView(lot, live, new Date()),
      liveWarning: live === null ? LIVE_WARNING : null,
      distanceM:
        destination && lot.lat != null && lot.lng != null
          ? Math.round(distanceMeters(destination, { lat: lot.lat, lng: lot.lng }))
          : null,
      fee: minutes === null ? null : calculateFee(lot.fee, minutes),
    };
    return Response.json(response);
  };
}
