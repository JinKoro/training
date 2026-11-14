import { describe, it, expect } from 'vitest';
import { newUser } from './helpers';

const tick = () => new Promise((r) => setTimeout(r, 3)); // used_at is epoch ms: keep the order unambiguous

describe('food search history', () => {
  it('remembers queries newest first, case-insensitive (Cyrillic too), whitespace collapsed', async () => {
    const c = await newUser();
    expect((await c.get('/food/searches')).body.searches).toEqual([]);
    for (const q of ['молоко', '  Творог   5% ', 'МОЛОКО']) { expect((await c.post('/food/searches', { q })).status).toBe(200); await tick(); }
    expect((await c.get('/food/searches')).body.searches).toEqual(['МОЛОКО', 'Творог 5%']);
  });

  it('keeps only the last 10', async () => {
    const c = await newUser();
    for (let i = 0; i < 12; i++) { await c.post('/food/searches', { q: `запрос ${i}` }); await tick(); }
    const list = (await c.get('/food/searches')).body.searches;
    expect(list).toHaveLength(10);
    expect(list[0]).toBe('запрос 11');
    expect(list.at(-1)).toBe('запрос 2');
  });

  it('DELETE ?q= drops one (any case / spacing), DELETE alone clears', async () => {
    const c = await newUser();
    for (const q of ['гречка', 'Рис бурый', 'овсянка']) { await c.post('/food/searches', { q }); await tick(); }
    expect((await c.del(`/food/searches?q=${encodeURIComponent(' РИС   бурый ')}`)).status).toBe(200);
    expect((await c.get('/food/searches')).body.searches).toEqual(['овсянка', 'гречка']);
    expect((await c.del('/food/searches')).status).toBe(200);
    expect((await c.get('/food/searches')).body.searches).toEqual([]);
  });

  it.each([[{}], [{ q: '' }], [{ q: '   ' }], [{ q: 'x'.repeat(101) }], [{ q: 5 }]])('rejects %o', async (body) => {
    const c = await newUser();
    const r = await c.post('/food/searches', body);
    expect(r.status).toBe(400);
    expect(r.body.field).toBe('q');
  });

  it('history is per user', async () => {
    const a = await newUser(); const b = await newUser();
    await a.post('/food/searches', { q: 'секрет' });
    expect((await b.get('/food/searches')).body.searches).toEqual([]);
    await b.del('/food/searches');
    expect((await a.get('/food/searches')).body.searches).toEqual(['секрет']);
  });
});
