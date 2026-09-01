/**
 * Reactive reads.
 *
 * Replaces drizzle's `useLiveQuery`, which only exists for the expo-sqlite
 * *synchronous* driver — and there is no synchronous SQLite on the web, so
 * keeping it would have pinned the whole app to native forever.
 *
 * The mechanism is deliberately plain: every write goes through
 * `src/db/mutations.ts`, and every mutation calls `notifyChanged()`. Screens
 * subscribe to that counter and re-run their query. No native change listener,
 * no driver-specific hook, so the same code works on both platforms.
 *
 * The cost of doing it this way is that a write bypassing mutations.ts would go
 * unnoticed. There are none, and keeping every write in one file is worth more
 * than the generality would be.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

let version = 0;
const listeners = new Set<() => void>();

/** Called by every mutation. Wakes every mounted query. */
export const notifyChanged = (): void => {
  version += 1;
  for (const listen of listeners) listen();
};

const subscribe = (listen: () => void): (() => void) => {
  listeners.add(listen);
  return () => {
    listeners.delete(listen);
  };
};

export type QueryResult<T> = {
  data: T[];
  /** True until the first result arrives — only ever visible on the web driver. */
  loading: boolean;
  error: Error | null;
};

/**
 * Runs `run` now, and again whenever the database changes.
 *
 * `run` must be stable or memoised by the caller through `deps`; it is re-created
 * on every render otherwise and would loop.
 */
export function useQuery<T>(run: () => PromiseLike<T[]>, deps: unknown[] = []): QueryResult<T> {
  const [state, setState] = useState<QueryResult<T>>({
    data: [],
    loading: true,
    error: null,
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are the contract
  const runner = useCallback(run, deps);

  /**
   * Guards against a slow query resolving after a newer one: each run takes a
   * ticket, and only the latest ticket is allowed to write state.
   */
  const ticket = useRef(0);

  useEffect(() => {
    let active = true;
    const load = () => {
      const mine = (ticket.current += 1);
      Promise.resolve(runner()).then(
        (rows) => {
          if (!active || mine !== ticket.current) return;
          setState({ data: rows, loading: false, error: null });
        },
        (e: unknown) => {
          if (!active || mine !== ticket.current) return;
          setState({
            data: [],
            loading: false,
            error: e instanceof Error ? e : new Error(String(e)),
          });
        },
      );
    };

    load();
    const unsubscribe = subscribe(load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [runner]);

  return state;
}

/** Current change counter — exposed for tests and debugging. */
export const changeVersion = (): number => version;
