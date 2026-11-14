import { describe, it, expect, beforeAll } from 'vitest';
import { Client, newUser, ownProduct, uniq } from './helpers';

let a: Client; let b: Client;
beforeAll(async () => { a = await newUser(); b = await newUser(); });

/** A random 13-digit EAN starting with 0 (its 12-digit UPC twin = without the 0). */
const ean0 = () => `0${String(Date.now()).slice(-9)}${String(Math.floor(Math.random() * 1e3)).padStart(3, '0')}`;
const names = (r: any) => r.body.products.map((p: any) => p.name);
/** Letters only: FTS splits on digits/latin boundaries the same way, but keep test words purely Cyrillic + a tag. */
const tag = () => uniq('').replace(/[^a-z0-9]/g, '');

describe('products: create', () => {
  it('creates with defaults (all meals, own, icon guessed), comma decimals accepted', async () => {
    const r = await a.post('/products', { name: ' Творог тест ', brand: ' Простоквашино ', protein: '16,5', fat: 5, carbs: 3, kcal: '121,5' });
    expect(r.status).toBe(201);
    expect(r.body.product).toMatchObject({
      type: 'product', title: 'Творог тест', brand: 'Простоквашино', name: 'Простоквашино · Творог тест', protein: 16.5, kcal: 121.5,
      meals: ['breakfast', 'lunch', 'dinner', 'snack'], base: false, barcode: null, portionName: null, portionG: null,
    });
    expect(r.body.product.icon).toBe('cottage');
  });

  it('explicit icon and meals are kept; blank brand → null', async () => {
    const r = await a.post('/products', { name: 'Штука', brand: '  ', protein: 1, fat: 1, carbs: 1, icon: 'nuts', meals: ['snack'] });
    expect(r.body.product).toMatchObject({ icon: 'nuts', brand: null, meals: ['snack'] });
    expect((await a.get(`/products/${r.body.product.id}`)).body.product.meals).toEqual(['snack']);
    expect((await b.get(`/products/${r.body.product.id}`)).body.product.meals).toEqual(['breakfast', 'lunch', 'dinner', 'snack']);
  });

  it.each([
    [{ name: 'Я' }, 'name'], [{ name: 'x'.repeat(81) }, 'name'], [{ name: 5 }, 'name'], [{ protein: 101 }, 'protein'], [{ protein: -1 }, 'protein'],
    [{ fat: 'abc' }, 'fat'], [{ carbs: undefined }, 'carbs'], [{ protein: 50, fat: 30, carbs: 21 }, 'carbs'], [{ kcal: 901 }, 'kcal'],
    [{ brand: 'x'.repeat(41) }, 'brand'], [{ barcode: '123' }, 'barcode'], [{ barcode: 'abcdefgh' }, 'barcode'], [{ barcode: '123456789' }, 'barcode'],
    [{ meals: [] }, 'meals'], [{ meals: ['brunch'] }, 'meals'], [{ meals: 'lunch' }, 'meals'], [{ protein: 1e400 }, 'protein'],
  ])('rejects %o', async (over, field) => {
    const r = await a.post('/products', { name: 'Продукт', protein: 10, fat: 5, carbs: 20, ...over });
    expect(r.status).toBe(400);
    expect(r.body.field).toBe(field);
  });

  it('macros exactly 100 are fine', async () => {
    expect((await a.post('/products', { name: 'Жир', protein: 0, fat: 99.9, carbs: 0.1 })).status).toBe(201);
  });

  it('a taken barcode → 409 with the existing product', async () => {
    const code = ean0();
    const p = await ownProduct(a, { barcode: code });
    const r = await b.post('/products', { name: 'Другой', protein: 1, fat: 1, carbs: 1, barcode: code });
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ error: 'barcode_taken', field: 'barcode', product: { id: p.id } });
  });

  // fixed (was a bug): barcode lookup treats a 12-digit UPC and the same code with a leading 0 (13-digit EAN) as one product
  // (api.js:673), but create (api.js:722-724) and edit (api.js:765-766) only check the exact string, so the same
  // package can be added twice (the seeded library already has such a pair: 601159073769 / 0601159073769).
  it('a barcode equal to an existing one up to the leading 0 is taken (409)', async () => {
    const code = ean0();
    await ownProduct(a, { barcode: code });
    const r = await b.post('/products', { name: 'Тот же', protein: 1, fat: 1, carbs: 1, barcode: code.slice(1) });
    expect(r.status).toBe(409);
  });

  // Questionable: a barcode sent as a JSON number is rejected as invalid_string instead of being accepted.
  it('a numeric barcode is rejected', async () => {
    expect((await a.post('/products', { name: 'Число', protein: 1, fat: 1, carbs: 1, barcode: 46000000 })).body.error).toBe('invalid_string');
  });
});

describe('products: barcode lookup', () => {
  it('finds by exact code, by the 12-digit twin of a 0-prefixed EAN and vice versa; unknown → null', async () => {
    const code = ean0();
    const p = await ownProduct(a, { barcode: code });
    expect((await b.get(`/products?barcode=${code}`)).body.product.id).toBe(p.id);
    expect((await b.get(`/products?barcode=${code.slice(1)}`)).body.product.id).toBe(p.id);
    const upc = `7${String(Date.now()).slice(-8)}${String(Math.floor(Math.random() * 1e3)).padStart(3, '0')}`;
    const q = await ownProduct(a, { barcode: upc });
    expect((await a.get(`/products?barcode=0${upc}`)).body.product.id).toBe(q.id);
    expect((await a.get('/products?barcode=99999999')).body.product).toBeNull();
    expect((await a.get('/products?barcode=abc')).body.product).toBeNull();
  });

  it('finds a seeded Open Food Facts product', async () => {
    const r = await a.get('/products?barcode=03129814');
    expect(r.body.product).toMatchObject({ title: 'Английский завтрак', brand: 'ВкусВилл', base: true });
  });
});

describe('products: edit / delete / meals', () => {
  it('the author edits everything; brand "" → null; barcode "" → null; search follows the new name', async () => {
    const t = tag();
    const p = await ownProduct(a, { barcode: ean0(), name: `Старьё ${t}` });
    const r = await a.put(`/products/${p.id}`, { name: `Новинка ${t}`, brand: '', barcode: '', protein: '20,5', kcal: null, icon: 'cheese' });
    expect(r.status).toBe(200);
    expect(r.body.product).toMatchObject({ title: `Новинка ${t}`, brand: null, barcode: null, protein: 20.5, fat: 5, kcal: null, icon: 'cheese' });
    expect(names(await a.get(`/products?q=новинка ${t}`))).toContain(`Новинка ${t}`);
    expect(names(await a.get(`/products?q=старье ${t}`))).toEqual([]);
  });

  it.each([
    [{ name: 'X' }, 'name'], [{ protein: 90, fat: 20 }, 'carbs'], [{ barcode: '12' }, 'barcode'], [{ icon: 'dish' }, 'icon'], [{ kcal: -5 }, 'kcal'],
  ])('author edit rejects %o', async (body, field) => {
    const p = await ownProduct(a);
    const r = await a.put(`/products/${p.id}`, body);
    expect(r.status).toBe(400);
    expect(r.body.field).toBe(field);
  });

  it('changing the barcode onto a taken one → 409', async () => {
    const code = ean0();
    await ownProduct(a, { barcode: code });
    const p = await ownProduct(a);
    expect((await a.put(`/products/${p.id}`, { barcode: code })).status).toBe(409);
  });

  it("someone else can change only the picture of a product, nothing else", async () => {
    const p = await ownProduct(a, { name: 'Чужой продукт', protein: 10 });
    const r = await b.put(`/products/${p.id}`, { name: 'Взлом', protein: 99, icon: 'nuts', barcode: ean0() });
    expect(r.status).toBe(200);
    expect(r.body.product).toMatchObject({ title: 'Чужой продукт', protein: 10, icon: 'nuts', barcode: null });
    expect((await b.put(`/products/${p.id}`, { icon: 'nope' })).status).toBe(400);
    expect((await b.put('/products/99999999', { icon: 'nuts' })).status).toBe(404);
  });

  it('delete: own ok, foreign/base 403, missing 404; diary entries keep their copy', async () => {
    const p = await ownProduct(a, { name: 'Удаляемый' });
    const e = (await a.post('/diary', { date: '2026-05-05', meal: 'lunch', itemType: 'product', itemId: p.id, grams: 100 })).body.entry;
    expect((await b.del(`/products/${p.id}`)).status).toBe(403);
    expect((await a.del('/products/1')).status).toBe(403);
    expect((await a.del(`/products/${p.id}`)).status).toBe(200);
    expect((await a.del(`/products/${p.id}`)).status).toBe(404);
    expect((await a.get(`/products/${p.id}`)).status).toBe(404);
    const entries = (await a.get('/diary?from=2026-05-05&to=2026-05-05')).body.entries;
    expect(entries.find((x: any) => x.id === e.id)).toMatchObject({ productId: null, name: 'Удаляемый', protein: 10 });
  });

  it('a product used in a dish cannot be deleted (409)', async () => {
    const p = await ownProduct(a);
    await a.post('/dishes', { name: 'Блюдо с ним', cookedWeight: 100, ingredients: [{ productId: p.id, grams: 100 }] });
    const r = await a.del(`/products/${p.id}`);
    expect(r.status).toBe(409);
    expect(r.body).toEqual({ error: 'product_in_dish', dish: 'Блюдо с ним' });
  });

  // Questionable (privacy): the 409 names a dish of *another* user that uses the product.
  it("the 409 reveals another user's dish name", async () => {
    const p = await ownProduct(a);
    await b.post('/dishes', { name: 'Секретное блюдо Б', cookedWeight: 100, ingredients: [{ productId: p.id, grams: 100 }] });
    expect((await a.del(`/products/${p.id}`)).body.dish).toBe('Секретное блюдо Б');
  });

  it('an id reused after delete is not tied to the old meal tags / diary links', async () => {
    const p = await ownProduct(a, { meals: ['breakfast'] });
    await a.post('/diary', { date: '2026-05-06', meal: 'breakfast', itemType: 'product', itemId: p.id, grams: 50 });
    await a.del(`/products/${p.id}`);
    const q = await ownProduct(b, { name: 'Новый на месте старого' });
    // whether or not SQLite reused the id, A must not see old tags on it, and A's entry must not point at it
    expect((await a.get(`/products/${q.id}`)).body.product.meals).toEqual(['breakfast', 'lunch', 'dinner', 'snack']);
    const entries = (await a.get('/diary?from=2026-05-06&to=2026-05-06')).body.entries;
    expect(entries.every((x: any) => x.productId !== q.id)).toBe(true);
  });

  it('meal tags per user: PUT /products/:id/meals, browse by ?meal=, ?mine=1', async () => {
    const c = await newUser();
    const base = (await c.get('/products?limit=3')).body.products;
    expect(base).toHaveLength(3);
    expect(base.every((p: any) => p.base)).toBe(true);
    const r = await c.put(`/products/${base[0].id}/meals`, { meals: ['dinner'] });
    expect(r.body.product.meals).toEqual(['dinner']);
    const breakfast = (await c.get('/products?meal=breakfast')).body.products;
    expect(breakfast.some((p: any) => p.id === base[0].id)).toBe(false);
    expect((await a.get('/products?meal=breakfast')).body.products.some((p: any) => p.id === base[0].id)).toBe(true);
    expect((await c.put(`/products/${base[0].id}/meals`, { meals: [] })).status).toBe(400);
    expect((await c.put('/products/99999999/meals', { meals: ['dinner'] })).status).toBe(404);
    expect((await c.get('/products?meal=brunch')).status).toBe(400);
    const mine = await ownProduct(c);
    expect((await c.get('/products?mine=1')).body.products.map((p: any) => p.id)).toEqual([mine.id]);
    expect((await a.get('/products?mine=1')).body.products.some((p: any) => p.id === mine.id)).toBe(false);
  });

  it('browsing the base library excludes OFF imports and own products', async () => {
    const list = (await a.get('/products')).body.products;
    expect(list.length).toBeGreaterThan(50);
    expect(list.every((p: any) => p.base)).toBe(true);
    expect(list.some((p: any) => p.barcode === '03129814')).toBe(false);
  });
});

describe('products: search', () => {
  it('prefix of every word, any order, brand + name, case-insensitive', async () => {
    const t = tag();
    await ownProduct(b, { name: `Творожок ${t}`, brand: 'Зюзябрик' });
    for (const q of [`зюзя твор ${t}`, `твор зюзябрик ${t}`, `ЗЮЗЯБРИК ${t}`, `${t}`]) {
      expect(names(await a.get(`/products?q=${encodeURIComponent(q)}`)), q).toContain(`Зюзябрик · Творожок ${t}`);
    }
    expect(names(await a.get(`/products?q=${encodeURIComponent(`ожок ${t}`)}`))).toEqual([]); // not mid-word
  });

  it('ё and е are the same in both directions', async () => {
    const t = tag();
    await ownProduct(a, { name: `Ёжевичный мёд ${t}` });
    await ownProduct(a, { name: `Ежевичный мед ${t}` });
    for (const q of [`ежевич ${t}`, `ёжевич ${t}`, `мёд ${t}`, `МЕД ${t}`]) {
      expect(names(await a.get(`/products?q=${encodeURIComponent(q)}`)).sort(), q).toEqual([`Ежевичный мед ${t}`, `Ёжевичный мёд ${t}`].sort());
    }
  });

  it('a name starting with the query ranks before names that only contain a word with it', async () => {
    const t = tag();
    await ownProduct(a, { name: `Зяблик второй ${t}` });
    await ownProduct(a, { name: `Первый зяблик ${t}` });
    const list = names(await a.get(`/products?q=${encodeURIComponent(`зяблик ${t}`)}`));
    expect(list[0]).toBe(`Зяблик второй ${t}`);
  });

  it('weird input never crashes: quotes, FTS operators, punctuation only, very long', async () => {
    for (const q of ['"', '""*', 'AND', 'OR NOT', 'NEAR(a b)', '*', '-', '---', '"молоко', 'молоко"*', "'", '\\', 'x'.repeat(2000), 'a:b', '^с', 'col:молоко']) {
      const r = await a.get(`/products?q=${encodeURIComponent(q)}`);
      expect(r.status, q).toBe(200);
      expect(Array.isArray(r.body.products)).toBe(true);
    }
    expect((await a.get('/products?q=%20%20')).body.products.length).toBeGreaterThan(0); // blank = browsing
    expect((await a.get('/products?q=---')).body.products).toEqual([]);
  });

  it('at most 50 results', async () => {
    expect(names(await a.get('/products?q=м')).length).toBe(50);
  });

  it('one letter works for a rare letter', async () => {
    const r = await a.get(`/products?q=${encodeURIComponent('ю')}`);
    expect(r.status).toBe(200);
    expect(r.body.products.length).toBeGreaterThan(0);
  });

  // fixed (was a bug): the FTS subquery takes "LIMIT 300" candidates in rowid order before ranking (api.js:687). For a short query
  // like one letter («с» matches ~1800 products) the best matches are cut off: a new product named «С…» is not
  // returned at all, and the ranked list is just the 300 oldest rows.
  // «Саабник» starts with the query and is alphabetically first among such names, so it must be in the top 50.
  it('one letter finds a new product whose name starts with it', async () => {
    const t = tag();
    await ownProduct(a, { name: `Саабник ${t}` });
    expect(names(await a.get(`/products?q=${encodeURIComponent('с')}`))).toContain(`Саабник ${t}`);
  });

  // Same cause: «со» still has more than 300 candidates. The name is alphabetically first among names starting with it.
  it('two letters find a new product whose name starts with them', async () => {
    const t = tag();
    await ownProduct(a, { name: `Соабник ${t}` });
    expect(names(await a.get(`/products?q=${encodeURIComponent('со')}`))).toContain(`Соабник ${t}`);
  });
});
