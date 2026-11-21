import { createRecommendHandler } from '@/lib/parking-handlers.ts';

// POST /api/recommend { destination:{lat,lng}, durationMinutes, budget|null }
export const POST = createRecommendHandler();
