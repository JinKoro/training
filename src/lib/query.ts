import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { api } from './api';

/** Minimal cached GET hook: stale-while-revalidate, global invalidation by path prefix. */
type Entry = { data?: unknown; error?: unknown; promise?: Promise<void>; at: number };
const cache = new Map<string, Entry>();
const listeners = new Set<() => void>();
let version = 0;
const emit = () => { version += 1; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

function load(path: string): Promise<void> {
  const prev = cache.get(path);
  if (prev?.promise) return prev.promise;
  const entry: Entry = { data: prev?.data, at: prev?.at ?? 0 };
  entry.promise = api('GET', path)
    .then((d) => { entry.data = d; entry.error = undefined; entry.at = Date.now(); })
    .catch((e) => { entry.error = e; })
    .finally(() => { entry.promise = undefined; emit(); });
  cache.set(path, entry);
  return entry.promise;
}

export function useQuery<T>(path: string | null): { data: T | undefined; error: unknown; loading: boolean; reload: () => Promise<void> } {
  useSyncExternalStore(subscribe, () => version);
  const entry = path ? cache.get(path) : undefined;
  useEffect(() => {
    if (!path) return;
    const e = cache.get(path);
    if (!e || (!e.promise && Date.now() - e.at > 15_000)) void load(path);
  }, [path]);
  const reload = useCallback(() => (path ? load(path) : Promise.resolve()), [path]);
  return {
    data: entry?.data as T | undefined,
    error: entry?.error,
    loading: !!path && !entry?.data && !entry?.error,
    reload,
  };
}

/** Refetch every cached path starting with one of the prefixes. */
export function invalidate(...prefixes: string[]) {
  for (const key of cache.keys()) {
    if (prefixes.some((p) => key.startsWith(p))) {
      const e = cache.get(key)!;
      e.at = 0;
      void load(key);
    }
  }
}

export function clearCache() { cache.clear(); emit(); }

/** Local mutable state that resets when `seed` identity changes. */
export function useDraft<T>(seed: T | undefined, deps: unknown[]): [T | undefined, (v: T | ((p: T) => T)) => void] {
  const [draft, setDraft] = useState<T | undefined>(seed);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setDraft(seed); }, deps);
  const set = useCallback((v: T | ((p: T) => T)) => setDraft((p) => (typeof v === 'function' ? (v as (p: T) => T)(p as T) : v)), []);
  return [draft, set];
}
