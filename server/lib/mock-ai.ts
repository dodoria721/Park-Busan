// ⚠️ 프로토타입 대체용 Mock AIProvider입니다. LLM이 아니라 정규식 규칙으로 조건을 뽑습니다.
// 실제 서비스(AI-REQ-04 정확도 평가 등)는 OpenAI 구현으로 교체해 검증해야 합니다.
import type { SearchConditions } from '@parkbusan/shared';
import type { AIProvider } from './providers.ts';
import { templateExplanation } from './ai.ts';

const KO_NUM: Record<string, number> = {
  한: 1, 하나: 1, 두: 2, 둘: 2, 세: 3, 셋: 3, 네: 4, 넷: 4, 다섯: 5,
  여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10,
};
const KO_DIGIT: Record<string, number> = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9 };
const STOP = new Set(['여기', '거기', '근처', '주변', '집', '주차장', '예산', '시간', '조건', '목적지', '더', '좀', '조금', '곳', '데']);

function extractDuration(q: string): number | undefined {
  const h = q.match(/(\d+(?:\.\d+)?|한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)\s*시간(\s*반)?/);
  const m = q.match(/(\d+)\s*분(?!\s*의)/);
  if (!h && !m) return undefined;
  let min = 0;
  if (h) min += (KO_NUM[h[1]] ?? Number(h[1])) * 60 + (h[2] ? 30 : 0);
  if (m) min += Number(m[1]);
  return Math.round(min);
}

function extractBudget(q: string): number | null | undefined {
  if (/(예산|돈|요금|가격)\s*(은|는)?\s*(상관\s*없|무관|없이|제한\s*없)/.test(q)) return null;
  if (/무료/.test(q)) return 0;
  let r: RegExpMatchArray | null;
  if ((r = q.match(/(\d+(?:\.\d+)?)\s*만\s*원/))) return Math.round(Number(r[1]) * 10000);
  if ((r = q.match(/(\d+)\s*천\s*원/))) return Number(r[1]) * 1000;
  if ((r = q.match(/(일|이|삼|사|오|육|칠|팔|구)?천\s*원/))) return (r[1] ? KO_DIGIT[r[1]] : 1) * 1000;
  if ((r = q.match(/(\d{1,3}(?:,\d{3})+|\d+)\s*원/))) return Number(r[1].replace(/,/g, ''));
  if (/(?<![\d가-힣])만\s*원/.test(q)) return 10000;
  return undefined;
}

function extractDestination(q: string): string | undefined {
  const patterns = [
    /([가-힣A-Za-z0-9]+?)\s*(?:근처|주변|부근|인근|앞|쪽|에서)/g,
    /([가-힣A-Za-z0-9]+?)(?:으로|로)\s*(?:바꿔|변경|가)/g,
    /([가-힣A-Za-z0-9]+?)\s*주차/g,
  ];
  for (const re of patterns) {
    for (const m of q.matchAll(re)) {
      const word = m[1];
      if (word.length >= 2 && !/\d/.test(word) &&!/(원|분|시간)$/.test(word) && !STOP.has(word)) return word;
    }
  }
  // 숫자 없는 한 단어 질의는 목적지로 본다. 예: "해운대역"
  const t = q.trim();
  if (/^[가-힣A-Za-z]+$/.test(t) && !STOP.has(t)) return t;
  return undefined;
}

/** 질의에서 언급된 항목만 담는다. 언급되지 않은 항목은 이전 조건을 유지한다(FR-019). */
export function ruleBasedExtract(query: string): Partial<SearchConditions> {
  const out: Partial<SearchConditions> = {};
  const destination = extractDestination(query);
  const durationMinutes = extractDuration(query);
  const budget = extractBudget(query);
  if (destination !== undefined) out.destination = destination;
  if (durationMinutes !== undefined) out.durationMinutes = durationMinutes;
  if (budget !== undefined) out.budget = budget;
  return out;
}

export const mockAI: AIProvider = {
  async extractConditions(maskedQuery) {
    return JSON.stringify(ruleBasedExtract(maskedQuery));
  },
  async explain(facts) {
    return templateExplanation(facts);
  },
};
