import type { RecommendResponse } from '@parkbusan/shared';

/** Keep unpriced live facilities visible without claiming they meet the budget. */
export function resultGroups(result: RecommendResponse) {
  return {
    liveNeedsCheck: result.needsCheck.filter(candidate => candidate.lot.liveSupported),
    otherNeedsCheck: result.needsCheck.filter(candidate => !candidate.lot.liveSupported),
    total: result.all.length + result.needsCheck.length,
    liveCount: [...result.all, ...result.needsCheck].filter(candidate => candidate.lot.liveSupported).length,
  };
}
