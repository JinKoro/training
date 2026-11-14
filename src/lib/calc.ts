import { addDays, diffDays, fromDay, plural, toDay, today, weekdayIdx, weekStart, type Day } from './dates';
import type { Entry, Exercise, Goal, Macros, Me, Meal, PlanRow, Program, Sex, TrainingMode, Workout } from './types';

/** Rest between sets when neither the program row nor the exercise sets one (base exercises default to 3 min). */
export const DEFAULT_REST = 180;
export const kcal = (m: Macros) => Math.round(m[0] * 4 + m[1] * 9 + m[2] * 4);
export const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');

// ---------- norms ----------
/** Latest norm of that day type in effect on the date; null when the training-day norm is not set. */
export function setNormFor(me: Me, date: Day, type: 'training' | 'rest'): Macros | null {
  let found: Macros | null | undefined;
  let first: Macros | null | undefined;
  for (const n of me.norms) {
    if (n.type !== type) continue;
    if (first === undefined) first = n.macros;
    if (n.from <= date) found = n.macros;
  }
  const v = found !== undefined ? found : first;
  return v ?? null;
}

/** Norm used for a day: a training day without its own norm falls back to the rest-day norm. */
export function normFor(me: Me, date: Day, type: 'training' | 'rest'): Macros {
  const rest = setNormFor(me, date, 'rest') ?? [0, 0, 0];
  return type === 'training' ? setNormFor(me, date, 'training') ?? rest : rest;
}

// ---------- energy formula ----------
export interface EnergyInput {
  sex: Sex; weight: number; bodyFat: number; steps: number;
  trainingMode: TrainingMode; trainingMin: number; trainingKcal: number;
}
export const GOAL_FACTOR: Record<Goal, number> = { lose: 0.9, keep: 1, gain: 1.1 };

/** Daily expenditure: Katch-McArdle BMR + 17 % digestion + steps (20-40 kcal per 1000 by body size) + training. */
export function energy(e: EnergyInput) {
  const lean = e.weight * (1 - e.bodyFat / 100);
  const bmr = Math.round(370 + 21.6 * lean);
  const tef = Math.round(bmr * 0.17);
  const per1000 = Math.max(20, Math.min(40, e.weight * 0.4));
  const steps = Math.round((e.steps / 1000) * per1000);
  const training = Math.round(e.trainingMode === 'time' ? 0.07 * e.weight * e.trainingMin : e.trainingMode === 'kcal' ? e.trainingKcal : 0);
  const rest = bmr + tef + steps;
  return { lean, bmr, tef, per1000, steps, training, rest, train: rest + training };
}

/** Macros for a calorie target: protein 1.8 g/kg, fat 0.9 g/kg (men) or 1 g/kg (women), the rest carbs. */
export function macrosFor(kcalTarget: number, weight: number, sex: Sex): Macros {
  const p = Math.round(1.8 * weight), f = Math.round((sex === 'f' ? 1 : 0.9) * weight);
  return [p, f, Math.max(0, Math.round((kcalTarget - 4 * p - 9 * f) / 4))];
}

/** Suggested norms; no training means no training-day norm. */
export function suggestNorms(e: EnergyInput, goal: Goal): { training: Macros | null; rest: Macros } {
  const en = energy(e), k = GOAL_FACTOR[goal];
  return {
    rest: macrosFor(en.rest * k, e.weight, e.sex),
    training: e.trainingMode === 'none' ? null : macrosFor(en.train * k, e.weight, e.sex),
  };
}

// ---------- programs ----------
export function activeProgram(programs: Program[] | undefined): Program | undefined {
  return programs?.find((p) => p.active) ?? programs?.[0];
}
export const programEnd = (p: Program): Day => addDays(p.startDate, p.weeks * 7);

/** Program week number (1-based) for a date, or null when the date is outside the program. */
export function programWeek(p: Program, date: Day): number | null {
  const d = diffDays(date, p.startDate);
  if (d < 0 || d >= p.weeks * 7) return null;
  return Math.floor(d / 7) + 1;
}

export function planRows(p: Program, week: number, weekday: number): PlanRow[] {
  return p.plan[String(week)]?.[String(weekday)] ?? [];
}

/** Training day if a program covers the date, the weekday is selected, and that week's plan has exercises for it (an empty day is a rest day). */
export function plannedFor(p: Program | undefined, date: Day): { week: number; weekday: number; rows: PlanRow[] } | null {
  if (!p) return null;
  if (date < toDay(new Date(p.createdAt))) return null; // days before the program existed are not training days
  const week = programWeek(p, date);
  const wd = weekdayIdx(date);
  if (week === null || !p.weekdays.includes(wd)) return null;
  const rows = planRows(p, week, wd);
  return rows.length ? { week, weekday: wd, rows } : null;
}

/** Weekdays of a program week that have exercises (the week's training days). */
export const weekTrainingDays = (p: Program, week: number) => p.weekdays.filter((wd) => planRows(p, week, wd).length > 0);

/** Program training days: each selected weekday of each week that has exercises; empty ones are rest days. */
export function programSlots(p: Program): { week: number; weekday: number; date: Day }[] {
  const out: { week: number; weekday: number; date: Day }[] = [];
  for (let week = 1; week <= p.weeks; week++) {
    for (const wd of [...weekTrainingDays(p, week)].sort((a, b) => a - b)) {
      out.push({ week, weekday: wd, date: addDays(p.startDate, (week - 1) * 7 + wd) });
    }
  }
  return out;
}

/** Progress counts training days only: training days already behind `on` out of all program training days (rest days don't move it). */
export function programProgress(p: Program, on: Day = today()) {
  const total = p.weeks * 7;
  const slots = programSlots(p);
  const passed = slots.filter((s) => s.date < on).length;
  const pct = diffDays(on, p.startDate) >= total ? 100 : slots.length ? Math.round((passed / slots.length) * 100) : 0;
  const current = Math.min(p.weeks, Math.max(1, Math.floor(diffDays(on, p.startDate) / 7) + 1));
  return { pct, currentWeek: current, finished: diffDays(on, p.startDate) >= total, started: diffDays(on, p.startDate) >= 0 };
}

export const timesPerWeek = (n: number) => `${n} ${plural(n, ['раз', 'раза', 'раз'])} в неделю`;
export const weeksText = (n: number) => `${n} ${plural(n, ['неделя', 'недели', 'недель'])}`;

// ---------- plan rows ----------
export function parseReps(s: string): { min: number; max: number } {
  const m = String(s).match(/^(\d+)\s*(?:[–-]\s*(\d+))?$/);
  if (!m) return { min: 0, max: 0 };
  const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

/** "60" | "60/65/65" | "" -> per-set weights (null = no weight). */
export function setWeights(kg: string, sets: number): (number | null)[] {
  const parts = String(kg ?? '').split('/').map((x) => x.trim().replace(',', '.')).filter((x) => x !== '');
  const nums = parts.map(Number).filter((n) => Number.isFinite(n));
  return Array.from({ length: sets }, (_, i) => (nums.length ? nums[Math.min(i, nums.length - 1)] : null));
}

/** Done share in %, rounded; 100 only when everything is done (99.6 % shows as 99). */
export function donePct(done: number, plan: number): number {
  if (plan <= 0) return 0;
  if (done >= plan) return 100;
  return Math.min(99, Math.round((done / plan) * 100));
}

export const showKg = (n: number | null | undefined) => (n == null ? '—' : String(Math.round(n * 100) / 100).replace('.', ','));
export const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.max(0, t) % 60).padStart(2, '0')}`;

const GROUP_RU: Record<string, string> = { legs: 'Ноги', back: 'Спина', chest: 'Грудь', shoulders: 'Плечи', arms: 'Руки', abs: 'Пресс', cardio: 'Кардио' };
export const MUSCLE_RU: Record<string, string> = {
  chest: 'грудь', shoulders: 'плечи', biceps: 'бицепс', forearms: 'предплечья', abs: 'пресс', quads: 'квадрицепс', calves: 'икры',
  traps: 'трапеции', reardelts: 'задние дельты', lats: 'широчайшие', triceps: 'трицепс', lowerback: 'поясница', glutes: 'ягодицы', hamstrings: 'бицепс бедра',
};
export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function exerciseSubtitle(e: Exercise): string {
  if (e.subtitle) return e.subtitle;
  return cap([...e.primary, ...e.secondary].slice(0, 3).map((m) => MUSCLE_RU[m] ?? m).join(' · '));
}

/** Title for a training day: two most frequent groups, e.g. «Грудь и плечи». */
export function dayTitle(rows: PlanRow[], byId: Map<number, Exercise>, fallback: string): string {
  const count = new Map<string, number>();
  for (const r of rows) {
    const g = byId.get(r.exerciseId)?.group;
    if (g) count.set(g, (count.get(g) ?? 0) + 1);
  }
  const top = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g]) => GROUP_RU[g] ?? g);
  if (!top.length) return fallback;
  return top.length === 1 ? top[0] : `${top[0]} и ${top[1].toLowerCase()}`;
}

/** Body for POST /workouts from the program plan. */
export function workoutFromPlan(p: Program, week: number, weekday: number, date: Day, byId: Map<number, Exercise>, title: string) {
  const rows = planRows(p, week, weekday);
  return {
    date, title, programId: p.id, week, weekday,
    exercises: rows.map((r) => {
      const ex = byId.get(r.exerciseId);
      const reps = parseReps(r.reps).max;
      return {
        exerciseId: r.exerciseId, name: ex?.name ?? 'Упражнение', kind: ex?.kind ?? null,
        muscles: ex ? exerciseSubtitle(ex) : '', type: ex?.type ?? 'weight_reps',
        rest: r.rest ?? ex?.rest ?? DEFAULT_REST,
        sets: setWeights(r.kg, r.sets).map((w) => ({ plannedWeight: w, plannedReps: reps })),
      };
    }),
  };
}

// ---------- workout stats ----------
export function workoutStats(w: Workout) {
  let done = 0, total = 0, D = 0, P = 0;
  for (const e of w.exercises) {
    for (const s of e.sets) {
      total += 1;
      P += s.plannedReps;
      if (s.completedAt !== null && s.reps !== null) {
        done += 1;
        D += Math.min(s.reps, s.plannedReps);
      }
    }
  }
  return { done, total, D, P, pct: donePct(D, P) };
}
/** Planned length of a session in minutes: each set ≈ 45 s of work plus its rest. */
export const planMinutes = (rows: PlanRow[], byId: Map<number, Exercise>) =>
  Math.round(rows.reduce((a, r) => a + r.sets * (45 + (r.rest ?? byId.get(r.exerciseId)?.rest ?? DEFAULT_REST)), 0) / 60);

export const durationMin = (w: Workout) => (w.finishedAt ? Math.max(1, Math.round((w.finishedAt - w.startedAt) / 60000)) : null);

// ---------- food ----------
export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_RU: Record<Meal, string> = { breakfast: 'Завтрак', lunch: 'Обед', snack: 'Перекус', dinner: 'Ужин' };
export const MEAL_IN: Record<Meal, string> = { breakfast: 'в завтрак', lunch: 'в обед', snack: 'в перекус', dinner: 'в ужин' };

export const entryMacros = (e: { protein: number; fat: number; carbs: number; grams: number }): Macros =>
  [(e.protein * e.grams) / 100, (e.fat * e.grams) / 100, (e.carbs * e.grams) / 100];

/** Effective kcal per 100 g: the label value when stored, else computed from macros. */
export const kcal100 = (x: { protein: number; fat: number; carbs: number; kcal?: number | null }) => x.kcal ?? kcal([x.protein, x.fat, x.carbs]);
/** Kcal of an amount in grams (not rounded). */
export const kcalAt = (x: { protein: number; fat: number; carbs: number; kcal?: number | null }, grams: number) =>
  ((x.kcal ?? x.protein * 4 + x.fat * 9 + x.carbs * 4) * grams) / 100;
export const entryKcal = (e: { protein: number; fat: number; carbs: number; kcal?: number | null; grams: number }) => kcalAt(e, e.grams);
export const sumKcal = (list: { protein: number; fat: number; carbs: number; kcal?: number | null; grams: number }[]) =>
  list.reduce((a, e) => a + entryKcal(e), 0);

export function sumMacros(list: Macros[]): Macros {
  return list.reduce<Macros>((a, m) => [a[0] + m[0], a[1] + m[1], a[2] + m[2]], [0, 0, 0]);
}

export function dayTotals(entries: Entry[]) {
  const byDate = new Map<Day, { macros: Macros; kcal: number; meals: Record<Meal, Macros>; mealKcal: Record<Meal, number>; count: number }>();
  for (const e of entries) {
    let d = byDate.get(e.date);
    if (!d) {
      d = {
        macros: [0, 0, 0], kcal: 0, meals: { breakfast: [0, 0, 0], lunch: [0, 0, 0], snack: [0, 0, 0], dinner: [0, 0, 0] },
        mealKcal: { breakfast: 0, lunch: 0, snack: 0, dinner: 0 }, count: 0,
      };
      byDate.set(e.date, d);
    }
    const m = entryMacros(e);
    d.macros = sumMacros([d.macros, m]);
    d.meals[e.meal] = sumMacros([d.meals[e.meal], m]);
    const k = entryKcal(e);
    d.kcal += k;
    d.mealKcal[e.meal] += k;
    d.count += 1;
  }
  return byDate;
}

export const macroLine = (m: Macros) =>
  ['Б', 'Ж', 'У'].map((l, i) => (Math.round(m[i]) ? `${l} ${fmtG(m[i])}` : '')).filter(Boolean).join(' ');
export const fmtG = (n: number) => (n >= 10 || Number.isInteger(n) ? String(Math.round(n)) : String(Math.round(n * 10) / 10).replace('.', ','));

// ---------- week ----------
export interface DayInfo {
  date: Day; isTraining: boolean; isPlan: boolean; isToday: boolean;
  norm: Macros; eaten: Macros | null; kcal: number | null; meals: Record<Meal, Macros> | null; mealKcal: Record<Meal, number> | null;
  workout: Workout | null; planned: { week: number; weekday: number; rows: PlanRow[] } | null;
}

/** A program day (week + weekday) already trained, possibly on another date (e.g. Friday's session done on Saturday). */
export const slotDone = (program: Program | undefined, week: number, weekday: number, workouts: Workout[]) =>
  !!program && workouts.some((w) => w.programId === program.id && w.week === week && w.weekday === weekday);

/** Planned session for a date, unless that program day was already trained on another date. */
export function plannedOpen(program: Program | undefined, date: Day, workouts: Workout[]) {
  const pl = plannedFor(program, date);
  if (!pl) return null;
  return workouts.some((w) => w.date !== date && w.programId === program!.id && w.week === pl.week && w.weekday === pl.weekday) ? null : pl;
}

export function buildDays(days: Day[], me: Me, program: Program | undefined, workouts: Workout[], entries: Entry[]): DayInfo[] {
  const t = today();
  const totals = dayTotals(entries);
  return days.map((date) => {
    const workout = workouts.find((w) => w.date === date) ?? null;
    const planned = plannedOpen(program, date, workouts);
    const isTraining = !!workout || !!planned;
    const tot = totals.get(date);
    const isPlan = date > t;
    return {
      date, isTraining, isPlan, isToday: date === t,
      norm: normFor(me, date, isTraining ? 'training' : 'rest'),
      eaten: isPlan ? null : tot?.macros ?? [0, 0, 0],
      kcal: isPlan ? null : Math.round(tot?.kcal ?? 0),
      meals: tot?.meals ?? null, mealKcal: tot?.mealKcal ?? null,
      workout, planned,
    };
  });
}

export const weekRange = (start: Day) => {
  const a = fromDay(start), b = fromDay(addDays(start, 6));
  const G = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${G[a.getMonth()]}`;
  return `${a.getDate()} ${G[a.getMonth()].slice(0, 3)} – ${b.getDate()} ${G[b.getMonth()].slice(0, 3)}`;
};
export { weekStart };
