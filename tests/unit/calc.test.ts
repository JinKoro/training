import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildDays, dayTitle, dayTotals, DEFAULT_REST, donePct, durationMin, energy, entryMacros, exerciseSubtitle, fmt1, fmtG,
  kcal, kcal100, kcalAt, macroLine, macrosFor, mmss, normFor, parseReps, planMinutes, plannedFor, plannedOpen, planRows,
  programDonePct, programEnd, programProgress, programSlots, programWeek, setNormFor, setWeights, showKg, slotDone,
  suggestNorms, sumKcal, sumMacros, timesPerWeek, weekRange, weeksText, weekTrainingDays, workoutFromPlan, workoutStats,
  activeProgram,
} from '../../src/lib/calc';
import type { Entry, PlanRow } from '../../src/lib/types';
import { ex, me, prog, workout, wset } from './helpers';

const row = (exerciseId: number, over: Partial<PlanRow> = {}): PlanRow => ({ exerciseId, sets: 3, reps: '10', kg: '', ...over });

describe('kcal', () => {
  it('4/9/4 rounded', () => {
    expect(kcal([10, 10, 10])).toBe(170);
    expect(kcal([0.1, 0.1, 0.1])).toBe(2); // 1.7
    expect(kcal([0, 0, 0])).toBe(0);
  });
});

describe('energy', () => {
  const base = { sex: 'm' as const, weight: 80, bodyFat: 20, steps: 10000, trainingMode: 'time' as const, trainingMin: 60, trainingKcal: 0 };
  it('pins the formula', () => {
    const e = energy(base);
    expect(e.lean).toBe(64);
    expect(e.bmr).toBe(1752); // 370 + 21.6*64 = 1752.4
    expect(e.tef).toBe(298); // 17 %
    expect(e.per1000).toBe(32);
    expect(e.steps).toBe(320);
    expect(e.training).toBe(336); // 0.07*80*60
    expect(e.rest).toBe(2370);
    expect(e.train).toBe(2706);
  });
  it('steps rate is clamped to 20..40 kcal per 1000', () => {
    expect(energy({ ...base, weight: 40 }).per1000).toBe(20);
    expect(energy({ ...base, weight: 50 }).per1000).toBe(20);
    expect(energy({ ...base, weight: 75 }).per1000).toBe(30);
    expect(energy({ ...base, weight: 100 }).per1000).toBe(40);
    expect(energy({ ...base, weight: 150 }).per1000).toBe(40);
  });
  it('training modes', () => {
    expect(energy({ ...base, trainingMode: 'kcal', trainingKcal: 450 }).training).toBe(450);
    expect(energy({ ...base, trainingMode: 'none', trainingKcal: 450 }).training).toBe(0);
    expect(energy({ ...base, trainingMode: 'none' }).train).toBe(energy({ ...base, trainingMode: 'none' }).rest);
  });
  it('zero steps / zero fat', () => {
    const e = energy({ ...base, steps: 0, bodyFat: 0 });
    expect(e.steps).toBe(0);
    expect(e.bmr).toBe(Math.round(370 + 21.6 * 80));
  });
});

describe('macrosFor / suggestNorms', () => {
  it('men 1.8 / 0.9, rest carbs', () => {
    expect(macrosFor(2370, 80, 'm')).toEqual([144, 72, 287]); // (2370-576-648)/4 = 286.5
  });
  it('women fat 1 g/kg', () => {
    expect(macrosFor(2000, 60, 'f')).toEqual([108, 60, 257]); // (2000-432-540)/4 = 257
  });
  it('carbs never negative', () => {
    expect(macrosFor(500, 100, 'm')).toEqual([180, 90, 0]);
  });
  it('macros add up to the target (± rounding)', () => {
    const m = macrosFor(2500, 77, 'm');
    expect(Math.abs(kcal(m) - 2500)).toBeLessThanOrEqual(5);
  });
  it('goals -10 % / keep / +10 %', () => {
    const e = { sex: 'm' as const, weight: 80, bodyFat: 20, steps: 10000, trainingMode: 'time' as const, trainingMin: 60, trainingKcal: 0 };
    expect(suggestNorms(e, 'keep').rest).toEqual(macrosFor(2370, 80, 'm'));
    expect(suggestNorms(e, 'lose').rest).toEqual(macrosFor(2133, 80, 'm'));
    expect(suggestNorms(e, 'gain').rest).toEqual(macrosFor(2607, 80, 'm'));
    expect(suggestNorms(e, 'lose').training).toEqual(macrosFor(2706 * 0.9, 80, 'm'));
    expect(suggestNorms({ ...e, trainingMode: 'none' }, 'keep').training).toBeNull();
  });
});

describe('setNormFor / normFor', () => {
  const m = me([
    { from: '2026-01-01', type: 'rest', macros: [100, 50, 200] },
    { from: '2026-01-01', type: 'training', macros: [150, 60, 300] },
    { from: '2026-03-01', type: 'rest', macros: [110, 55, 210] },
    { from: '2026-03-01', type: 'training', macros: null },
    { from: '2026-05-01', type: 'training', macros: [160, 60, 320] },
  ]);
  it('latest norm in effect on the date', () => {
    expect(setNormFor(m, '2026-02-28', 'rest')).toEqual([100, 50, 200]);
    expect(setNormFor(m, '2026-03-01', 'rest')).toEqual([110, 55, 210]);
    expect(setNormFor(m, '2026-05-01', 'training')).toEqual([160, 60, 320]);
  });
  it('a date before any norm takes the first one', () => {
    expect(setNormFor(m, '2025-06-01', 'rest')).toEqual([100, 50, 200]);
  });
  it('training norm set to null → null, normFor falls back to rest', () => {
    expect(setNormFor(m, '2026-04-01', 'training')).toBeNull();
    expect(normFor(m, '2026-04-01', 'training')).toEqual([110, 55, 210]);
    expect(normFor(m, '2026-02-01', 'training')).toEqual([150, 60, 300]);
  });
  it('no norms at all → zeros', () => {
    expect(normFor(me([]), '2026-01-01', 'training')).toEqual([0, 0, 0]);
    expect(setNormFor(me([]), '2026-01-01', 'rest')).toBeNull();
  });
  // fixed: setNormFor relies on norms being sorted by `from`; with an unsorted list the last *array* entry wins, not the latest date.
  it('does not depend on the order of the norms list', () => {
    const u = me([
      { from: '2026-03-01', type: 'rest', macros: [2, 2, 2] },
      { from: '2026-01-01', type: 'rest', macros: [1, 1, 1] },
    ]);
    expect(setNormFor(u, '2026-04-01', 'rest')).toEqual([2, 2, 2]);
  });
});

describe('programs', () => {
  // start Monday 2 Nov 2026; weekdays Mon/Wed/Fri
  const plan = {
    '1': { '0': [row(1)], '2': [row(2)], '4': [] },
    '2': { '0': [row(1)], '2': [row(2)], '4': [row(3)] },
  };
  const p = prog({ plan });

  it('activeProgram', () => {
    expect(activeProgram(undefined)).toBeUndefined();
    expect(activeProgram([prog({ id: 1, active: false }), prog({ id: 2, active: true })])!.id).toBe(2);
    expect(activeProgram([prog({ id: 1, active: false })])).toBeUndefined(); // no fallback to a replaced program
  });
  it('programEnd is start + weeks*7', () => {
    expect(programEnd(p)).toBe('2026-11-16');
    expect(programEnd(prog({ startDate: '2026-03-23', weeks: 2 }))).toBe('2026-04-06'); // across DST
  });
  it('programWeek boundaries', () => {
    expect(programWeek(p, '2026-11-01')).toBeNull();
    expect(programWeek(p, '2026-11-02')).toBe(1);
    expect(programWeek(p, '2026-11-08')).toBe(1); // Sunday
    expect(programWeek(p, '2026-11-09')).toBe(2); // Monday
    expect(programWeek(p, '2026-11-15')).toBe(2);
    expect(programWeek(p, '2026-11-16')).toBeNull();
  });
  it('programWeek across DST (March 29 2026 in Berlin)', () => {
    const q = prog({ startDate: '2026-03-23', weeks: 3 });
    expect(programWeek(q, '2026-03-29')).toBe(1);
    expect(programWeek(q, '2026-03-30')).toBe(2);
    expect(programWeek(q, '2026-04-12')).toBe(3);
    expect(programWeek(q, '2026-04-13')).toBeNull();
  });
  it('planRows returns [] for missing week / day', () => {
    expect(planRows(p, 1, 0)).toHaveLength(1);
    expect(planRows(p, 9, 0)).toEqual([]);
    expect(planRows(p, 1, 6)).toEqual([]);
  });
  it('weekTrainingDays: empty weekday is a rest day', () => {
    expect(weekTrainingDays(p, 1)).toEqual([0, 2]);
    expect(weekTrainingDays(p, 2)).toEqual([0, 2, 4]);
  });
  it('plannedFor', () => {
    expect(plannedFor(undefined, '2026-11-02')).toBeNull();
    expect(plannedFor(p, '2026-11-02')).toMatchObject({ week: 1, weekday: 0 });
    expect(plannedFor(p, '2026-11-03')).toBeNull(); // Tue not selected
    expect(plannedFor(p, '2026-11-06')).toBeNull(); // Fri empty in week 1
    expect(plannedFor(p, '2026-11-13')).toMatchObject({ week: 2, weekday: 4 });
    expect(plannedFor(p, '2026-11-16')).toBeNull(); // after the end
  });
  it('plannedFor: a weekday with rows but not in weekdays is not planned', () => {
    const q = prog({ weekdays: [0], plan: { '1': { '0': [row(1)], '1': [row(2)] } }, weeks: 1 });
    expect(plannedFor(q, '2026-11-03')).toBeNull();
  });
  it('plannedFor: days before the program was created are not training days', () => {
    const q = prog({ plan, createdAt: new Date(2026, 10, 4, 15).getTime() });
    expect(plannedFor(q, '2026-11-02')).toBeNull();
    expect(plannedFor(q, '2026-11-04')).not.toBeNull(); // same day counts
  });
  it('programSlots: dates, sorted weekdays, skips empty days', () => {
    const q = prog({ plan, weekdays: [4, 2, 0] });
    expect(programSlots(q)).toEqual([
      { week: 1, weekday: 0, date: '2026-11-02' },
      { week: 1, weekday: 2, date: '2026-11-04' },
      { week: 2, weekday: 0, date: '2026-11-09' },
      { week: 2, weekday: 2, date: '2026-11-11' },
      { week: 2, weekday: 4, date: '2026-11-13' },
    ]);
  });
  it('programSlots: empty plan', () => {
    expect(programSlots(prog({ plan: {} }))).toEqual([]);
  });
  it('programSlots: program longer than 13 weeks', () => {
    const big: Record<string, Record<string, PlanRow[]>> = {};
    for (let w = 1; w <= 20; w++) big[w] = { '0': [row(1)] };
    const q = prog({ weeks: 20, weekdays: [0], plan: big, startDate: '2026-01-05' });
    const s = programSlots(q);
    expect(s).toHaveLength(20);
    expect(s[19]).toEqual({ week: 20, weekday: 0, date: '2026-05-18' });
    expect(programWeek(q, '2026-05-24')).toBe(20);
    expect(programWeek(q, '2026-05-25')).toBeNull();
  });
  it('programProgress', () => {
    expect(programProgress(p, '2026-11-01')).toEqual({ pct: 0, currentWeek: 1, finished: false, started: false });
    expect(programProgress(p, '2026-11-02')).toEqual({ pct: 0, currentWeek: 1, finished: false, started: true });
    expect(programProgress(p, '2026-11-03').pct).toBe(20); // 1 of 5
    expect(programProgress(p, '2026-11-06').pct).toBe(40); // Fri week 1 is rest: still 2 of 5
    expect(programProgress(p, '2026-11-09')).toMatchObject({ pct: 40, currentWeek: 2 });
    expect(programProgress(p, '2026-11-14').pct).toBe(100); // all 5 slots behind
    expect(programProgress(p, '2026-11-16')).toMatchObject({ pct: 100, finished: true, currentWeek: 2 });
    expect(programProgress(prog({ plan: {} }), '2026-11-05').pct).toBe(0);
  });
  it('programDonePct: only finished workouts of this program on program slots count', () => {
    const ws = [
      workout({ week: 1, weekday: 0, status: 'finished' }),
      workout({ week: 1, weekday: 2, status: 'in_progress' }),
      workout({ week: 2, weekday: 0, programId: 99 }),
      workout({ week: 1, weekday: 4, status: 'finished' }), // rest day, not a slot
      workout({ week: 1, weekday: 0, status: 'finished', id: 2 }), // duplicate slot
    ];
    expect(programDonePct(p, ws)).toBe(20);
    expect(programDonePct(prog({ plan: {} }), ws)).toBe(0);
    expect(programDonePct(p, [])).toBe(0);
  });
  it('texts', () => {
    expect(timesPerWeek(1)).toBe('1 раз в неделю');
    expect(timesPerWeek(3)).toBe('3 раза в неделю');
    expect(timesPerWeek(5)).toBe('5 раз в неделю');
    expect(weeksText(13)).toBe('13 недель');
    expect(weeksText(21)).toBe('21 неделя');
    expect(weeksText(22)).toBe('22 недели');
  });
});

describe('parseReps', () => {
  it.each([
    ['10', 10, 10], ['10–12', 10, 12], ['10-12', 10, 12], ['10 – 12', 10, 12], ['12-10', 10, 12], ['0', 0, 0],
  ])('%s', (s, min, max) => expect(parseReps(s)).toEqual({ min, max }));
  it.each(['', 'abc', '10–', '10—12', '10..12', '-5'])('invalid %s → 0', (s) => expect(parseReps(s)).toEqual({ min: 0, max: 0 }));
  // questionable: surrounding whitespace is rejected
  it('surrounding spaces are rejected (pinned)', () => expect(parseReps(' 10 ')).toEqual({ min: 0, max: 0 }));
});

describe('setWeights', () => {
  it('single / per-set / short list repeats last', () => {
    expect(setWeights('60', 3)).toEqual([60, 60, 60]);
    expect(setWeights('50/55', 3)).toEqual([50, 55, 55]);
    expect(setWeights('60/65/70/75', 2)).toEqual([60, 65]);
  });
  it('comma decimals and spaces', () => {
    expect(setWeights('52,5', 2)).toEqual([52.5, 52.5]);
    expect(setWeights(' 50 / 52,5 ', 2)).toEqual([50, 52.5]);
  });
  it('empty → nulls; zero sets → []', () => {
    expect(setWeights('', 2)).toEqual([null, null]);
    expect(setWeights(undefined as unknown as string, 1)).toEqual([null]);
    expect(setWeights('60', 0)).toEqual([]);
  });
  it('garbage → nulls', () => expect(setWeights('abc', 2)).toEqual([null, null]));
  // questionable: an invalid middle part shifts the following weights to earlier sets
  it('invalid middle part shifts the rest (pinned)', () => expect(setWeights('50/x/60', 3)).toEqual([50, 60, 60]));
  // questionable: negative weights accepted
  it('negative weight passes through (pinned)', () => expect(setWeights('-5', 1)).toEqual([-5]));
});

describe('donePct', () => {
  it('basic', () => {
    expect(donePct(0, 10)).toBe(0);
    expect(donePct(5, 10)).toBe(50);
    expect(donePct(10, 10)).toBe(100);
    expect(donePct(12, 10)).toBe(100);
    expect(donePct(249, 250)).toBe(99); // 99.6 → 99, not 100
    expect(donePct(1, 0)).toBe(0);
    expect(donePct(1, -5)).toBe(0);
  });
  // fixed: negative done gives a negative percentage
  it('never negative', () => expect(donePct(-1, 10)).toBeGreaterThanOrEqual(0));
});

describe('formatting', () => {
  it('showKg', () => {
    expect(showKg(null)).toBe('—');
    expect(showKg(undefined)).toBe('—');
    expect(showKg(52.5)).toBe('52,5');
    expect(showKg(0)).toBe('0');
    expect(showKg(1.005)).toBe('1');
  });
  it('mmss', () => {
    expect(mmss(0)).toBe('0:00');
    expect(mmss(90)).toBe('1:30');
    expect(mmss(605)).toBe('10:05');
  });
  // fixed: negative seconds give "-1:00" (minutes not clamped, seconds are)
  it('mmss of a negative time is 0:00', () => expect(mmss(-5)).toBe('0:00'));
  it('fmt1', () => {
    expect(fmt1(17.24)).toBe('17,2');
    expect(fmt1(5)).toBe('5');
    expect(fmt1(0.25)).toBe('0,3');
    expect(fmt1(0)).toBe('0');
  });
  it('macroLine leaves zeros out', () => {
    expect(macroLine([17.24, 5, 0.3])).toBe('Б 17,2 Ж 5 У 0,3');
    expect(macroLine([10, 0, 0.04])).toBe('Б 10');
    expect(macroLine([0, 0, 0])).toBe('');
    expect(macroLine([0.05, 0, 0])).toBe('Б 0,1');
  });
  it('fmtG', () => {
    expect(fmtG(12.6)).toBe('13');
    expect(fmtG(3)).toBe('3');
    expect(fmtG(2.45)).toBe('2,5');
  });
  it('weekRange', () => {
    expect(weekRange('2026-11-02')).toBe('2–8 ноября');
    expect(weekRange('2026-11-30')).toBe('30 ноя – 6 дек');
    expect(weekRange('2026-12-28')).toBe('28 дек – 3 янв');
  });
});

describe('food', () => {
  const e = (over: Partial<Entry>): Entry => ({
    id: 1, date: '2026-11-02', meal: 'lunch', position: 0, productId: 1, dishId: null, grams: 100, portions: null, name: 'x', icon: '',
    protein: 10, fat: 10, carbs: 10, kcal: null, portionName: null, portionG: null, ...over,
  });
  it('kcal100 uses label kcal when stored (even 0)', () => {
    expect(kcal100({ protein: 10, fat: 10, carbs: 10 })).toBe(170);
    expect(kcal100({ protein: 10, fat: 10, carbs: 10, kcal: 160 })).toBe(160);
    expect(kcal100({ protein: 10, fat: 10, carbs: 10, kcal: 0 })).toBe(0);
    expect(kcal100({ protein: 10, fat: 10, carbs: 10, kcal: null })).toBe(170);
  });
  it('kcalAt not rounded', () => {
    expect(kcalAt({ protein: 1, fat: 1, carbs: 1 }, 50)).toBe(8.5);
    expect(kcalAt({ protein: 1, fat: 1, carbs: 1, kcal: 200 }, 150)).toBe(300);
  });
  it('entryMacros / sumMacros / sumKcal', () => {
    expect(entryMacros({ protein: 20, fat: 5, carbs: 1, grams: 150 })).toEqual([30, 7.5, 1.5]);
    expect(sumMacros([])).toEqual([0, 0, 0]);
    expect(sumMacros([[1, 2, 3], [4, 5, 6]])).toEqual([5, 7, 9]);
    expect(sumKcal([e({}), e({ grams: 50, kcal: 100 })])).toBe(220);
  });
  it('dayTotals groups by date and meal', () => {
    const t = dayTotals([e({}), e({ meal: 'dinner', grams: 200 }), e({ date: '2026-11-03', kcal: 100 })]);
    const d = t.get('2026-11-02')!;
    expect(d.count).toBe(2);
    expect(d.macros).toEqual([30, 30, 30]);
    expect(d.kcal).toBe(510);
    expect(d.meals.dinner).toEqual([20, 20, 20]);
    expect(d.mealKcal.lunch).toBe(170);
    expect(d.mealKcal.breakfast).toBe(0);
    expect(t.get('2026-11-03')!.kcal).toBe(100);
    expect(dayTotals([]).size).toBe(0);
  });
});

describe('workouts', () => {
  const byId = new Map([
    [1, ex(1, { name: 'Жим', kind: 'bench', group: 'chest', primary: ['chest'], secondary: ['triceps', 'shoulders', 'abs'], rest: 150 })],
    [2, ex(2, { name: 'Махи', group: 'shoulders', subtitle: 'Средняя дельта', rest: 90 })],
    [3, ex(3, { group: 'chest' })],
  ]);
  it('exerciseSubtitle', () => {
    expect(exerciseSubtitle(byId.get(1)!)).toBe('Грудь · трицепс · плечи');
    expect(exerciseSubtitle(byId.get(2)!)).toBe('Средняя дельта');
    expect(exerciseSubtitle(ex(9, { primary: ['unknown'] }))).toBe('Unknown');
    expect(exerciseSubtitle(ex(9))).toBe('');
  });
  it('dayTitle', () => {
    expect(dayTitle([row(1), row(3), row(2)], byId, 'F')).toBe('Грудь и плечи');
    expect(dayTitle([row(2)], byId, 'F')).toBe('Плечи');
    expect(dayTitle([row(99)], byId, 'F')).toBe('F');
  });
  it('workoutFromPlan', () => {
    const p = prog({ plan: { '1': { '0': [row(1, { kg: '50/55', reps: '8–10', sets: 3 }), row(2, { rest: 60, sets: 1 }), row(99, { sets: 1 })] } } });
    const b = workoutFromPlan(p, 1, 0, '2026-11-02', byId, 'T');
    expect(b).toMatchObject({ date: '2026-11-02', title: 'T', programId: 1, week: 1, weekday: 0 });
    expect(b.exercises[0]).toMatchObject({ name: 'Жим', kind: 'bench', rest: 150, type: 'weight_reps', muscles: 'Грудь · трицепс · плечи' });
    expect(b.exercises[0].sets).toEqual([
      { plannedWeight: 50, plannedReps: 10 }, { plannedWeight: 55, plannedReps: 10 }, { plannedWeight: 55, plannedReps: 10 },
    ]);
    expect(b.exercises[1].rest).toBe(60);
    expect(b.exercises[2]).toMatchObject({ name: 'Упражнение', kind: null, muscles: '', rest: DEFAULT_REST, sets: [{ plannedWeight: null, plannedReps: 10 }] });
    expect(workoutFromPlan(p, 5, 0, '2026-11-02', byId, 'T').exercises).toEqual([]);
  });
  it('workoutFromPlan: row rest 0 is kept (not replaced by exercise rest)', () => {
    const p = prog({ plan: { '1': { '0': [row(1, { rest: 0 })] } } });
    expect(workoutFromPlan(p, 1, 0, '2026-11-02', byId, 'T').exercises[0].rest).toBe(0);
  });
  it('workoutStats caps reps at plan and counts completed sets only', () => {
    const w = workout({
      exercises: [{
        position: 0, exerciseId: 1, name: 'x', kind: null, muscles: null, type: 'weight_reps', rest: 60, skippedAt: null,
        sets: [
          wset({ plannedReps: 10, reps: 12, completedAt: 1 }),
          wset({ plannedReps: 10, reps: 5, completedAt: 1 }),
          wset({ plannedReps: 10, reps: 10, completedAt: null }),
          wset({ plannedReps: 10, reps: null, completedAt: 1 }),
        ],
      }],
    });
    expect(workoutStats(w)).toEqual({ done: 2, total: 4, D: 15, P: 40, pct: 38 });
    expect(workoutStats(workout({ exercises: [] }))).toEqual({ done: 0, total: 0, D: 0, P: 0, pct: 0 });
  });
  it('planMinutes: 45 s + rest per set', () => {
    expect(planMinutes([row(1, { sets: 4 }), row(2, { sets: 3, rest: 60 }), row(99, { sets: 2 })], byId)).toBe(Math.round((4 * 195 + 3 * 105 + 2 * 225) / 60));
    expect(planMinutes([], byId)).toBe(0);
  });
  it('durationMin', () => {
    expect(durationMin(workout({ finishedAt: null }))).toBeNull();
    expect(durationMin(workout({ startedAt: 0, finishedAt: 10_000 }))).toBe(1);
    expect(durationMin(workout({ startedAt: 0, finishedAt: 45 * 60000 }))).toBe(45);
  });
});

describe('slotDone / plannedOpen / buildDays', () => {
  afterEach(() => vi.useRealTimers());
  const p = prog({ plan: { '1': { '0': [row(1)], '4': [row(2)] }, '2': { '0': [row(1)] } } });
  it('slotDone', () => {
    expect(slotDone(undefined, 1, 0, [workout()])).toBe(false);
    expect(slotDone(p, 1, 0, [workout()])).toBe(true);
    expect(slotDone(p, 1, 0, [workout({ programId: 2 })])).toBe(false);
    expect(slotDone(p, 1, 4, [workout()])).toBe(false);
  });
  it('plannedOpen: the program day trained on another date closes it', () => {
    const fri = '2026-11-06';
    expect(plannedOpen(p, fri, [])).toMatchObject({ week: 1, weekday: 4 });
    expect(plannedOpen(p, fri, [workout({ weekday: 4, date: '2026-11-07' })])).toBeNull();
    expect(plannedOpen(p, fri, [workout({ weekday: 4, date: fri })])).not.toBeNull();
    expect(plannedOpen(p, '2026-11-03', [])).toBeNull();
  });
  it('buildDays', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 4, 12));
    const m = me([
      { from: '2026-01-01', type: 'rest', macros: [100, 50, 200] },
      { from: '2026-01-01', type: 'training', macros: [150, 60, 300] },
    ]);
    const entries: Entry[] = [{
      id: 1, date: '2026-11-03', meal: 'lunch', position: 0, productId: 1, dishId: null, grams: 100, portions: null, name: 'x', icon: '',
      protein: 10, fat: 10, carbs: 10, kcal: null, portionName: null, portionG: null,
    }];
    const ws = [workout({ programId: null, week: null, weekday: null, date: '2026-11-03' })];
    const days = buildDays(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-06'], m, p, ws, entries);
    expect(days.map((d) => d.isTraining)).toEqual([true, true, false, true]);
    expect(days[0].norm).toEqual([150, 60, 300]);
    expect(days[2].norm).toEqual([100, 50, 200]);
    expect(days[2].isToday).toBe(true);
    expect(days[3].isPlan).toBe(true);
    expect(days[3].eaten).toBeNull();
    expect(days[3].kcal).toBeNull();
    expect(days[1].eaten).toEqual([10, 10, 10]);
    expect(days[1].kcal).toBe(170);
    expect(days[1].workout).not.toBeNull();
    expect(days[0].eaten).toEqual([0, 0, 0]);
    expect(days[0].meals).toBeNull();
  });
});
