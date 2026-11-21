import { createLotHandler } from '@/lib/parking-handlers.ts';

// GET /api/parking-lots/:id?minutes=120&lat=..&lng=..  (FR-007)
// minutes, lat/lng를 주면 예상 요금과 거리를 함께 돌려준다.
export const GET = createLotHandler();
