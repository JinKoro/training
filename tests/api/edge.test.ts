import { describe, it, expect } from 'vitest';
import { newUser, ownExercise, programBody, simpleWorkout, todayUtc } from './helpers';

const TODAY = todayUtc();
const six = Array.from({ length: 6 }, (_, i) => ({ name: `Упр ${i}`, sets: [{ plannedReps: 10 }] }));

describe('workout list size', () => {
  it('16 workouts × 6 exercises (96) list fine', async () => {
    const c = await newUser({}, TODAY);
    for (let i = 0; i < 16; i++) await c.post('/workouts', simpleWorkout({ exercises: six }));
    const r = await c.get('/workouts');
    expect(r.status).toBe(200);
    expect(r.body.workouts).toHaveLength(16);
  });

  // fixed (was a bug): loadWorkouts (api.js:219-226) binds every workout id and then every workout_exercise id into one
  // "IN (?, ?, …)". D1 allows at most 100 bound parameters per query, so as soon as the listed workouts hold more than
  // 100 exercises (≈ 17 workouts of 6 exercises) GET /workouts — with or without from/to — answers 500 server_error.
  it('17 workouts × 6 exercises (102) still list', async () => {
    const c = await newUser({}, TODAY);
    for (let i = 0; i < 17; i++) await c.post('/workouts', simpleWorkout({ exercises: six }));
    const r = await c.get('/workouts');
    expect(r.status).toBe(200);
    expect(r.body.workouts).toHaveLength(17);
  });

  it('…also with a date range', async () => {
    const c = await newUser({}, TODAY);
    for (let i = 0; i < 17; i++) await c.post('/workouts', simpleWorkout({ exercises: six }));
    expect((await c.get(`/workouts?from=${TODAY}&to=${TODAY}`)).status).toBe(200);
  });
});

describe('number parsing (validate.js num)', () => {
  // fixed (was a bug): num() (validate.js:25-27) converts strings with Number(), so a required number given as "" or "  " becomes 0
  // (the optional-check only catches "" when optional), and "0x10" becomes 16, "1e2" 100. An empty set form saves a
  // completed set of 0 kg × 0 reps; a product with empty macros is created as 0/0/0.
  it('PUT a set with empty weight / reps → 400 (not a completed 0 × 0 set)', async () => {
    const c = await newUser({}, TODAY);
    const w = (await c.post('/workouts', simpleWorkout())).body.workout;
    expect((await c.put(`/workouts/${w.id}/exercises/0/sets/0`, { weight: '', reps: ' ' })).status).toBe(400);
  });

  it('a product with empty macros → 400', async () => {
    const c = await newUser({}, TODAY);
    expect((await c.post('/products', { name: 'Пустой', protein: '', fat: '', carbs: '' })).status).toBe(400);
  });

  it('hex strings are not numbers ("0x10" grams → 400)', async () => {
    const c = await newUser({}, TODAY);
    expect((await c.post('/products', { name: 'Хекс', protein: '0x10', fat: 1, carbs: 1 })).status).toBe(400);
  });

  it('decimal comma works, but only the first comma is converted ("1,5" ok, "1,000,5" → 400)', async () => {
    const c = await newUser({}, TODAY);
    expect((await c.post('/products', { name: 'Запятая', protein: '1,5', fat: 1, carbs: 1 })).status).toBe(201);
    expect((await c.post('/products', { name: 'Запятые', protein: '1,000,5', fat: 1, carbs: 1 })).status).toBe(400);
  });
});

describe('questionable behaviour', () => {
  // Questionable: an optional text of only spaces is stored as "" instead of null (validate.js:18-22 trims after the
  // empty check), so the client sees subtitle "" rather than "no subtitle".
  it('whitespace-only optional subtitle is stored as ""', async () => {
    const c = await newUser({}, TODAY);
    const r = await c.post('/exercises', { name: `Пробел ${Date.now()}`, group: 'chest', primary: ['chest'], subtitle: '   ' });
    expect(r.body.exercise.subtitle).toBe('');
  });

  // Questionable: finishing an already finished workout moves finishedAt (its duration changes).
  it('finishing again moves finishedAt', async () => {
    const c = await newUser({}, TODAY);
    const w = (await c.post('/workouts', simpleWorkout())).body.workout;
    const f1 = (await c.post(`/workouts/${w.id}/finish`)).body.workout.finishedAt;
    await new Promise((r) => setTimeout(r, 5));
    const f2 = (await c.post(`/workouts/${w.id}/finish`)).body.workout.finishedAt;
    expect(f2).toBeGreaterThan(f1);
  });

  // Questionable: deleting an own exercise used in a program leaves the plan pointing at an exercise that
  // GET /exercises no longer returns (the client cannot show its name).
  it('deleting an exercise used in a program keeps the plan row', async () => {
    const c = await newUser({}, TODAY);
    const id = await ownExercise(c);
    const p = (await c.post('/programs', programBody({ plan: { 1: { 0: [{ exerciseId: id, sets: 3, reps: '10' }] } } }))).body.program;
    await c.del(`/exercises/${id}`);
    expect((await c.get(`/programs/${p.id}`)).body.program.plan[1][0][0].exerciseId).toBe(id);
    expect((await c.get('/exercises')).body.exercises.some((e: any) => e.id === id)).toBe(false);
  });

  // Questionable: deleting the active program leaves no active one (an older program is not re-activated, and
  // there is no endpoint to activate a program).
  it('deleting the active program leaves none active', async () => {
    const c = await newUser({}, TODAY);
    await c.post('/programs', programBody({ name: 'Старая' }));
    const p2 = (await c.post('/programs', programBody({ name: 'Новая' }))).body.program;
    await c.del(`/programs/${p2.id}`);
    expect((await c.get('/programs')).body.programs.filter((p: any) => p.active)).toEqual([]);
  });
});
