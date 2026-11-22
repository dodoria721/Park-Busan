import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createActiveRefreshTimer, createRefreshCoordinator, type IntervalScheduler } from './refresh.ts';

test('같은 검색 조건의 동시 갱신 요청을 하나로 합침', async () => {
  let resolve!: (value: number) => void;
  let requests = 0;
  let applied = 0;
  const coordinator = createRefreshCoordinator({
    snapshot: () => ({ key: 'same', context: undefined }),
    load: () => {
      requests++;
      return new Promise<number>((done) => {
        resolve = done;
      });
    },
    apply: (value) => {
      applied = value;
    },
  });

  const first = coordinator.refresh();
  const second = coordinator.refresh();
  assert.equal(requests, 1);
  assert.equal(first, second);
  resolve(7);
  assert.equal(await first, 7);
  assert.equal(applied, 7);
  assert.equal(coordinator.isPending(), false);
});

test('검색 조건이 바뀐 뒤 도착한 오래된 응답은 적용하지 않음', async () => {
  let key = 'old';
  const resolvers = new Map<string, (value: string) => void>();
  const applied: string[] = [];
  const coordinator = createRefreshCoordinator({
    snapshot: () => ({ key, context: key }),
    load: (requestKey) => new Promise<string>((resolve) => resolvers.set(requestKey, resolve)),
    apply: (value) => applied.push(value),
  });

  const oldRequest = coordinator.refresh();
  key = 'new';
  const newRequest = coordinator.refresh();
  resolvers.get('old')?.('old-result');
  assert.equal(await oldRequest, null);
  resolvers.get('new')?.('new-result');
  assert.equal(await newRequest, 'new-result');
  assert.deepEqual(applied, ['new-result']);
});

test('갱신 실패 시 마지막 정상 결과를 지우지 않고 오류만 전달', async () => {
  let current = 'last-success';
  let error: unknown = null;
  const coordinator = createRefreshCoordinator({
    snapshot: () => ({ key: 'search', context: undefined }),
    load: async () => {
      throw new Error('network failed');
    },
    apply: (value: string) => {
      current = value;
    },
    onError: (reason) => {
      error = reason;
    },
  });

  await assert.rejects(coordinator.refresh(), /network failed/);
  assert.equal(current, 'last-success');
  assert.ok(error instanceof Error);
});

test('활성 상태에서만 타이머를 하나 유지하고 비활성화·화면 이탈 시 정리', async () => {
  let nextHandle = 0;
  let refreshes = 0;
  const callbacks = new Map<number, () => void>();
  const cleared: number[] = [];
  const scheduler: IntervalScheduler = {
    set(callback) {
      const handle = ++nextHandle;
      callbacks.set(handle, callback);
      return handle;
    },
    clear(handle) {
      cleared.push(handle as number);
      callbacks.delete(handle as number);
    },
  };
  const timer = createActiveRefreshTimer(async () => {
    refreshes++;
  }, 60_000, scheduler);

  timer.setActive(true);
  timer.setActive(true);
  assert.equal(callbacks.size, 1);
  callbacks.get(1)?.();
  await Promise.resolve();
  assert.equal(refreshes, 1);

  timer.setActive(false);
  assert.deepEqual(cleared, [1]);
  timer.setActive(true, true);
  await Promise.resolve();
  assert.equal(refreshes, 2);
  timer.dispose();
  assert.deepEqual(cleared, [1, 2]);
  assert.equal(callbacks.size, 0);
});
