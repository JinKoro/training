import { api, ApiError } from './api';
import { invalidate } from './query';

/** Durable queue of workout writes, so a set logged without signal in the gym is not lost. */
type Op = { method: 'PUT' | 'PATCH' | 'POST' | 'DELETE'; path: string; body?: unknown };
const KEY = 'podhod-queue';

const read = (): Op[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; } };
const write = (q: Op[]) => { try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* ignore */ } };

let running = false;
const waiters = new Set<() => void>();
export const pendingCount = () => read().length;

export function enqueue(op: Op) {
  write([...read(), op]);
  void flush();
}

export async function flush(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const q = read();
      if (!q.length) break;
      try {
        await api(q[0].method, q[0].path, q[0].body);
      } catch (e) {
        if (e instanceof ApiError && (e.status === 0 || e.status >= 500)) break; // offline: retry later
        // 4xx: drop the op (e.g. workout deleted)
      }
      write(read().slice(1));
    }
  } finally {
    running = false;
    if (!read().length) { invalidate('/workouts'); waiters.forEach((w) => w()); waiters.clear(); }
  }
}

/** Resolves when the queue is empty (or after a timeout). */
export function drained(timeoutMs = 8000): Promise<boolean> {
  if (!read().length) return Promise.resolve(true);
  return new Promise((resolve) => {
    const t = setTimeout(() => { waiters.delete(done); resolve(false); }, timeoutMs);
    const done = () => { clearTimeout(t); resolve(true); };
    waiters.add(done);
    void flush();
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flush());
  setInterval(() => { if (read().length) void flush(); }, 10_000);
}
