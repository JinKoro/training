import { describe, it, expect, beforeAll } from 'vitest';
import { Client, addDays, newUser, ownProduct, todayUtc } from './helpers';

const TODAY = todayUtc();
let a: Client; let b: Client; let prod: any;
beforeAll(async () => {
  a = await newUser({}, TODAY); b = await newUser({}, TODAY);
  prod = await ownProduct(a, { name: 'Курица тест', protein: 20, fat: 10, carbs: 0, kcal: 200 });
});
const close = (x: number, y: number) => expect(Math.abs(x - y)).toBeLessThan(1e-6);

describe('dishes', () => {
  it('computes macros per 100 g of the cooked weight; kcal from label or macros', async () => {
    const rice = await ownProduct(a, { name: 'Рис тест', protein: 7, fat: 1, carbs: 75 }); // kcal null → 4·7+9+4·75 = 337
    const r = await a.post('/dishes', { name: ' Плов ', cookedWeight: '250,0', ingredients: [{ productId: prod.id, grams: 100 }, { productId: rice.id, grams: '100' }] });
    expect(r.status).toBe(201);
    const d = r.body.dish;
    expect(d).toMatchObject({ type: 'dish', name: 'Плов', cookedWeight: 250, icon: 'dish', meals: ['breakfast', 'lunch', 'dinner', 'snack'] });
    close(d.protein, (20 + 7) / 2.5); close(d.fat, (10 + 1) / 2.5); close(d.carbs, 75 / 2.5); close(d.kcal, (200 + 337) / 2.5);
    expect((await a.get(`/dishes/${d.id}`)).body.dish.id).toBe(d.id);
    expect((await a.get('/dishes')).body.dishes[0].id).toBe(d.id);
  });

  it('a dish as an ingredient is expanded into its products, scaled to the grams used', async () => {
    const inner = (await a.post('/dishes', { name: 'Основа', cookedWeight: 50, ingredients: [{ productId: prod.id, grams: 100 }] })).body.dish;
    const r = await a.post('/dishes', { name: 'Сборное', cookedWeight: 100, ingredients: [{ dishId: inner.id, grams: 25 }] });
    expect(r.status).toBe(201);
    close(r.body.dish.protein, 10); // 25 g of a 50 g dish = 50 g of chicken = 10 g protein in 100 g
  });

  it.each([
    [{ name: 'X' }, 'name'], [{ cookedWeight: 0 }, 'cookedWeight'], [{ cookedWeight: 20001 }, 'cookedWeight'], [{ ingredients: [] }, 'ingredients'],
    [{ ingredients: 'x' }, 'ingredients'], [{ ingredients: [{ productId: 99999999, grams: 10 }] }, 'ingredients'],
    [{ ingredients: [{ productId: 1, grams: 0 }] }, 'ingredients'], [{ ingredients: [{ productId: 1, grams: 5001 }] }, 'ingredients'],
    [{ ingredients: [{ productId: 'abc', grams: 10 }] }, 'ingredients'], [{ meals: [] }, 'meals'],
  ])('rejects %o', async (over, field) => {
    const r = await a.post('/dishes', { name: 'Блюдо', cookedWeight: 100, ingredients: [{ productId: 1, grams: 100 }], ...over });
    expect(r.status).toBe(400);
    expect(r.body.field).toBe(field);
  });

  it("another user's dish: not listed, 404, not usable as ingredient or in the diary; meals PUT 404", async () => {
    const d = (await a.post('/dishes', { name: 'Личное', cookedWeight: 100, ingredients: [{ productId: 1, grams: 100 }] })).body.dish;
    expect((await b.get(`/dishes/${d.id}`)).status).toBe(404);
    expect((await b.get('/dishes')).body.dishes.some((x: any) => x.id === d.id)).toBe(false);
    expect((await b.post('/dishes', { name: 'Кража', cookedWeight: 100, ingredients: [{ dishId: d.id, grams: 10 }] })).status).toBe(400);
    expect((await b.post('/diary', { date: TODAY, meal: 'lunch', itemType: 'dish', itemId: d.id, grams: 100 })).status).toBe(404);
    expect((await b.put(`/dishes/${d.id}/meals`, { meals: ['lunch'] })).status).toBe(404);
    const ok = await a.put(`/dishes/${d.id}/meals`, { meals: ['lunch', 'dinner'] });
    expect(ok.body.dish.meals).toEqual(['lunch', 'dinner']);
  });

  it('a rejected dish (bad 2nd ingredient) creates nothing', async () => {
    const c = await newUser({}, TODAY);
    expect((await c.post('/dishes', { name: 'Плохое', cookedWeight: 100, ingredients: [{ productId: 1, grams: 10 }, { productId: 99999999, grams: 10 }] })).status).toBe(400);
    expect((await c.get('/dishes')).body.dishes).toEqual([]);
  });
});

describe('diary entries', () => {
  it('adds entries with a snapshot of the item; positions grow per meal', async () => {
    const c = await newUser({}, TODAY);
    const e1 = await c.post('/diary', { date: '2026-04-01', meal: 'lunch', itemType: 'product', itemId: prod.id, grams: '150,5' });
    expect(e1.status).toBe(201);
    expect(e1.body.entry).toMatchObject({ date: '2026-04-01', meal: 'lunch', position: 0, productId: prod.id, dishId: null, grams: 150.5, name: 'Курица тест', protein: 20, kcal: 200 });
    const e2 = await c.post('/diary', { date: '2026-04-01', meal: 'lunch', itemType: 'product', itemId: prod.id, grams: 10 });
    const e3 = await c.post('/diary', { date: '2026-04-01', meal: 'dinner', itemType: 'product', itemId: prod.id, grams: 10 });
    expect(e2.body.entry.position).toBe(1);
    expect(e3.body.entry.position).toBe(0);
    const list = (await c.get('/diary?from=2026-04-01&to=2026-04-01')).body.entries;
    expect(list).toHaveLength(3);
    expect((await c.get('/diary?from=2026-04-02&to=2026-04-30')).body.entries).toEqual([]);
  });

  it('a dish entry', async () => {
    const d = (await a.post('/dishes', { name: 'Суп', cookedWeight: 1000, ingredients: [{ productId: prod.id, grams: 500 }] })).body.dish;
    const r = await a.post('/diary', { date: '2026-04-03', meal: 'dinner', itemType: 'dish', itemId: d.id, grams: 300 });
    expect(r.status).toBe(201);
    expect(r.body.entry).toMatchObject({ dishId: d.id, productId: null, name: 'Суп', icon: 'dish' });
    close(r.body.entry.protein, 10);
  });

  it.each([
    [{ date: '2026-02-29' }, 'date'], [{ meal: 'brunch' }, 'meal'], [{ itemType: 'drink' }, 'itemType'], [{ itemId: 0 }, 'itemId'],
    [{ grams: 0 }, 'grams'], [{ grams: 5001 }, 'grams'], [{ grams: 'много' }, 'grams'], [{ grams: undefined }, 'grams'], [{ portions: 101 }, 'portions'],
  ])('rejects %o', async (over, field) => {
    const r = await a.post('/diary', { date: '2026-04-04', meal: 'lunch', itemType: 'product', itemId: prod.id, grams: 100, ...over });
    expect(r.status).toBe(400);
    expect(r.body.field).toBe(field);
  });

  it('an unknown product → 404', async () => {
    expect((await a.post('/diary', { date: '2026-04-04', meal: 'lunch', itemType: 'product', itemId: 99999999, grams: 100 })).status).toBe(404);
  });

  it('GET needs valid from and to', async () => {
    expect((await a.get('/diary')).status).toBe(400);
    expect((await a.get('/diary?from=2026-04-01')).status).toBe(400);
    expect((await a.get('/diary?from=2026-04-01&to=x')).status).toBe(400);
  });

  it('PATCH grams and meal; validation; DELETE', async () => {
    const e = (await a.post('/diary', { date: '2026-04-05', meal: 'lunch', itemType: 'product', itemId: prod.id, grams: 100 })).body.entry;
    let r = await a.patch(`/diary/${e.id}`, { grams: '120,5' });
    expect(r.body.entry).toMatchObject({ grams: 120.5, meal: 'lunch' });
    r = await a.patch(`/diary/${e.id}`, { meal: 'snack' });
    expect(r.body.entry).toMatchObject({ grams: 120.5, meal: 'snack' });
    expect((await a.patch(`/diary/${e.id}`, { grams: 0 })).status).toBe(400);
    expect((await a.patch(`/diary/${e.id}`, { meal: 'x' })).status).toBe(400);
    expect((await a.put(`/diary/${e.id}`, {})).status).toBe(405);
    expect((await a.del(`/diary/${e.id}`)).status).toBe(200);
    expect((await a.del(`/diary/${e.id}`)).status).toBe(404);
    expect((await a.patch(`/diary/${e.id}`, { grams: 1 })).status).toBe(404);
  });

  it("another user's entry: invisible, cannot be edited or deleted", async () => {
    const e = (await a.post('/diary', { date: '2026-04-06', meal: 'lunch', itemType: 'product', itemId: prod.id, grams: 100 })).body.entry;
    expect((await b.get('/diary?from=2026-04-06&to=2026-04-06')).body.entries).toEqual([]);
    expect((await b.patch(`/diary/${e.id}`, { grams: 1 })).status).toBe(404);
    expect((await b.del(`/diary/${e.id}`)).status).toBe(404);
    expect((await a.get('/diary?from=2026-04-06&to=2026-04-06')).body.entries[0].grams).toBe(100);
  });

  it('editing a product later keeps the entry numbers and name, only the picture follows', async () => {
    const p = await ownProduct(a, { name: 'Меняемый', protein: 10 });
    const e = (await a.post('/diary', { date: '2026-04-07', meal: 'lunch', itemType: 'product', itemId: p.id, grams: 100 })).body.entry;
    await a.put(`/products/${p.id}`, { name: 'Изменённый', protein: 30, icon: 'nuts' });
    const now = (await a.get('/diary?from=2026-04-07&to=2026-04-07')).body.entries.find((x: any) => x.id === e.id);
    expect(now).toMatchObject({ name: 'Меняемый', protein: 10, icon: 'nuts' });
  });

  // Questionable: moving an entry to another meal keeps its position, so two entries of the target meal share it.
  it('moving an entry to another meal keeps its old position (may collide)', async () => {
    const c = await newUser({}, TODAY);
    const d = '2026-04-08';
    await c.post('/diary', { date: d, meal: 'dinner', itemType: 'product', itemId: prod.id, grams: 1 });
    const e = (await c.post('/diary', { date: d, meal: 'lunch', itemType: 'product', itemId: prod.id, grams: 1 })).body.entry;
    const r = await c.patch(`/diary/${e.id}`, { meal: 'dinner' });
    expect(r.body.entry.position).toBe(0);
  });
});

describe('diary copy', () => {
  it('appends to future days, replace mode replaces; past / same day → 422; empty source → 400', async () => {
    const c = await newUser({}, TODAY);
    const t1 = addDays(TODAY, 1); const t2 = addDays(TODAY, 2);
    await c.post('/diary', { date: TODAY, meal: 'breakfast', itemType: 'product', itemId: prod.id, grams: 100 });
    await c.post('/diary', { date: TODAY, meal: 'breakfast', itemType: 'product', itemId: prod.id, grams: 50 });
    await c.post('/diary', { date: t2, meal: 'breakfast', itemType: 'product', itemId: prod.id, grams: 7 });
    expect((await c.post('/diary/copy', { fromDate: TODAY, meal: 'breakfast', toDates: [t1, t1, t2] })).status).toBe(200);
    let day2 = (await c.get(`/diary?from=${t2}&to=${t2}`)).body.entries;
    expect(day2.map((e: any) => e.grams)).toEqual([7, 100, 50]);
    expect(day2.map((e: any) => e.position)).toEqual([0, 1, 2]);
    expect((await c.get(`/diary?from=${t1}&to=${t1}`)).body.entries).toHaveLength(2);
    await c.post('/diary/copy', { fromDate: TODAY, meal: 'breakfast', toDates: [t2], mode: 'replace' });
    day2 = (await c.get(`/diary?from=${t2}&to=${t2}`)).body.entries;
    expect(day2.map((e: any) => e.grams)).toEqual([100, 50]);
    expect((await c.post('/diary/copy', { fromDate: TODAY, meal: 'breakfast', toDates: [addDays(TODAY, -1)] })).status).toBe(422);
    expect((await c.post('/diary/copy', { fromDate: TODAY, meal: 'breakfast', toDates: [TODAY] })).status).toBe(422);
    expect((await c.post('/diary/copy', { fromDate: TODAY, meal: 'lunch', toDates: [t1] })).body.error).toBe('empty_meal');
    expect((await c.post('/diary/copy', { fromDate: TODAY, meal: 'breakfast', toDates: [] })).status).toBe(400);
    expect((await c.post('/diary/copy', { fromDate: TODAY, meal: 'breakfast', mode: 'merge', toDates: [t1] })).status).toBe(400);
  });

  it("copy only takes the caller's own entries", async () => {
    const c = await newUser({}, TODAY);
    await a.post('/diary', { date: TODAY, meal: 'snack', itemType: 'product', itemId: prod.id, grams: 100 });
    expect((await c.post('/diary/copy', { fromDate: TODAY, meal: 'snack', toDates: [addDays(TODAY, 1)] })).body.error).toBe('empty_meal');
  });
});

describe('recent foods and last grams', () => {
  it('recent: last 30 distinct items; by meal over the last 3 days; last-grams', async () => {
    const c = await newUser({}, TODAY);
    const p2 = await ownProduct(c);
    await c.post('/diary', { date: addDays(TODAY, -5), meal: 'lunch', itemType: 'product', itemId: prod.id, grams: 111 });
    await c.post('/diary', { date: TODAY, meal: 'lunch', itemType: 'product', itemId: p2.id, grams: 222 });
    await c.post('/diary', { date: TODAY, meal: 'lunch', itemType: 'product', itemId: p2.id, grams: 333 });
    const all = (await c.get('/food/recent')).body.items;
    expect(all.map((x: any) => x.id).sort()).toEqual([prod.id, p2.id].sort());
    const lunch = (await c.get('/food/recent?meal=lunch')).body.items;
    expect(lunch.map((x: any) => x.id)).toEqual([p2.id]);
    expect(lunch[0]).toMatchObject({ lastGrams: 333, lastDate: TODAY });
    expect((await c.get('/food/recent?meal=brunch')).status).toBe(400);
    expect((await c.get(`/food/last-grams?type=product&id=${p2.id}`)).body.grams).toBe(333);
    expect((await c.get(`/food/last-grams?type=product&id=${prod.id}`)).body.grams).toBe(111);
    expect((await b.get(`/food/last-grams?type=product&id=${p2.id}`)).body.grams).toBeNull();
    expect((await c.get('/food/last-grams?type=x&id=1')).status).toBe(400);
    expect((await c.get('/food/unknown')).status).toBe(404);
  });
});
