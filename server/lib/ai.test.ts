import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explainWithFallback, extractWithRetry, isGrounded, templateExplanation, validateConditions } from './ai.ts';
import { mockAI, ruleBasedExtract } from './mock-ai.ts';
import type { AIProvider, ExplainFacts } from './providers.ts';

test('Mock 파서: 목적지·시간·예산 추출', () => {
  assert.deepEqual(ruleBasedExtract('서면역 근처에서 2시간 주차하고 5천 원 이하'), {
    destination: '서면역',
    durationMinutes: 120,
    budget: 5000,
  });
  assert.deepEqual(ruleBasedExtract('해운대에서 1시간 반, 만원 이하'), {
    destination: '해운대',
    durationMinutes: 90,
    budget: 10000,
  });
  assert.deepEqual(ruleBasedExtract('남포동 주변 세 시간 30분 12,000원'), {
    destination: '남포동',
    durationMinutes: 210,
    budget: 12000,
  });
});

test('Mock 파서: 후속 질의는 바뀐 항목만', () => {
  assert.deepEqual(ruleBasedExtract('2시간 기준으로 다시'), { durationMinutes: 120 });
  assert.deepEqual(ruleBasedExtract('예산 3천원으로 바꿔줘'), { budget: 3000 });
  assert.deepEqual(ruleBasedExtract('예산은 상관없어'), { budget: null });
  assert.deepEqual(ruleBasedExtract('더 싼 곳'), {});
});

test('스키마 검증', () => {
  assert.deepEqual(validateConditions({ budget: 5000 }), { budget: 5000 });
  assert.equal(validateConditions({ budget: -1 }), null);
  assert.equal(validateConditions({ durationMinutes: 1.5 }), null);
  assert.equal(validateConditions({ destination: '' }), null);
  assert.equal(validateConditions({ extra: 1 }), null);
  assert.equal(validateConditions([]), null);
});

test('스키마 위반 시 1회 재시도, 다시 실패하면 null', async () => {
  let calls = 0;
  const flaky: AIProvider = {
    ...mockAI,
    async extractConditions() {
      return ++calls === 1 ? 'not json' : '{"budget":3000}';
    },
  };
  assert.deepEqual(await extractWithRetry(flaky, '예산 3천원', null), { budget: 3000 });
  assert.equal(calls, 2);

  calls = 0;
  const broken: AIProvider = {
    ...mockAI,
    async extractConditions() {
      calls++;
      return '{"budget":"오천"}';
    },
  };
  assert.equal(await extractWithRetry(broken, '예산 오천', null), null);
  assert.equal(calls, 2);
});

test('AI 호출 전 개인정보 마스킹', async () => {
  let seen = '';
  const spy: AIProvider = {
    ...mockAI,
    async extractConditions(q) {
      seen = q;
      return '{}';
    },
  };
  await extractWithRetry(spy, '12가3456 차로 서면역 가요 010-1111-2222', null);
  assert.ok(!seen.includes('3456') && !seen.includes('2222'), seen);
});

const facts: ExplainFacts = {
  name: '서면중앙 공영주차장',
  distanceM: 1234,
  durationMinutes: 120,
  budget: 5000,
  fee: { status: 'ok', fee: 3700 },
  live: { state: 'unsupported' },
};

test('설명: 조회된 숫자만 허용(AI-REQ-01)', async () => {
  assert.ok(isGrounded(templateExplanation(facts), facts));
  assert.ok(isGrounded('1,234m 거리, 3,700원으로 예산 5,000원 이내입니다.', facts));
  assert.ok(!isGrounded('잔여 15면이 있습니다.', facts));

  const liar: AIProvider = { ...mockAI, explain: async () => '요금은 1,000원입니다.' };
  const r = await explainWithFallback(liar, facts);
  assert.equal(r.fallback, true);
  assert.equal(r.text, templateExplanation(facts));
});
