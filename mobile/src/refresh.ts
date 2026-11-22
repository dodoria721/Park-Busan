export interface RefreshSnapshot<TContext> {
  key: string;
  context: TContext;
}

export interface RefreshCoordinator<TValue> {
  refresh(): Promise<TValue | null>;
  isPending(): boolean;
}

/**
 * Deduplicates identical refreshes and prevents an older request from
 * overwriting state after the search conditions have changed.
 */
export function createRefreshCoordinator<TContext, TValue>(options: {
  snapshot: () => RefreshSnapshot<TContext> | null;
  load: (context: TContext) => Promise<TValue>;
  apply: (value: TValue, context: TContext) => void;
  onError?: (error: unknown, context: TContext) => void;
}): RefreshCoordinator<TValue> {
  let pending: { key: string; promise: Promise<TValue | null> } | null = null;

  return {
    refresh() {
      const snapshot = options.snapshot();
      if (!snapshot) return Promise.resolve(null);
      if (pending?.key === snapshot.key) return pending.promise;

      const promise = options
        .load(snapshot.context)
        .then((value) => {
          if (options.snapshot()?.key !== snapshot.key) return null;
          options.apply(value, snapshot.context);
          return value;
        })
        .catch((error: unknown) => {
          if (options.snapshot()?.key === snapshot.key) options.onError?.(error, snapshot.context);
          throw error;
        })
        .finally(() => {
          if (pending?.promise === promise) pending = null;
        });

      pending = { key: snapshot.key, promise };
      return promise;
    },
    isPending() {
      return pending !== null;
    },
  };
}

export interface IntervalScheduler {
  set(callback: () => void, intervalMs: number): unknown;
  clear(handle: unknown): void;
}

const defaultScheduler: IntervalScheduler = {
  set: (callback, intervalMs) => setInterval(callback, intervalMs),
  clear: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
};

/** Runs refreshes only while the owning screen and app are active. */
export function createActiveRefreshTimer(
  refresh: () => Promise<unknown> | unknown,
  intervalMs = 60_000,
  scheduler: IntervalScheduler = defaultScheduler,
) {
  let handle: unknown = null;
  let disposed = false;

  const run = () => {
    void Promise.resolve(refresh()).catch(() => {
      // The screen owns user-facing error state; timers must never reject globally.
    });
  };

  return {
    setActive(active: boolean, refreshNow = false) {
      if (disposed) return;
      if (!active) {
        if (handle !== null) scheduler.clear(handle);
        handle = null;
        return;
      }
      if (handle === null) handle = scheduler.set(run, intervalMs);
      if (refreshNow) run();
    },
    dispose() {
      disposed = true;
      if (handle !== null) scheduler.clear(handle);
      handle = null;
    },
  };
}
