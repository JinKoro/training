import { beforeEach, describe, expect, it, vi } from 'vitest';

// Run hooks outside React: effects fire immediately, refs are plain objects.
vi.mock('react', () => ({
  useEffect: (f: () => void) => { f(); },
  useRef: (v: unknown) => ({ current: v }),
  useCallback: (f: unknown) => f,
  useState: (v: unknown) => [v, () => {}],
  useSyncExternalStore: () => 0,
}));

type D = { resolve: (v: unknown) => void; reject: (e: unknown) => void };
const calls: { path: string; d: D }[] = [];
vi.mock('../../src/lib/api', () => ({
  api: (_m: string, path: string) => new Promise((resolve, reject) => { calls.push({ path, d: { resolve, reject } }); }),
}));

const { useQuery, invalidate, clearCache } = await import('../../src/lib/query');
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => { clearCache(); calls.length = 0; });

describe('query cache', () => {
  it('first use loads; second use reuses the in-flight request', async () => {
    expect(useQuery('/a').loading).toBe(true);
    useQuery('/a');
    expect(calls).toHaveLength(1);
    calls[0].d.resolve(1);
    await flush();
    expect(useQuery('/a')).toMatchObject({ data: 1, loading: false });
    expect(calls).toHaveLength(1); // fresh: no refetch
  });
  it('null path: nothing loads', () => {
    expect(useQuery(null)).toMatchObject({ data: undefined, loading: false });
    expect(calls).toHaveLength(0);
  });
  it('a stale answer arriving after the fresh one is dropped', async () => {
    useQuery('/b');
    const inv = invalidate('/b');
    expect(calls).toHaveLength(2);
    calls[1].d.resolve('new');
    calls[0].d.resolve('old');
    await inv;
    await flush();
    expect(useQuery('/b').data).toBe('new');
  });
  it('a stale answer arriving first is dropped and its promise waits for the fresh one', async () => {
    useQuery('/c');
    const reload = useQuery('/c').reload(); // the in-flight promise
    const inv = invalidate('/c');
    let reloaded = false;
    void reload.then(() => { reloaded = true; });
    calls[0].d.resolve('old');
    await flush();
    expect(useQuery('/c').data).toBeUndefined();
    expect(reloaded).toBe(false);
    calls[1].d.resolve('new');
    await inv;
    await flush();
    expect(reloaded).toBe(true);
    expect(useQuery('/c').data).toBe('new');
  });
  it('invalidate matches by prefix only', async () => {
    useQuery('/food/x'); useQuery('/foo'); useQuery('/workouts');
    calls.forEach((c) => c.d.resolve(c.path));
    await flush();
    calls.length = 0;
    const p = invalidate('/food');
    expect(calls.map((c) => c.path)).toEqual(['/food/x']);
    calls[0].d.resolve('v2');
    await p;
    expect(useQuery('/food/x').data).toBe('v2');
    await expect(invalidate('/nothing')).resolves.toBeUndefined();
  });
  it('an error keeps the last data and clears on the next success', async () => {
    useQuery('/e');
    calls[0].d.resolve('ok');
    await flush();
    const p = invalidate('/e');
    calls[1].d.reject(new Error('boom'));
    await p;
    const r = useQuery('/e');
    expect(r.data).toBe('ok');
    expect(r.error).toBeInstanceOf(Error);
    const p2 = invalidate('/e');
    calls.at(-1)!.d.resolve('ok2'); // (the mock runs the effect on every call, so the errored entry may have refetched once)
    await p2;
    expect(useQuery('/e')).toMatchObject({ data: 'ok2', error: undefined });
  });
  it('clearCache during a request drops its answer', async () => {
    useQuery('/z');
    clearCache();
    calls[0].d.resolve('late');
    await flush();
    calls.length = 0;
    expect(useQuery('/z').data).toBeUndefined();
    expect(calls).toHaveLength(1); // reloads
  });
});
