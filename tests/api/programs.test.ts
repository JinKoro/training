import { describe, it, expect, beforeAll } from 'vitest';
import { Client, addDays, mondayOf, newUser, ownExercise, programBody, todayUtc, simpleWorkout } from './helpers';

const TODAY = todayUtc();
const MON = mondayOf(TODAY);
let a: Client; let b: Client; let ex: number;
beforeAll(async () => {
  a = await newUser({}, TODAY); b = await newUser({}, TODAY);
  ex = (await a.get('/exercises')).body.exercises[0].id;
});
const row = (over: Record<string, unknown> = {}) => ({ exerciseId: ex, sets: 3, reps: '10', kg: '', rest: null, note: '', pct: null, ...over });

describe('programs: create', () => {
  it('creates an active program starting this Monday, normalizes weekdays and plan rows', async () => {
    const r = await a.post('/programs', programBody({
      weekdays: [4, 0, 4, '2'], weeks: 2,
      plan: { 1: { 0: [row({ reps: '8–10', kg: 60, rest: 90, note: ' n ', pct: '70' })] } },
    }));
    expect(r.status).toBe(201);
    const p = r.body.program;
    expect(p).toMatchObject({ weekdays: [0, 2, 4], weeks: 2, startDate: MON, active: true, level: null });
    expect(p.plan).toEqual({ 1: { 0: [{ exerciseId: ex, sets: 3, reps: '8–10', kg: '60', rest: 90, note: 'n', pct: 70 }] } });
  });

  it('only one program is active: a new one deactivates the others', async () => {
    const c = await newUser({}, TODAY);
    const p1 = (await c.post('/programs', programBody())).body.program;
    const p2 = (await c.post('/programs', programBody())).body.program;
    const list = (await c.get('/programs')).body.programs;
    expect(list.filter((p: any) => p.active).map((p: any) => p.id)).toEqual([p2.id]);
    expect((await c.get(`/programs/${p1.id}`)).body.program.active).toBe(false);
  });

  it('drops rows on weekdays not selected, weeks beyond `weeks`, bad keys and empty days', async () => {
    const r = await a.post('/programs', programBody({
      weekdays: [0, 2], weeks: 2,
      plan: { 1: { 0: [row()], 1: [row()], 2: [], 7: [row()] }, 2: { 2: [row()] }, 3: { 0: [row()] }, 0: { 0: [row()] }, x: { 0: [row()] }, 1.5: { 0: [row()] } },
    }));
    expect(r.status).toBe(201);
    expect(Object.keys(r.body.program.plan)).toEqual(['1', '2']);
    expect(Object.keys(r.body.program.plan[1])).toEqual(['0']);
    expect(Object.keys(r.body.program.plan[2])).toEqual(['2']);
  });

  it('plan may be absent or not an object → empty plan', async () => {
    expect((await a.post('/programs', programBody({ plan: undefined }))).body.program.plan).toEqual({});
    expect((await a.post('/programs', programBody({ plan: 'x' }))).body.program.plan).toEqual({});
  });

  it.each([
    [{ name: '' }, 'name'], [{ name: 'x'.repeat(81) }, 'name'], [{ weekdays: [] }, 'weekdays'], [{ weekdays: [7] }, 'weekdays'],
    [{ weekdays: [1.5] }, 'weekdays'], [{ weekdays: '0,1' }, 'weekdays'], [{ weeks: 0 }, 'weeks'], [{ weeks: 53 }, 'weeks'], [{ weeks: 2.5 }, 'weeks'],
    [{ level: 3 }, 'level'], [{ level: -1 }, 'level'], [{ level: 1.5 }, 'level'], [{ level: 'pro' }, 'level'],
  ])('rejects %o', async (over, field) => {
    const r = await a.post('/programs', programBody(over));
    expect(r.status).toBe(400);
    expect(r.body.field).toBe(field);
  });

  it.each([
    ['reps letters', { reps: 'abc' }, 'invalid_reps'], ['reps open range', { reps: '10–' }, 'invalid_reps'], ['reps 4 digits', { reps: '1000' }, 'invalid_reps'],
    ['reps empty', { reps: '' }, 'invalid_length'], ['reps missing', { reps: undefined }, 'invalid_length'], ['reps with spaces inside', { reps: '8 - 10' }, 'invalid_reps'],
    ['sets 0', { sets: 0 }, 'invalid_number'], ['sets 21', { sets: 21 }, 'invalid_number'], ['sets missing', { sets: undefined }, 'invalid_number'],
    ['exerciseId missing', { exerciseId: undefined }, 'invalid_number'], ['exerciseId 0', { exerciseId: 0 }, 'invalid_number'],
    ['rest 901', { rest: 901 }, 'invalid_number'], ['pct 29', { pct: 29 }, 'invalid_number'], ['pct 151', { pct: 151 }, 'invalid_number'],
    ['pct fraction', { pct: 72.5 }, 'invalid_number'], ['note too long', { note: 'x'.repeat(121) }, 'invalid_length'], ['kg too long', { kg: '1'.repeat(41) }, 'invalid_length'],
  ])('rejects a plan row with %s', async (_n, over, code) => {
    const r = await a.post('/programs', programBody({ plan: { 1: { 0: [row(over)] } } }));
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: code, field: 'plan' });
  });

  it('accepts reps 10 (number), "10-12", "10–12"; rejects >30 rows a day', async () => {
    const ok = await a.post('/programs', programBody({ plan: { 1: { 0: [row({ reps: 10 }), row({ reps: '10-12' }), row({ reps: '10–12' })] } } }));
    expect(ok.status).toBe(201);
    expect(ok.body.program.plan[1][0].map((r: any) => r.reps)).toEqual(['10', '10-12', '10–12']);
    const many = await a.post('/programs', programBody({ plan: { 1: { 0: Array.from({ length: 31 }, () => row()) } } }));
    expect(many.status).toBe(400);
  });

  it('rows on a non-selected weekday are not validated (dropped silently)', async () => {
    const r = await a.post('/programs', programBody({ weekdays: [0], plan: { 1: { 3: [row({ reps: 'garbage' })] } } }));
    expect(r.status).toBe(201);
    expect(r.body.program.plan).toEqual({});
  });

  it('level 0..2 (also as a string) is stored', async () => {
    for (const level of [0, 1, '2']) {
      const r = await a.post('/programs', programBody({ level }));
      expect(r.status).toBe(201);
      expect(r.body.program.level).toBe(Number(level));
    }
  });

  // fixed (was a bug): POST /programs deactivates every program of the user (api.js:550) *before* `level` is validated (api.js:554).
  // A request rejected with 400 invalid level leaves the user with no active program at all.
  it('a rejected create (bad level) does not deactivate the current program', async () => {
    const c = await newUser({}, TODAY);
    const p = (await c.post('/programs', programBody())).body.program;
    expect((await c.post('/programs', programBody({ level: 9 }))).status).toBe(400);
    expect((await c.get(`/programs/${p.id}`)).body.program.active).toBe(true);
  });
});

describe('programs: startDate', () => {
  it.each([
    ['this Monday', MON], ['4 weeks back', addDays(MON, -28)], ['4 weeks ahead', addDays(MON, 28)],
  ])('accepts a Monday %s', async (_n, sd) => {
    const r = await a.post('/programs', programBody({ startDate: sd }));
    expect(r.status).toBe(201);
    expect(r.body.program.startDate).toBe(sd);
  });

  it.each([
    ['a Tuesday', addDays(MON, 1)], ['5 weeks back', addDays(MON, -35)], ['5 weeks ahead', addDays(MON, 35)],
    ['bad format', '2026/11/16'], ['impossible date', '2026-02-30'], ['empty string', ''], ['a number', 20261116], ['a far Monday', '2000-01-03'],
  ])('rejects %s', async (_n, sd) => {
    const r = await a.post('/programs', programBody({ startDate: sd }));
    expect(r.status).toBe(400);
    expect(r.body.field).toBe('startDate');
  });

  it('a rejected startDate does not deactivate the current program', async () => {
    const c = await newUser({}, TODAY);
    const p = (await c.post('/programs', programBody())).body.program;
    expect((await c.post('/programs', programBody({ startDate: addDays(MON, 1) }))).status).toBe(400);
    expect((await c.get(`/programs/${p.id}`)).body.program.active).toBe(true);
  });

  it('the ±31-day window follows the client day (X-Local-Date)', async () => {
    const far = addDays(MON, 70);
    expect((await a.post('/programs', programBody({ startDate: far }))).status).toBe(400);
    const r = await a.post('/programs', programBody({ startDate: far }), { date: addDays(far, 2) });
    expect(r.status).toBe(201);
  });
});

describe('programs: read / update / delete', () => {
  it('PUT replaces name, weekdays, weeks and plan; keeps start, level, active', async () => {
    const p = (await a.post('/programs', programBody({ level: 1, startDate: addDays(MON, -7) }))).body.program;
    const r = await a.put(`/programs/${p.id}`, { name: ' Новое ', weekdays: [1], weeks: 1, plan: { 1: { 1: [row()] }, 2: { 1: [row()] } } });
    expect(r.status).toBe(200);
    expect(r.body.program).toMatchObject({ id: p.id, name: 'Новое', weekdays: [1], weeks: 1, startDate: p.startDate, level: 1, active: true });
    expect(Object.keys(r.body.program.plan)).toEqual(['1']);
    expect(r.body.program.updatedAt).toBeGreaterThanOrEqual(p.updatedAt);
  });

  it('a rejected PUT changes nothing', async () => {
    const p = (await a.post('/programs', programBody({ name: 'Старое' }))).body.program;
    expect((await a.put(`/programs/${p.id}`, programBody({ name: 'Новое', plan: { 1: { 0: [row({ reps: 'x' })] } } }))).status).toBe(400);
    expect((await a.get(`/programs/${p.id}`)).body.program.name).toBe('Старое');
  });

  it("another user's program is 404 for GET / PUT / DELETE and is not listed", async () => {
    const p = (await a.post('/programs', programBody())).body.program;
    expect((await b.get(`/programs/${p.id}`)).status).toBe(404);
    expect((await b.put(`/programs/${p.id}`, programBody())).status).toBe(404);
    expect((await b.del(`/programs/${p.id}`)).status).toBe(404);
    expect((await b.get('/programs')).body.programs.some((x: any) => x.id === p.id)).toBe(false);
    expect((await a.get(`/programs/${p.id}`)).status).toBe(200);
  });

  it('DELETE removes it; workouts of that program keep existing with programId null', async () => {
    const c = await newUser({}, TODAY);
    const p = (await c.post('/programs', programBody({ plan: { 1: { 0: [row()] } } }))).body.program;
    const w = (await c.post('/workouts', simpleWorkout({ programId: p.id, week: 1, weekday: 0 }))).body.workout;
    expect(w.programId).toBe(p.id);
    expect((await c.del(`/programs/${p.id}`)).status).toBe(200);
    expect((await c.get(`/programs/${p.id}`)).status).toBe(404);
    const again = (await c.get(`/workouts/${w.id}`)).body.workout;
    expect(again.programId).toBeNull();
  });

  it('bad id → 400, unknown method → 405', async () => {
    expect((await a.get('/programs/abc')).status).toBe(400);
    const p = (await a.post('/programs', programBody())).body.program;
    expect((await a.patch(`/programs/${p.id}`, {})).status).toBe(405);
  });

  // Questionable: plan rows are not checked against the library, so ids of nonexistent exercises or of another
  // user's own exercises are stored as is.
  it('plan rows may reference nonexistent / foreign exercises (stored as is)', async () => {
    const foreign = await ownExercise(b);
    const r = await a.post('/programs', programBody({ plan: { 1: { 0: [row({ exerciseId: 99999999 }), row({ exerciseId: foreign })] } } }));
    expect(r.status).toBe(201);
  });

  // Questionable: a reversed range is accepted; the client (parseReps) takes max=12 as the planned reps while
  // calibration (api.js:160, split().pop()) takes 10.
  it('reversed reps range "12–10" is accepted', async () => {
    expect((await a.post('/programs', programBody({ plan: { 1: { 0: [row({ reps: '12–10' })] } } }))).status).toBe(201);
  });
});
