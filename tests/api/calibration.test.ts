import { describe, it, expect, beforeAll } from 'vitest';
import { Client, newUser, ownExercise, programBody, simpleWorkout, todayUtc, workoutFromPlan } from './helpers';

const TODAY = todayUtc();
let c: Client; let E: number; let P: number; let T: number; let Z: number; let N: number;
beforeAll(async () => {
  c = await newUser({}, TODAY);
  E = await ownExercise(c); P = await ownExercise(c); Z = await ownExercise(c); N = await ownExercise(c);
  T = await ownExercise(c, { type: 'time' });
});

const r = (exerciseId: number, reps: string, kg = '', pct: number | null = null, sets = 2) => ({ exerciseId, sets, reps, kg, pct });

/** Creates the program, runs the workout of (week, weekday) with the given done sets per position, finishes it. */
async function runAndFinish(client: Client, plan: any, week: number, weekday: number, done: Record<number, [number, number][]>, types: Record<number, string> = {}) {
  const p = (await client.post('/programs', programBody({ weekdays: [0, 2], weeks: 3, plan }))).body.program;
  const w = (await client.post('/workouts', workoutFromPlan(p, week, weekday, TODAY, types))).body.workout;
  for (const [pos, sets] of Object.entries(done)) {
    for (const [i, [weight, reps]] of sets.entries()) {
      const s = await client.put(`/workouts/${w.id}/exercises/${pos}/sets/${i}`, { weight, reps });
      expect(s.status).toBe(200);
    }
  }
  const f = await client.post(`/workouts/${w.id}/finish`);
  expect(f.status).toBe(200);
  return (await client.get(`/programs/${p.id}`)).body.program;
}

describe('calibration on finish', () => {
  it('fills later empty kg: same reps → same weight, Epley for other reps, pct scaling; filled and earlier slots untouched', async () => {
    const plan = {
      1: { 0: [r(E, '10')], 2: [r(E, '10'), r(T, '60'), r(Z, '15'), r(P, '10', '50'), r(N, '10')] },
      2: { 0: [r(E, '8'), r(T, '60'), r(Z, '15'), r(P, '10'), r(N, '10')], 2: [r(E, '10', '70')] },
      3: { 0: [r(E, '10', '', 70)], 2: [r(E, '8–12')] },
    };
    // done in week 1, Wednesday: E best 60×10 (e1RM 80), T is time, Z bodyweight 0, P had a planned weight, N not done.
    const prog = await runAndFinish(c, plan, 1, 2, {
      0: [[60, 10], [50, 12]], 1: [[0, 60], [0, 60]], 2: [[0, 15], [0, 15]], 3: [[50, 10], [55, 10]],
    }, { [T]: 'time' });
    const kg = (wk: number, wd: number, i = 0) => prog.plan[wk][wd][i].kg;
    expect(kg(1, 0)).toBe('');      // earlier slot untouched
    expect(kg(1, 2)).toBe('');      // the slot it was done in stays as planned
    expect(kg(2, 0)).toBe('62,5');  // 80 / (1 + 8/30) = 63.2 → 62.5 (step 2.5)
    expect(kg(2, 2)).toBe('70');    // already filled
    expect(kg(3, 0)).toBe('42,5');  // 60 × 70 % = 42 → 42.5
    expect(kg(3, 2)).toBe('57,5');  // top of 8–12 = 12: 80 / 1.4 = 57.1 → 57.5
    expect(kg(2, 0, 1)).toBe('');   // time exercise ignored
    expect(kg(2, 0, 2)).toBe('');   // weight 0 ignored
    expect(kg(2, 0, 3)).toBe('');   // had a planned weight in the workout → not a calibration
    expect(kg(2, 0, 4)).toBe('');   // nothing done
  });

  it('scales relative to the pct of the slot it was done in (done at 70 % → 100 % slot gets weight / 0.7)', async () => {
    const plan = { 1: { 0: [r(E, '10', '', 70)], 2: [r(E, '10', '', 100), r(E, '10', '', 85)] }, 2: { 0: [r(E, '10')] } };
    const prog = await runAndFinish(c, plan, 1, 0, { 0: [[42, 10]] });
    expect(prog.plan[1][2][0].kg).toBe('60');
    expect(prog.plan[1][2][1].kg).toBe('50');  // 42/0.7×0.85 = 51 → 50
    expect(prog.plan[2][0][0].kg).toBe('60');  // pct null = 100
  });

  it('light weights use a 1 kg step; never below one step', async () => {
    const plan = { 1: { 0: [r(E, '10')], 2: [r(E, '20'), r(E, '10', '', 30)] } };
    const prog = await runAndFinish(c, plan, 1, 0, { 0: [[12, 10]] });
    expect(prog.plan[1][2][0].kg).toBe('10');  // 12×(4/3)/(5/3) = 9.6 → 10
    expect(prog.plan[1][2][1].kg).toBe('4');   // 12 × 30 % = 3.6 → 4
  });

  it('only completed sets count; a set cleared again does not calibrate', async () => {
    const plan = { 1: { 0: [r(E, '10')], 2: [r(E, '10')] } };
    const p = (await c.post('/programs', programBody({ weekdays: [0, 2], weeks: 1, plan }))).body.program;
    const w = (await c.post('/workouts', workoutFromPlan(p, 1, 0, TODAY))).body.workout;
    await c.put(`/workouts/${w.id}/exercises/0/sets/0`, { weight: 60, reps: 10 });
    await c.put(`/workouts/${w.id}/exercises/0/sets/0`, { clear: true });
    await c.post(`/workouts/${w.id}/finish`);
    expect((await c.get(`/programs/${p.id}`)).body.program.plan[1][2][0].kg).toBe('');
  });

  it("a workout without a program / of another user's program does not touch any program", async () => {
    const other = await newUser({}, TODAY);
    const plan = { 1: { 0: [r(E, '10')], 2: [r(E, '10')] } };
    const p = (await c.post('/programs', programBody({ weekdays: [0, 2], weeks: 1, plan }))).body.program;
    const body = workoutFromPlan(p, 1, 0, TODAY);
    const res = await other.post('/workouts', body); // programId gets dropped (or 400 if E is c's own exercise)
    if (res.status === 201) {
      const w = res.body.workout;
      await other.put(`/workouts/${w.id}/exercises/0/sets/0`, { weight: 60, reps: 10 });
      await other.post(`/workouts/${w.id}/finish`);
    }
    expect((await c.get(`/programs/${p.id}`)).body.program.plan[1][2][0].kg).toBe('');
  });

  it('finishing twice is harmless (already filled slots stay)', async () => {
    const plan = { 1: { 0: [r(E, '10')], 2: [r(E, '10')] } };
    const p = (await c.post('/programs', programBody({ weekdays: [0, 2], weeks: 1, plan }))).body.program;
    const w = (await c.post('/workouts', workoutFromPlan(p, 1, 0, TODAY))).body.workout;
    await c.put(`/workouts/${w.id}/exercises/0/sets/0`, { weight: 60, reps: 10 });
    await c.post(`/workouts/${w.id}/finish`);
    await c.put(`/workouts/${w.id}/exercises/0/sets/0`, { weight: 100, reps: 10 });
    await c.post(`/workouts/${w.id}/finish`);
    expect((await c.get(`/programs/${p.id}`)).body.program.plan[1][2][0].kg).toBe('60');
  });

  // fixed (was a bug): the comment (api.js:137) promises "same reps → the same weight", but the result is always rounded to the
  // 2.5 kg grid (1 kg below 20 kg) — api.js:161-162. A done 61 kg × 10 becomes 60 for the next 10-rep slot.
  it('same reps → exactly the same weight (61 kg stays 61)', async () => {
    const plan = { 1: { 0: [r(E, '10')], 2: [r(E, '10')] } };
    const prog = await runAndFinish(c, plan, 1, 0, { 0: [[61, 10]] });
    expect(prog.plan[1][2][0].kg).toBe('61');
  });

  // fixed (was a bug): dumbbells of 7.5 / 17.5 kg are rounded to whole kg (step 1 below 20 kg): 7.5 × 10 → "8".
  it('same reps → exactly the same weight (7.5 kg stays 7,5)', async () => {
    const plan = { 1: { 0: [r(E, '10')], 2: [r(E, '10')] } };
    const prog = await runAndFinish(c, plan, 1, 0, { 0: [[7.5, 10]] });
    expect(prog.plan[1][2][0].kg).toBe('7,5');
  });

  // Questionable: a workout logged directly as finished (POST /workouts status:'finished') never calibrates —
  // calibrateProgram runs only from POST /workouts/:id/finish.
  it('a workout created already finished does not calibrate', async () => {
    const plan = { 1: { 0: [r(E, '10')], 2: [r(E, '10')] } };
    const p = (await c.post('/programs', programBody({ weekdays: [0, 2], weeks: 1, plan }))).body.program;
    const body: any = workoutFromPlan(p, 1, 0, TODAY);
    body.status = 'finished';
    body.exercises[0].sets = [{ plannedWeight: null, plannedReps: 10, weight: 60, reps: 10 }];
    expect((await c.post('/workouts', body)).status).toBe(201);
    expect((await c.get(`/programs/${p.id}`)).body.program.plan[1][2][0].kg).toBe('');
  });

  // Questionable: an exercise marked skipped still calibrates if it has completed sets.
  it('a skipped exercise with done sets still calibrates', async () => {
    const plan = { 1: { 0: [r(E, '10')], 2: [r(E, '10')] } };
    const p = (await c.post('/programs', programBody({ weekdays: [0, 2], weeks: 1, plan }))).body.program;
    const w = (await c.post('/workouts', workoutFromPlan(p, 1, 0, TODAY))).body.workout;
    await c.put(`/workouts/${w.id}/exercises/0/sets/0`, { weight: 60, reps: 10 });
    await c.patch(`/workouts/${w.id}/exercises/0`, { skipped: true });
    await c.post(`/workouts/${w.id}/finish`);
    expect((await c.get(`/programs/${p.id}`)).body.program.plan[1][2][0].kg).toBe('60');
  });

  it('a free workout (no program) finishes fine', async () => {
    const w = (await c.post('/workouts', simpleWorkout())).body.workout;
    expect((await c.post(`/workouts/${w.id}/finish`)).status).toBe(200);
  });
});
