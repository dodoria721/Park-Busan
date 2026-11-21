import type { ParseResponse, SearchConditions } from '@parkbusan/shared';
import { extractWithRetry, validateConditions } from '@/lib/ai.ts';
import { fail, logError, readJson } from '@/lib/http.ts';
import { ai } from '@/lib/providers.ts';

const EMPTY: SearchConditions = { destination: null, durationMinutes: null, budget: null };

// POST /api/parse  { query, previous? } → { conditions, changed }
export async function POST(req: Request) {
  const body = (await readJson(req)) as { query?: unknown; previous?: unknown } | undefined;
  const query = typeof body?.query === 'string' ? body.query.trim() : '';
  if (!query || query.length > 300) return fail(400, 'INVALID_QUERY', '검색 문장을 1~300자로 입력해 주세요.');

  let previous: SearchConditions | null = null;
  if (body?.previous != null) {
    const p = validateConditions(body.previous);
    if (!p) return fail(400, 'INVALID_PREVIOUS', '이전 검색 조건 형식이 올바르지 않습니다.');
    previous = { ...EMPTY, ...p };
  }

  let changes: Partial<SearchConditions> | null;
  try {
    changes = await extractWithRetry(ai, query, previous);
  } catch (e) {
    logError('parse', e);
    changes = null;
  }
  if (!changes) {
    return fail(502, 'AI_PARSE_FAILED', '검색 조건을 분석하지 못했습니다. 목적지, 주차 시간, 예산을 직접 입력해 주세요.');
  }

  const changed = Object.keys(changes) as (keyof SearchConditions)[];
  if (changed.length === 0) {
    return fail(
      422,
      'NO_CONDITIONS',
      previous
        ? '변경할 조건을 찾지 못했습니다. 예: "2시간 기준으로 다시", "예산 3천원으로"'
        : '목적지, 주차 시간, 예산을 찾지 못했습니다. 다시 입력하거나 직접 입력해 주세요.',
    );
  }

  const res: ParseResponse = { conditions: { ...(previous ?? EMPTY), ...changes }, changed };
  return Response.json(res);
}
