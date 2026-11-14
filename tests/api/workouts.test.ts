import { describe, it, expect, beforeAll } from 'vitest';
import { Client, addDays, newUser, ownExercise, programBody, simpleWorkout, todayUtc, workoutFromPlan } from './helpers';

const TODAY = todayUtc();
let a: Client; let b: Client; let ex1: number; let ex2: number;
beforeAll(async () => {
  a = await newUser({}, TODAY); b = await newUser({}, TODAY);
  const lib = (await a.get('/exercises')).body.exercises.filter((e: any) => e.type === 'weight_reps');
  ex1 = lib[0].id; ex2 = lib[1].id;
});

async function planWorkout(c: Client) {
  const p = (await c.post('/programs', programBody({
    weekdays: [0], weeks: 1,
    plan: { 1: { 0: [{ exerciseId: ex1, sets: 2, reps: '8–10', kg: '60/62,5' }, { exerciseId: ex2, sets: 1, reps: '12', kg: '' }] } },
  }))).body.program;
  const r = await c.post('/workouts', workoutFromPlan(p, 1, 0, TODAY));
  expect(r.status).toBe(201);
  return { p, w: r.body.workout };
}

describe('workouts: create', () => {
  it('creates from a plan the way the client does', async () => {
    const { p, w } = await planWorkout(a);
    expect(w).toMatchObject({ programId: p.id, week: 1, weekday: 0, date: TODAY, status: 'in_progress', finishedAt: null, title: 'Тренировка' });
    expect(w.exercises).toHaveLength(2);
    expect(w.exercises[0]).toMatchObject({ position: 0, exerciseId: ex1, skippedAt: null, type: 'weight_reps' });
    expect(w.exercises[0].sets).toEqual([
      { index: 0, plannedWeight: 60, plannedReps: 10, weight: null, reps: null, completedAt: null },
      { index: 1, plannedWeight: 62.5, plannedReps: 10, weight: null, reps: null, completedAt: null },
    ]);
    expect(w.exercises[1].sets[0].plannedWeight).toBeNull();
  });

  it('a logged (finished) workout with done sets', async () => {
    const r = await a.post('/workouts', simpleWorkout({
      status: 'finished',
      exercises: [{ name: 'Свободное', sets: [{ plannedReps: 10, weight: '20,5', reps: 10 }, { plannedReps: 10, weight: null, reps: null }] }],
    }));
    expect(r.status).toBe(201);
    const w = r.body.workout;
    expect(w.status).toBe('finished');
    expect(w.finishedAt).toEqual(expect.any(Number));
    expect(w.exercises[0]).toMatchObject({ exerciseId: null, type: 'weight_reps', rest: 120 });
    expect(w.exercises[0].sets[0]).toMatchObject({ weight: 20.5, reps: 10, completedAt: expect.any(Number) });
    expect(w.exercises[0].sets[1].completedAt).toBeNull();
  });

  it.each([
    ['no exercises', { exercises: [] }, 'exercises'], ['exercises not an array', { exercises: {} }, 'exercises'],
    ['empty title', { title: ' ' }, 'title'], ['bad date', { date: '2026-13-01' }, 'date'], ['no date', { date: undefined }, 'date'],
    ['week 53', { week: 53 }, 'week'], ['weekday 7', { weekday: 7 }, 'weekday'], ['programId 0', { programId: 0 }, 'programId'],
    ['exercise without name', { exercises: [{ sets: [] }] }, 'exercises'],
    ['set without plannedReps', { exercises: [{ name: 'x', sets: [{ plannedWeight: 10 }] }] }, 'sets'],
    ['set weight > 1000', { exercises: [{ name: 'x', sets: [{ plannedReps: 1, weight: 1000.5, reps: 1 }] }] }, 'sets'],
    ['set reps fractional', { exercises: [{ name: 'x', sets: [{ plannedReps: 1, reps: 1.5 }] }] }, 'sets'],
    ['21 sets', { exercises: [{ name: 'x', sets: Array.from({ length: 21 }, () => ({ plannedReps: 1 })) }] }, 'exercises'],
    ['31 exercises', { exercises: Array.from({ length: 31 }, () => ({ name: 'x', sets: [] })) }, 'exercises'],
    ['bad exercise type', { exercises: [{ name: 'x', type: 'cardio', sets: [] }] }, 'exercises'],
  ])('rejects %s', async (_n, over, field) => {
    const r = await a.post('/workouts', simpleWorkout(over));
    expect(r.status).toBe(400);
    expect(r.body.field).toBe(field);
  });

  it("another user's programId is dropped (programId null)", async () => {
    const p = (await b.post('/programs', programBody())).body.program;
    const r = await a.post('/workouts', simpleWorkout({ programId: p.id, week: 1, weekday: 0 }));
    expect(r.status).toBe(201);
    expect(r.body.workout.programId).toBeNull();
  });

  // fixed (was a bug): the workout row is INSERTed with program_id before the ownership check (api.js:589-606). For a program id
  // that does not exist (e.g. just deleted on another device) the FK on workouts.program_id fails → 500 server_error
  // instead of creating the workout with programId null (as done for a foreign program).
  it('a nonexistent programId does not crash (workout created with programId null)', async () => {
    const c = await newUser({}, TODAY);
    const p = (await c.post('/programs', programBody())).body.program;
    await c.del(`/programs/${p.id}`);
    const r = await c.post('/workouts', simpleWorkout({ programId: p.id, week: 1, weekday: 0 }));
    expect(r.status).toBe(201);
    expect(r.body.workout.programId).toBeNull();
  });

  // fixed (was a bug): workout_exercises.exercise_id has an FK to exercises; an unknown exerciseId makes the INSERT fail with 500
  // (api.js:276-279), and the workout row created just before (api.js:589) stays behind with no exercises.
  it('an unknown exerciseId → 4xx and no half-created workout is left', async () => {
    const c = await newUser({}, TODAY);
    const r = await c.post('/workouts', simpleWorkout({ exercises: [{ exerciseId: 99999999, name: 'x', sets: [{ plannedReps: 5 }] }] }));
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
    expect((await c.get('/workouts')).body.workouts).toHaveLength(0);
  });

  it("another user's own exerciseId is rejected in a workout", async () => {
    const foreign = await ownExercise(b);
    const r = await a.post('/workouts', simpleWorkout({ exercises: [{ exerciseId: foreign, name: 'x', sets: [{ plannedReps: 5 }] }] }));
    expect(r.status).toBe(400);
  });
});

describe('workouts: sets, skip, finish, edit, delete', () => {
  it('PUT a set: decimal comma weight, completes; clear resets it', async () => {
    const { w } = await planWorkout(a);
    let r = await a.put(`/workouts/${w.id}/exercises/0/sets/1`, { weight: '62,5', reps: 9 });
    expect(r.status).toBe(200);
    let s = (await a.get(`/workouts/${w.id}`)).body.workout.exercises[0].sets[1];
    expect(s).toMatchObject({ weight: 62.5, reps: 9, completedAt: expect.any(Number), plannedWeight: 62.5 });
    r = await a.put(`/workouts/${w.id}/exercises/0/sets/1`, { clear: true });
    expect(r.status).toBe(200);
    s = (await a.get(`/workouts/${w.id}`)).body.workout.exercises[0].sets[1];
    expect(s).toMatchObject({ weight: null, reps: null, completedAt: null });
  });

  it.each([
    ['missing weight', { reps: 5 }, 400], ['negative weight', { weight: -1, reps: 5 }, 400], ['huge weight', { weight: 1e9, reps: 5 }, 400],
    ['fractional reps', { weight: 10, reps: 5.5 }, 400], ['reps as text', { weight: 10, reps: 'abc' }, 400], ['clear as string', { clear: 'true' }, 400],
  ])('PUT a set with %s → %i', async (_n, body, status) => {
    const { w } = await planWorkout(a);
    expect((await a.put(`/workouts/${w.id}/exercises/0/sets/0`, body)).status).toBe(status);
  });

  it('set / exercise positions out of range: 404 for missing, 400 beyond limits', async () => {
    const { w } = await planWorkout(a);
    expect((await a.put(`/workouts/${w.id}/exercises/0/sets/5`, { weight: 1, reps: 1 })).status).toBe(404);
    expect((await a.put(`/workouts/${w.id}/exercises/0/sets/20`, { weight: 1, reps: 1 })).status).toBe(400);
    expect((await a.put(`/workouts/${w.id}/exercises/9/sets/0`, { weight: 1, reps: 1 })).status).toBe(404);
    expect((await a.put(`/workouts/${w.id}/exercises/30/sets/0`, { weight: 1, reps: 1 })).status).toBe(400);
    expect((await a.patch(`/workouts/${w.id}/exercises/x`, { skipped: true })).status).toBe(400);
    expect((await a.get(`/workouts/${w.id}/nothing`)).status).toBe(404);
  });

  it('PATCH skip / unskip an exercise', async () => {
    const { w } = await planWorkout(a);
    expect((await a.patch(`/workouts/${w.id}/exercises/1`, { skipped: true })).status).toBe(200);
    expect((await a.get(`/workouts/${w.id}`)).body.workout.exercises[1].skippedAt).toEqual(expect.any(Number));
    expect((await a.patch(`/workouts/${w.id}/exercises/1`, { skipped: false })).status).toBe(200);
    expect((await a.get(`/workouts/${w.id}`)).body.workout.exercises[1].skippedAt).toBeNull();
  });

  it('finish sets status and finishedAt', async () => {
    const { w } = await planWorkout(a);
    const r = await a.post(`/workouts/${w.id}/finish`);
    expect(r.status).toBe(200);
    expect(r.body.workout).toMatchObject({ id: w.id, status: 'finished', finishedAt: expect.any(Number) });
  });

  it('PUT replaces exercises and sets (editing a past workout)', async () => {
    const { w } = await planWorkout(a);
    const r = await a.put(`/workouts/${w.id}`, { exercises: [{ name: 'Новое', sets: [{ plannedReps: 5, weight: 40, reps: 5 }] }] });
    expect(r.status).toBe(200);
    expect(r.body.workout.exercises).toHaveLength(1);
    expect(r.body.workout.exercises[0]).toMatchObject({ name: 'Новое', exerciseId: null });
    expect(r.body.workout.exercises[0].sets[0]).toMatchObject({ weight: 40, reps: 5, completedAt: expect.any(Number) });
    expect((await a.put(`/workouts/${w.id}`, { exercises: [] })).status).toBe(400);
  });

  it('DELETE removes the workout; everything after is 404', async () => {
    const { w } = await planWorkout(a);
    expect((await a.del(`/workouts/${w.id}`)).status).toBe(200);
    expect((await a.get(`/workouts/${w.id}`)).status).toBe(404);
    expect((await a.del(`/workouts/${w.id}`)).status).toBe(404);
    expect((await a.post(`/workouts/${w.id}/finish`)).status).toBe(404);
    expect((await a.put(`/workouts/${w.id}/exercises/0/sets/0`, { weight: 1, reps: 1 })).status).toBe(404);
  });

  it('ids reused after delete do not resurrect old exercises/sets', async () => {
    const c = await newUser({}, TODAY);
    const w1 = (await c.post('/workouts', simpleWorkout())).body.workout;
    await c.del(`/workouts/${w1.id}`);
    const w2 = (await c.post('/workouts', simpleWorkout({ exercises: [{ name: 'Одно', sets: [{ plannedReps: 3 }] }] }))).body.workout;
    expect(w2.exercises).toHaveLength(1);
    expect(w2.exercises[0].sets).toHaveLength(1);
  });

  it("another user's workout: every route is 404 and nothing changes", async () => {
    const { w } = await planWorkout(a);
    expect((await b.get(`/workouts/${w.id}`)).status).toBe(404);
    expect((await b.put(`/workouts/${w.id}`, simpleWorkout())).status).toBe(404);
    expect((await b.del(`/workouts/${w.id}`)).status).toBe(404);
    expect((await b.post(`/workouts/${w.id}/finish`)).status).toBe(404);
    expect((await b.patch(`/workouts/${w.id}/exercises/0`, { skipped: true })).status).toBe(404);
    expect((await b.put(`/workouts/${w.id}/exercises/0/sets/0`, { weight: 1, reps: 1 })).status).toBe(404);
    const still = (await a.get(`/workouts/${w.id}`)).body.workout;
    expect(still.status).toBe('in_progress');
    expect(still.exercises[0].skippedAt).toBeNull();
    expect(still.exercises[0].sets[0].completedAt).toBeNull();
    expect((await b.get('/workouts')).body.workouts.some((x: any) => x.id === w.id)).toBe(false);
  });
});

describe('workouts: list by date range', () => {
  it('filters inclusively by from/to, newest first', async () => {
    const c = await newUser({}, TODAY);
    const d = (n: number) => addDays('2026-03-10', n);
    const ids: Record<string, number> = {};
    for (const n of [-1, 0, 1, 2, 3]) ids[d(n)] = (await c.post('/workouts', simpleWorkout({ date: d(n) }))).body.workout.id;
    const r = await c.get(`/workouts?from=${d(0)}&to=${d(2)}`);
    expect(r.status).toBe(200);
    expect(r.body.workouts.map((w: any) => w.date)).toEqual([d(2), d(1), d(0)]);
    expect((await c.get('/workouts')).body.workouts).toHaveLength(5);
    expect((await c.get(`/workouts?from=${d(3)}&to=${d(0)}`)).body.workouts).toEqual([]);
  });

  it('bad from / to → 400', async () => {
    expect((await a.get('/workouts?from=2026-01-01&to=bad')).status).toBe(400);
    expect((await a.get('/workouts?from=2026-02-31&to=2026-03-01')).status).toBe(400);
  });

  // Questionable: only one bound given → the filter is ignored and every workout is returned.
  it('only `from` → all workouts (filter ignored)', async () => {
    const c = await newUser({}, TODAY);
    await c.post('/workouts', simpleWorkout({ date: '2020-01-01' }));
    expect((await c.get('/workouts?from=2026-01-01')).body.workouts).toHaveLength(1);
  });
});
