import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { api } from './api';

/** Minimal cached GET hook: stale-while-revalidate, global invalidation by path prefix. */
type Entry = { data?: unknown; error?: unknown; promise?: Promise<void>; at: number; gen: number };
const cache = new Map<string, Entry>();
const listeners = new Set<() => void>();
let version = 0;
const emit = () => { version += 1; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

/**
 * `force`: start a new request even if one is in flight. After a write the in-flight GET may have been sent
 * before the write landed, so reusing it would keep the old data; its late answer is dropped instead.
 * A superseded request's promise resolves when the newest one does.
 */
function load(path: string, force = false): Promise<void> {
  const prev = cache.get(path);
  if (prev?.promise && !force) return prev.promise;
  const entry: Entry = prev ?? { at: 0, gen: 0 };
  const gen = ++entry.gen;
  const current = () => cache.get(path) === entry && entry.gen === gen;
  const p: Promise<void> = api('GET', path)
    .then((d) => { if (current()) { entry.data = d; entry.error = undefined; entry.at = Date.now(); } })
    .catch((e) => { if (current()) entry.error = e; })
    .then(() => {
      if (!current()) return cache.get(path) === entry ? entry.promise : undefined;
      entry.promise = undefined;
      emit();
    });
  entry.promise = p;
  cache.set(path, entry);
  return p;
}

/** `keep`: while a new path loads, return the last data this hook had (search as you type: no blank list per letter). */
export function useQuery<T>(path: string | null, opts?: { keep?: boolean }): { data: T | undefined; error: unknown; loading: boolean; reload: () => Promise<void> } {
  useSyncExternalStore(subscribe, () => version);
  const entry = path ? cache.get(path) : undefined;
  const last = useRef<unknown>(undefined);
  if (entry?.data !== undefined) last.current = entry.data;
  const data = entry?.data ?? (opts?.keep && path && !entry?.error ? last.current : undefined);
  useEffect(() => {
    if (!path) return;
    const e = cache.get(path);
    if (!e || (!e.promise && Date.now() - e.at > 15_000)) void load(path);
  }, [path]);
  const reload = useCallback(() => (path ? load(path) : Promise.resolve()), [path]);
  return {
    data: data as T | undefined,
    error: entry?.error,
    loading: !!path && !data && !entry?.error,
    reload,
  };
}

/** Refetch every cached path starting with one of the prefixes; resolves once the fresh data is in the cache. */
export function invalidate(...prefixes: string[]): Promise<void> {
  const loads: Promise<void>[] = [];
  for (const key of cache.keys()) {
    if (prefixes.some((p) => key.startsWith(p))) {
      cache.get(key)!.at = 0;
      loads.push(load(key, true));
    }
  }
  return Promise.all(loads).then(() => {});
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
