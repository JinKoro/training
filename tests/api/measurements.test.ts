import { describe, it, expect } from 'vitest';
import { addDays, call, newUser, todayUtc } from './helpers';

const T = todayUtc();
const D0 = addDays(T, -20);
const D1 = addDays(T, -5);

describe('measurements: /me/measurements', () => {
  it('weight and fat from the profile history plus circumferences, sorted by date', async () => {
    const c = await newUser({}, D0); c.date = T; // sign-up weight 80 on D0
    let r = await c.get('/me/measurements');
    expect(r.status).toBe(200);
    expect(r.body.entries.filter((e: any) => e.metric === 'weight')).toEqual([{ date: D0, metric: 'weight', value: 80 }]);

    r = await c.put(`/me/measurements/${D1}`, { values: { weight: '78,5', bodyFat: 18, waist: 82, belly: '86' } });
    expect(r.status).toBe(200);
    const d1 = r.body.entries.filter((e: any) => e.date === D1);
    expect(d1).toEqual(expect.arrayContaining([
      { date: D1, metric: 'weight', value: 78.5 }, { date: D1, metric: 'bodyFat', value: 18 },
      { date: D1, metric: 'waist', value: 82 }, { date: D1, metric: 'belly', value: 86 },
    ]));
    expect(r.body.entries[0].date).toBe(D0);
    // the profile shows the latest weight and fat
    const me = (await c.get('/me')).body;
    expect(me.profile).toMatchObject({ weight: 78.5, bodyFat: 18 });
  });

  it('an older entry does not change the profile; a value is replaced, null clears it; DELETE removes one metric', async () => {
    const c = await newUser({}, D0); c.date = T;
    await c.put(`/me/measurements/${D1}`, { values: { weight: 77 } });
    await c.put(`/me/measurements/${addDays(D0, 2)}`, { values: { weight: 79, waist: 85 } });
    expect((await c.get('/me')).body.profile.weight).toBe(77);

    let r = await c.put(`/me/measurements/${D1}`, { values: { waist: 83, weight: null } });
    expect(r.body.entries.filter((e: any) => e.date === D1)).toEqual([{ date: D1, metric: 'waist', value: 83 }]);
    expect((await c.get('/me')).body.profile.weight).toBe(79);

    r = await c.del(`/me/measurements/${D1}/waist`);
    expect(r.status).toBe(200);
    expect(r.body.entries.some((e: any) => e.date === D1)).toBe(false);
    r = await c.del(`/me/measurements/${addDays(D0, 2)}/weight`);
    expect(r.body.entries.filter((e: any) => e.metric === 'weight').map((e: any) => e.date)).toEqual([D0]);
  });

  it('validates the date, metric and values; other users do not see the entries', async () => {
    const c = await newUser();
    expect((await c.put(`/me/measurements/${addDays(T, 2)}`, { values: { waist: 80 } })).body.field).toBe('date');
    expect((await c.put('/me/measurements/2026-02-30', { values: { waist: 80 } })).body.field).toBe('date');
    expect((await c.put(`/me/measurements/${T}`, { values: { knee: 40 } })).body.field).toBe('metric');
    expect((await c.put(`/me/measurements/${T}`, { values: { waist: 5 } })).body.field).toBe('waist');
    expect((await c.put(`/me/measurements/${T}`, { values: { weight: 20 } })).body.field).toBe('weight');
    expect((await c.put(`/me/measurements/${T}`, { values: { bodyFat: 'abc' } })).body.field).toBe('bodyFat');
    expect((await c.put(`/me/measurements/${T}`, {})).body.field).toBe('values');
    expect((await c.del(`/me/measurements/${T}/knee`)).status).toBe(400);
    // a bad value saves nothing of the request
    await c.put(`/me/measurements/${T}`, { values: { chest: 100, arm: 500 } });
    expect((await c.get('/me/measurements')).body.entries.some((e: any) => e.metric === 'chest')).toBe(false);

    await c.put(`/me/measurements/${T}`, { values: { chest: 100 } });
    const other = await newUser();
    expect((await other.get('/me/measurements')).body.entries.some((e: any) => e.metric === 'chest')).toBe(false);
    expect((await call('GET', '/me/measurements')).status).toBe(401);
  });

  it('deleting the account removes the measurements', async () => {
    const c = await newUser();
    await c.put(`/me/measurements/${T}`, { values: { hips: 99 } });
    expect((await c.req('DELETE', '/me', { password: 'password123' })).status).toBe(200);
    expect((await c.get('/me/measurements')).status).toBe(401);
  });
});
