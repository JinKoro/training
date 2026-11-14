import { describe, it, expect } from 'vitest';
import { addDays, newUser, todayUtc } from './helpers';

const D0 = addDays(todayUtc(), -10);
const D1 = addDays(D0, 1);
const D2 = addDays(D0, 2);

describe('profile: PATCH /me (theme, goal)', () => {
  it('changes theme and goal', async () => {
    const c = await newUser();
    expect((await c.patch('/me', { theme: 'dark', goal: 'lose' })).status).toBe(200);
    const me = (await c.get('/me')).body;
    expect(me.user.theme).toBe('dark');
    expect(me.user.goal).toBe('lose');
  });

  it('rejects invalid theme / goal', async () => {
    const c = await newUser();
    expect((await c.patch('/me', { theme: 'pink' })).body).toEqual({ error: 'invalid_option', field: 'theme' });
    expect((await c.patch('/me', { goal: 'x' })).body.field).toBe('goal');
    expect((await c.patch('/me', undefined, { raw: 'null' })).status).toBe(400);
  });

  // Questionable: the request is rejected (400) but the valid theme from the same body was already saved.
  it('a rejected PATCH /me still saved the valid part (not atomic)', async () => {
    const c = await newUser();
    expect((await c.patch('/me', { theme: 'light', goal: 'nope' })).status).toBe(400);
    expect((await c.get('/me')).body.user.theme).toBe('light');
  });
});

describe('profile: PUT /me/profile keeps dated history', () => {
  it('a later day wins; the same day is overwritten; an earlier day does not override the latest', async () => {
    const c = await newUser({}, D0);
    let r = await c.put('/me/profile', { weight: 81 }, { date: D2 });
    expect(r.status).toBe(200);
    expect(r.body.profile.weight).toBe(81);
    r = await c.put('/me/profile', { weight: '82,4' }, { date: D2 });
    expect(r.body.profile.weight).toBe(82.4);
    r = await c.put('/me/profile', { weight: 79, height: 181 }, { date: D1 });
    expect(r.body.profile.weight).toBe(82.4); // D2 is newer
    expect(r.body.profile.height).toBe(181); // only D1 changed height
    expect(r.body.profile.name).toBe('Тест');
  });

  it('partial update leaves the rest; optional calorie inputs are stored', async () => {
    const c = await newUser({}, D0);
    const r = await c.put('/me/profile', { sex: 'f', bodyFat: 22.5, trainingMode: 'time', trainingMin: 60 }, { date: D1 });
    expect(r.body.profile).toMatchObject({ weight: 80, height: 180, sex: 'f', bodyFat: 22.5, trainingMode: 'time', trainingMin: 60 });
  });

  it.each([
    [{ weight: 301 }, 'weight'], [{ height: 'abc' }, 'height'], [{ name: '' }, 'name'], [{ name: null }, 'name'],
    [{ steps: -1 }, 'steps'], [{ birthDate: '2999-12-31' }, 'birthDate'], [{ bodyFat: 70 }, 'bodyFat'],
    [{ trainingMin: 5 }, 'trainingMin'], [{ trainingKcal: 3001 }, 'trainingKcal'], [{ trainingMode: 'x' }, 'trainingMode'],
    [{ norms: { training: [1, 2, 3] } }, 'norms'],
  ])('rejects %o', async (body, field) => {
    const c = await newUser();
    const r = await c.put('/me/profile', body);
    expect(r.status).toBe(400);
    expect(r.body.field).toBe(field);
  });

  it('also sets goal and norms in the same call', async () => {
    const c = await newUser({}, D0);
    const r = await c.put('/me/profile', { goal: 'gain', norms: { training: [200, 80, 400], rest: [180, 70, 300] } }, { date: D1 });
    expect(r.body.user.goal).toBe('gain');
    expect(r.body.norms.filter((n: any) => n.from === D1).map((n: any) => n.macros)).toEqual(expect.arrayContaining([[200, 80, 400], [180, 70, 300]]));
  });

  // fixed (was a bug): trainingMin / trainingKcal are explicitly optional (null allowed, validate.js optional:true) so the user can
  // clear them, but null in profile_history means "not changed that day": currentProfile() skips nulls and the old
  // value from an earlier day comes back. Clearing on a later day has no effect. (api.js:31 + 65-66)
  it('clearing trainingMin (null) on a later day clears it', async () => {
    const c = await newUser({ trainingMode: 'time', trainingMin: 60 }, D0);
    expect((await c.get('/me')).body.profile.trainingMin).toBe(60);
    const r = await c.put('/me/profile', { trainingMode: 'none', trainingMin: null }, { date: D1 });
    expect(r.status).toBe(200);
    expect(r.body.profile.trainingMin).toBeNull();
  });
});

describe('norms: PUT /me/norms', () => {
  it('stores norms per effective date, upserts the same day, keeps older entries', async () => {
    const c = await newUser({}, D0);
    await c.put('/me/norms', { training: [1, 2, 3], rest: [4, 5, 6] }, { date: D1 });
    const r = await c.put('/me/norms', { training: null, rest: [7, 8, 9] }, { date: D1 });
    expect(r.status).toBe(200);
    const norms = r.body.norms;
    expect(norms.map((n: any) => n.from)).toEqual([D0, D0, D1, D1]);
    const d1 = Object.fromEntries(norms.filter((n: any) => n.from === D1).map((n: any) => [n.type, n.macros]));
    expect(d1).toEqual({ training: null, rest: [7, 8, 9] });
    const d0 = Object.fromEntries(norms.filter((n: any) => n.from === D0).map((n: any) => [n.type, n.macros]));
    expect(d0.rest).toEqual([140, 60, 200]);
  });

  it.each([
    [{ rest: [1, 2, 3] }], [{ training: null }], [{ training: null, rest: [1, 2, 3.5] }], [{ training: null, rest: [1, 2, 1001] }],
    [{ training: 'x', rest: [1, 2, 3] }], [{ training: null, rest: [1, 2, 3, 4] }],
  ])('rejects %o', async (body) => {
    const c = await newUser();
    const r = await c.put('/me/norms', body);
    expect(r.status).toBe(400);
    expect(r.body.field).toBe('norms');
  });

  it('accepts string numbers with comma that are integers ("150")', async () => {
    const c = await newUser({}, D0);
    const r = await c.put('/me/norms', { training: ['150', '70', '300'], rest: [1, 2, 3] }, { date: D1 });
    expect(r.status).toBe(200);
  });

  it('unknown /me route is 404', async () => {
    const c = await newUser();
    expect((await c.get('/me/whatever')).status).toBe(404);
    expect((await c.post('/me', {})).status).toBe(404);
  });
});
