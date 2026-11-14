export const BASE = 'http://localhost:8790';

export const todayUtc = () => new Date().toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const mondayOf = (d: string) => {
  const date = new Date(`${d}T00:00:00Z`);
  return addDays(d, -((date.getUTCDay() + 6) % 7));
};

export type Res<T = any> = { status: number; body: T };

export interface Opts { token?: string | null; date?: string; raw?: string; headers?: Record<string, string> }

export async function call<T = any>(method: string, path: string, body?: unknown, opts: Opts = {}): Promise<Res<T>> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.date) headers['X-Local-Date'] = opts.date;
  let payload: string | undefined;
  if (opts.raw !== undefined) { payload = opts.raw; headers['Content-Type'] = 'application/json'; }
  else if (body !== undefined) { payload = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
  const r = await fetch(`${BASE}/api${path}`, { method, headers, body: payload });
  const text = await r.text();
  let parsed: any = text;
  try { parsed = JSON.parse(text); } catch { /* keep text */ }
  return { status: r.status, body: parsed };
}

let seq = 0;
export const uniq = (p = 'u') => `${p}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const registerBody = (over: Record<string, unknown> = {}) => ({
  email: `${uniq()}@test.example`,
  password: 'password123',
  name: 'Тест',
  weight: 80,
  height: 180,
  birthDate: '1990-05-01',
  steps: 8000,
  goal: 'keep',
  norms: { training: [150, 70, 300], rest: [140, 60, 200] },
  ...over,
});

/** A logged-in client bound to one fresh user. */
export class Client {
  constructor(public token: string, public email: string, public date?: string) {}
  req<T = any>(method: string, path: string, body?: unknown, opts: Opts = {}) {
    return call<T>(method, path, body, { token: this.token, date: this.date, ...opts });
  }
  get<T = any>(p: string, o?: Opts) { return this.req<T>('GET', p, undefined, o); }
  post<T = any>(p: string, b?: unknown, o?: Opts) { return this.req<T>('POST', p, b ?? {}, o); }
  put<T = any>(p: string, b?: unknown, o?: Opts) { return this.req<T>('PUT', p, b ?? {}, o); }
  patch<T = any>(p: string, b?: unknown, o?: Opts) { return this.req<T>('PATCH', p, b ?? {}, o); }
  del<T = any>(p: string, o?: Opts) { return this.req<T>('DELETE', p, undefined, o); }
}

export async function newUser(over: Record<string, unknown> = {}, date?: string): Promise<Client> {
  const body = registerBody(over);
  const r = await call('POST', '/auth/register', body, { date });
  if (r.status !== 201) throw new Error(`register failed ${r.status} ${JSON.stringify(r.body)}`);
  return new Client(r.body.token, body.email as string, date);
}

/** Creates one own exercise; returns its id. */
export async function ownExercise(c: Client, over: Record<string, unknown> = {}) {
  const r = await c.post('/exercises', { name: `Упр ${uniq('x')}`, group: 'chest', primary: ['chest'], ...over });
  if (r.status !== 201) throw new Error(`exercise failed ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.exercise.id as number;
}

export async function ownProduct(c: Client, over: Record<string, unknown> = {}) {
  const r = await c.post('/products', { name: `Продукт ${uniq('p')}`, protein: 10, fat: 5, carbs: 20, ...over });
  if (r.status !== 201) throw new Error(`product failed ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.product;
}

export type Row = { exerciseId: number; sets: number; reps: string; kg?: string; rest?: number | null; note?: string; pct?: number | null };

export const programBody = (over: Record<string, unknown> = {}) => ({
  name: 'Программа', weekdays: [0, 2, 4], weeks: 4, plan: {}, ...over,
});

/** Same body the client builds (src/lib/calc.ts workoutFromPlan): kg "60" or "" → plannedWeight 60 / null. */
export function workoutFromPlan(program: any, week: number, weekday: number, date: string, types: Record<number, string> = {}) {
  const rows: Row[] = program.plan?.[week]?.[weekday] ?? [];
  return {
    date, title: 'Тренировка', programId: program.id, week, weekday,
    exercises: rows.map((r) => {
      const m = String(r.reps).match(/^(\d+)\s*(?:[–-]\s*(\d+))?$/);
      const reps = m ? Math.max(Number(m[1]), Number(m[2] ?? m[1])) : 0;
      const parts = String(r.kg ?? '').split('/').map((x) => x.trim().replace(',', '.')).filter((x) => x !== '').map(Number);
      return {
        exerciseId: r.exerciseId, name: 'Упражнение', kind: null, muscles: '', type: types[r.exerciseId] ?? 'weight_reps',
        rest: r.rest ?? 120,
        sets: Array.from({ length: r.sets }, (_, i) => ({ plannedWeight: parts.length ? parts[Math.min(i, parts.length - 1)] : null, plannedReps: reps })),
      };
    }),
  };
}

export const simpleWorkout = (over: Record<string, unknown> = {}) => ({
  date: todayUtc(), title: 'Свободная',
  exercises: [{ exerciseId: null, name: 'Отжимания', type: 'weight_reps', rest: 60, sets: [{ plannedWeight: null, plannedReps: 10 }, { plannedWeight: null, plannedReps: 10 }] }],
  ...over,
});
