import { describe, it, expect, beforeAll } from 'vitest';
import { Client, newUser, ownExercise, uniq } from './helpers';

let a: Client; let b: Client;
beforeAll(async () => { a = await newUser(); b = await newUser(); });

const valid = (over: Record<string, unknown> = {}) => ({ name: `Тяга ${uniq('e')}`, group: 'back', primary: ['lats', 'biceps'], ...over });

describe('exercises: library', () => {
  it('lists the base library (owner NULL) sorted by name; base exercises are not own', async () => {
    const r = await a.get('/exercises');
    expect(r.status).toBe(200);
    const list = r.body.exercises;
    expect(list.length).toBeGreaterThan(100);
    expect(list.every((e: any) => e.own === false)).toBe(true);
    const e = list[0];
    expect(e).toMatchObject({ id: expect.any(Number), name: expect.any(String), type: expect.stringMatching(/^(weight_reps|time)$/) });
    expect(Array.isArray(e.primary) && Array.isArray(e.steps)).toBe(true);
  });

  it('a base exercise cannot be edited or deleted (404)', async () => {
    const base = (await a.get('/exercises')).body.exercises[0];
    expect((await a.put(`/exercises/${base.id}`, valid())).status).toBe(404);
    expect((await a.del(`/exercises/${base.id}`)).status).toBe(404);
  });
});

describe('exercises: own CRUD', () => {
  it('creates with defaults, shows in own list only', async () => {
    const r = await a.post('/exercises', valid({ name: '  Моё упражнение  ' + uniq('') }));
    expect(r.status).toBe(201);
    const e = r.body.exercise;
    expect(e).toMatchObject({ own: true, type: 'weight_reps', group: 'back', primary: ['lats', 'biceps'], rest: 150, kind: null, subtitle: null, description: null });
    expect(e.name.startsWith('Моё')).toBe(true); // trimmed
    expect((await a.get('/exercises')).body.exercises.some((x: any) => x.id === e.id)).toBe(true);
    expect((await b.get('/exercises')).body.exercises.some((x: any) => x.id === e.id)).toBe(false);
  });

  it('updates and soft-deletes; deleted is gone from the list and cannot be edited again', async () => {
    const id = await ownExercise(a);
    const name = `Новое ${uniq()}`;
    const u = await a.put(`/exercises/${id}`, valid({ name, type: 'time', rest: '90', kind: 'plank', subtitle: 'с', description: 'd' }));
    expect(u.status).toBe(200);
    expect(u.body.exercise).toMatchObject({ id, name, type: 'time', rest: 90, kind: 'plank', subtitle: 'с', description: 'd' });
    expect((await a.del(`/exercises/${id}`)).status).toBe(200);
    expect((await a.get('/exercises')).body.exercises.some((x: any) => x.id === id)).toBe(false);
    expect((await a.put(`/exercises/${id}`, valid())).status).toBe(404);
    expect((await a.del(`/exercises/${id}`)).status).toBe(404);
  });

  it('the name of a deleted exercise can be reused', async () => {
    const name = `Повтор ${uniq()}`;
    const id = await ownExercise(a, { name });
    await a.del(`/exercises/${id}`);
    const r = await a.post('/exercises', valid({ name }));
    expect(r.status).toBe(201);
    expect(r.body.exercise.id).not.toBe(id);
  });

  it.each([
    [{ name: 'X' }, 'name'], [{ name: 'x'.repeat(81) }, 'name'], [{ name: 42 }, 'name'], [{ name: undefined }, 'name'],
    [{ primary: [] }, 'primary'], [{ primary: undefined }, 'primary'], [{ primary: ['wings'] }, 'primary'], [{ primary: 'chest' }, 'primary'],
    [{ group: 'neck' }, 'group'], [{ group: undefined }, 'group'], [{ type: 'distance' }, 'type'], [{ kind: 'Bad-Kind' }, 'kind'],
    [{ rest: 601 }, 'rest'], [{ rest: 12.5 }, 'rest'], [{ rest: -1 }, 'rest'], [{ subtitle: 'x'.repeat(121) }, 'subtitle'],
  ])('rejects %o', async (over, field) => {
    const r = await a.post('/exercises', valid(over));
    expect(r.status).toBe(400);
    expect(r.body.field).toBe(field);
  });

  it('bad id in the path is 400, missing is 404, unknown method 405', async () => {
    expect((await a.put('/exercises/abc', valid())).status).toBe(400);
    expect((await a.put('/exercises/0', valid())).status).toBe(400);
    expect((await a.put('/exercises/99999999', valid())).status).toBe(404);
    const id = await ownExercise(a);
    expect((await a.patch(`/exercises/${id}`, valid())).status).toBe(405);
  });
});

describe('exercises: uniqueness', () => {
  it('own name equal to own name (ASCII, other case) → 409', async () => {
    const name = `Curl ${uniq()}`;
    await ownExercise(a, { name });
    const r = await a.post('/exercises', valid({ name: name.toUpperCase() }));
    expect(r.status).toBe(409);
    expect(r.body).toEqual({ error: 'exercise_exists', field: 'name' });
  });

  it('own name equal to a base library name (same case) → 409', async () => {
    const base = (await a.get('/exercises')).body.exercises[0];
    expect((await a.post('/exercises', valid({ name: base.name }))).status).toBe(409);
  });

  it('renaming to its own current name is fine; renaming onto another own name is 409', async () => {
    const n1 = `Имя1 ${uniq()}`; const n2 = `Имя2 ${uniq()}`;
    const id1 = await ownExercise(a, { name: n1 });
    await ownExercise(a, { name: n2 });
    expect((await a.put(`/exercises/${id1}`, valid({ name: n1 }))).status).toBe(200);
    expect((await a.put(`/exercises/${id1}`, valid({ name: n2 }))).status).toBe(409);
  });

  it('two users may have exercises with the same name', async () => {
    const name = `Общее ${uniq()}`;
    await ownExercise(a, { name });
    expect((await b.post('/exercises', valid({ name }))).status).toBe(201);
  });

  // fixed (was a bug): uniqueness uses SQLite lower(), which only folds ASCII. All names are Russian, so «Мой жим» and «МОЙ ЖИМ»
  // (or a base exercise typed in another case, e.g. «приседания со штангой») are not seen as duplicates. (api.js:128)
  it('Cyrillic names are unique case-insensitively (own)', async () => {
    const name = `Мой жим ${uniq()}`;
    await ownExercise(a, { name });
    expect((await a.post('/exercises', valid({ name: name.toUpperCase() }))).status).toBe(409);
  });

  it('Cyrillic names are unique case-insensitively (against the base library)', async () => {
    expect((await a.post('/exercises', valid({ name: 'приседания со штангой' }))).status).toBe(409);
  });

  // Questionable: no DB constraint, the check-then-insert is not atomic.
  it('duplicate parallel POSTs create only one exercise', async () => {
    const name = `Дубль ${uniq()}`;
    const rs = await Promise.all([a.post('/exercises', valid({ name })), a.post('/exercises', valid({ name }))]);
    expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
  });
});

describe('exercises: isolation', () => {
  it("another user's own exercise: invisible, cannot be edited or deleted (404)", async () => {
    const id = await ownExercise(a);
    expect((await b.put(`/exercises/${id}`, valid())).status).toBe(404);
    expect((await b.del(`/exercises/${id}`)).status).toBe(404);
    expect((await a.get('/exercises')).body.exercises.some((x: any) => x.id === id)).toBe(true);
  });
});
