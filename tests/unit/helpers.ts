import type { Exercise, Me, Program, Workout, WSet } from '../../src/lib/types';

export const ex = (id: number, over: Partial<Exercise> = {}): Exercise => ({
  id, own: false, name: `Ex${id}`, type: 'weight_reps', kind: null, group: null, subtitle: null,
  primary: [], secondary: [], description: null, steps: [], rest: 120, ...over,
});

export const prog = (over: Partial<Program> = {}): Program => ({
  id: 1, name: 'P', weekdays: [0, 2, 4], weeks: 2, startDate: '2026-11-02', active: true, plan: {},
  createdAt: new Date(2026, 0, 1).getTime(), updatedAt: 0, ...over,
});

export const wset = (over: Partial<WSet> = {}): WSet => ({
  index: 0, plannedWeight: null, plannedReps: 10, weight: null, reps: null, completedAt: null, ...over,
});

export const workout = (over: Partial<Workout> = {}): Workout => ({
  id: 1, programId: 1, week: 1, weekday: 0, title: 'W', date: '2026-11-02', status: 'finished',
  startedAt: 0, finishedAt: null, exercises: [], ...over,
});

export const me = (norms: Me['norms']): Me => ({
  user: { id: 1, email: 'a@b.cd', theme: 'system', goal: 'keep', createdAt: 0 },
  profile: { name: null, weight: null, height: null, birthDate: null, steps: null, sex: null, bodyFat: null, trainingMode: null, trainingMin: null, trainingKcal: null },
  norms,
});
