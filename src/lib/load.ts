/**
 * «Нагрузка по неделям» of any program (own or started from a template), from what is written in its plan.
 *
 * A week's load = how heavy × how much, against the program's own peak:
 *  - heavy: each row's weight with its reps counted (Epley, the same formula the weights are recalculated with),
 *    as a share of the heaviest such value of that exercise in the program. Without a weight (before calibration)
 *    the row's load share (pct, deload 70) over its reps stands in: fewer reps = heavier. Averaged over the week's sets.
 *  - much: the week's sets against the week with the most sets.
 * The heaviest week is 1. A week with no workouts is rest: 0.
 */

/** The fields of a plan row the load needs (sets and kg may still be text in the editor). */
export interface LoadRow { exerciseId: number; sets: number | string; reps: string; kg?: string | null; pct?: number | null }
export type LoadPlan = Record<string | number, Record<string | number, LoadRow[]>>;

/** A working week this much lighter than the program's typical (median) week is a deload (drawn grey). */
const DELOAD_SHARE = 0.65;

const topReps = (reps: string) => { const n = String(reps).split(/[–-]/).map(Number).filter((x) => x > 0); return n.length ? Math.max(...n) : 10; };
/** First weight of «60» / «62,5» / «60/62,5»; 0 when none. */
const firstKg = (kg: string | null | undefined) => { const m = String(kg ?? '').match(/\d+(?:[.,]\d+)?/); return m ? Number(m[0].replace(',', '.')) : 0; };
const setsOf = (r: LoadRow) => Math.max(0, Number(r.sets) || 0);

export function weekLoads(plan: LoadPlan, weeks: number): number[] {
  const rows = Array.from({ length: weeks }, (_, i) => Object.values(plan[i + 1] ?? plan[String(i + 1)] ?? {}).flat());
  // heaviness of a row; with a weight and without one are compared separately (different scales)
  const heavy = (r: LoadRow) => { const kg = firstKg(r.kg), e = 1 + topReps(r.reps) / 30; return kg > 0 ? { k: 'kg', v: kg * e } : { k: 'rel', v: (r.pct ?? 100) / e }; };
  const peak = new Map<string, number>();
  for (const r of rows.flat()) { const h = heavy(r), key = `${r.exerciseId}:${h.k}`; peak.set(key, Math.max(peak.get(key) ?? 0, h.v)); }
  const raw = rows.map((list) => {
    const sets = list.reduce((a, r) => a + setsOf(r), 0);
    if (!sets) return { sets: 0, heavy: 0 };
    const sum = list.reduce((a, r) => { const h = heavy(r), p = peak.get(`${r.exerciseId}:${h.k}`) || 1; return a + (h.v / p) * setsOf(r); }, 0);
    return { sets, heavy: sum / sets };
  });
  const maxSets = Math.max(0, ...raw.map((x) => x.sets));
  if (!maxSets) return raw.map(() => 0);
  const vals = raw.map((x) => x.heavy * (x.sets / maxSets));
  const top = Math.max(...vals);
  return vals.map((v) => (top > 0 ? v / top : 0));
}

/** Which weeks are a deload: much lighter than the typical working week of this program. */
export function deloads(loads: number[]): boolean[] {
  const work = loads.filter((v) => v > 0).sort((a, b) => a - b);
  if (work.length < 3) return loads.map(() => false);
  const median = work[Math.floor(work.length / 2)];
  return loads.map((v) => v > 0 && v < median * DELOAD_SHARE);
}

/**
 * Bar heights 0..1: the program's own range is stretched over the chart (lightest working week 0,3, heaviest 1), so
 * a program that only goes from 85 % to 100 % still shows its waves the way a ready-made one does. Rest stays 0.
 */
export function barHeights(loads: number[]): number[] {
  const work = loads.filter((v) => v > 0);
  if (!work.length) return loads.map(() => 0);
  const lo = Math.min(...work), hi = Math.max(...work);
  return loads.map((v) => (v === 0 ? 0 : hi - lo < 1e-9 ? 1 : 0.3 + (0.7 * (v - lo)) / (hi - lo)));
}

/** «Неделя 9 — разгрузка, неделя 10 — отдых» for the line under the chart; '' when every week is a working one. */
export function loadNote(loads: number[]): string {
  // empty weeks after the last filled one are not filled in yet, not rest
  const last = loads.reduce((a, v, i) => (v > 0 ? i : a), -1);
  const rest = loads.map((v, i) => (v === 0 && i < last ? i + 1 : 0)).filter(Boolean);
  const dl = deloads(loads);
  const deload = loads.map((_, i) => (dl[i] ? i + 1 : 0)).filter(Boolean);
  const part = (ns: number[], what: string) => (!ns.length ? '' : `${ns.length === 1 ? 'неделя' : 'недели'} ${ns.join(', ')} — ${what}`);
  const s = [part(deload, 'разгрузка'), part(rest, 'отдых')].filter(Boolean).join(', ');
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}
