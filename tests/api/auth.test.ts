import { describe, it, expect } from 'vitest';
import { BASE, call, newUser, registerBody, uniq } from './helpers';

describe('auth: register', () => {
  it('registers, returns a token, /me shows the user, profile and norms', async () => {
    const body = registerBody({ email: `  ${uniq('Mixed')}@Test.Example ` });
    const r = await call('POST', '/auth/register', body);
    expect(r.status).toBe(201);
    expect(r.body.token).toMatch(/^[0-9a-f]{64}$/);
    const me = await call('GET', '/me', undefined, { token: r.body.token });
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe((body.email as string).trim().toLowerCase());
    expect(me.body.user.goal).toBe('keep');
    expect(me.body.user.theme).toBe('light'); // the light theme is the default
    expect(me.body.profile).toMatchObject({ name: 'Тест', weight: 80, height: 180, birthDate: '1990-05-01', steps: 8000 });
    const types = me.body.norms.map((n: any) => n.type).sort();
    expect(types).toEqual(['rest', 'training']);
    expect(me.body.norms.find((n: any) => n.type === 'rest').macros).toEqual([140, 60, 200]);
  });

  it('the account is made from step 1 alone (name, e-mail, password): no body data, no calories', async () => {
    const r = await call('POST', '/auth/register', { email: `${uniq()}@test.example`, password: 'password123', name: 'Только имя' });
    expect(r.status).toBe(201);
    const me = await call('GET', '/me', undefined, { token: r.body.token });
    expect(me.body.profile).toMatchObject({ name: 'Только имя', weight: null, height: null, birthDate: null, steps: null, sex: null, bodyFat: null });
    expect(me.body.norms).toEqual([]);
    // the later steps fill the profile and the calories
    const put = await call('PUT', '/me/profile', { sex: 'f', weight: 60, height: 168 }, { token: r.body.token });
    expect(put.status).toBe(200);
    expect(put.body.profile).toMatchObject({ sex: 'f', weight: 60, height: 168, birthDate: null });
    expect(put.body.norms).toEqual([]);
    expect((await call('POST', '/auth/register', { email: `${uniq()}@test.example`, password: 'password123' })).body.field).toBe('name');
  });

  it('accepts training norms = null (not set)', async () => {
    const r = await call('POST', '/auth/register', registerBody({ norms: { training: null, rest: [1, 2, 3] } }));
    expect(r.status).toBe(201);
    const me = await call('GET', '/me', undefined, { token: r.body.token });
    expect(me.body.norms.find((n: any) => n.type === 'training').macros).toBeNull();
  });

  it('rejects a duplicate email in any case with 409', async () => {
    const body = registerBody();
    expect((await call('POST', '/auth/register', body)).status).toBe(201);
    const again = await call('POST', '/auth/register', { ...body, email: (body.email as string).toUpperCase() });
    expect(again.status).toBe(409);
    expect(again.body).toEqual({ error: 'email_taken', field: 'email' });
  });

  it.each([
    ['bad email', { email: 'no-at-sign' }, 'email'],
    ['email without tld', { email: 'a@b.c' }, 'email'],
    ['email not a string', { email: 42 }, 'email'],
    ['short password', { password: '1234567' }, 'password'],
    ['long password', { password: 'x'.repeat(129) }, 'password'],
    ['password not a string', { password: 12345678 }, 'password'],
    ['empty name', { name: '   ' }, 'name'],
    ['weight too low', { weight: 29 }, 'weight'],
    ['weight huge', { weight: 1e308 }, 'weight'],
    ['height too high', { height: 301 }, 'height'],
    ['future birthDate', { birthDate: '2999-01-01' }, 'birthDate'],
    ['impossible birthDate', { birthDate: '1990-02-30' }, 'birthDate'],
    ['fractional steps', { steps: 100.5 }, 'steps'],
    ['bad goal', { goal: 'bulk' }, 'goal'],
    ['norms wrong length', { norms: { training: [1, 2], rest: [1, 2, 3] } }, 'norms'],
    ['norms negative', { norms: { training: null, rest: [1, -2, 3] } }, 'norms'],
    ['bad sex', { sex: 'x' }, 'sex'],
  ])('rejects %s with 400', async (_n, over, field) => {
    const r = await call('POST', '/auth/register', registerBody(over));
    expect(r.status).toBe(400);
    expect(r.body.field).toBe(field);
  });

  it('accepts a decimal comma in weight ("80,5")', async () => {
    const r = await call('POST', '/auth/register', registerBody({ weight: '80,5' }));
    expect(r.status).toBe(201);
    const me = await call('GET', '/me', undefined, { token: r.body.token });
    expect(me.body.profile.weight).toBe(80.5);
  });

  it('rejects invalid JSON / array body', async () => {
    expect((await call('POST', '/auth/register', undefined, { raw: '{oops' })).status).toBe(400);
    expect((await call('POST', '/auth/register', [1, 2])).body.error).toBe('invalid_json');
  });

  // Check-then-insert race (exists check, PBKDF2, INSERT): locally requests are serialized so this passes;
  // on production D1 a parallel duplicate could still reach the UNIQUE constraint and answer 500.
  it('concurrent duplicate registration answers 409, not 500', async () => {
    const body = registerBody();
    const rs = await Promise.all([call('POST', '/auth/register', body), call('POST', '/auth/register', body)]);
    expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
  });
});

describe('auth: login / logout / sessions', () => {
  it('logs in with the right password (email case/space-insensitive), each login is a new session', async () => {
    const body = registerBody();
    await call('POST', '/auth/register', body);
    const a = await call('POST', '/auth/login', { email: ` ${(body.email as string).toUpperCase()} `, password: body.password });
    expect(a.status).toBe(200);
    const b = await call('POST', '/auth/login', { email: body.email, password: body.password });
    expect(a.body.token).not.toBe(b.body.token);
    expect((await call('GET', '/me', undefined, { token: a.body.token })).status).toBe(200);
    expect((await call('GET', '/me', undefined, { token: b.body.token })).status).toBe(200);
  });

  it.each([
    ['wrong password', (e: string) => ({ email: e, password: 'password124' })],
    ['unknown email', () => ({ email: 'nobody@test.example', password: 'password123' })],
    ['no body fields', () => ({})],
    ['password as object', (e: string) => ({ email: e, password: { a: 1 } })],
  ])('rejects %s with 401 bad_credentials', async (_n, mk) => {
    const c = await newUser();
    const r = await call('POST', '/auth/login', mk(c.email));
    expect(r.status).toBe(401);
    expect(r.body.error).toBe('bad_credentials');
  });

  it('logout kills only that session', async () => {
    const body = registerBody();
    const t1 = (await call('POST', '/auth/register', body)).body.token;
    const t2 = (await call('POST', '/auth/login', { email: body.email, password: body.password })).body.token;
    expect((await call('POST', '/auth/logout', {}, { token: t1 })).status).toBe(200);
    expect((await call('GET', '/me', undefined, { token: t1 })).status).toBe(401);
    expect((await call('GET', '/me', undefined, { token: t2 })).status).toBe(200);
  });

  it('logout without a token is a harmless no-op', async () => {
    expect((await call('POST', '/auth/logout', {})).status).toBe(200);
  });

  it.each([
    ['no header', {}],
    ['garbage token', { Authorization: 'Bearer deadbeef' }],
    ['wrong scheme', { Authorization: 'Token abc' }],
    ['empty bearer', { Authorization: 'Bearer ' }],
  ])('protected endpoints answer 401 with %s', async (_n, headers) => {
    for (const p of ['/me', '/exercises', '/programs', '/workouts', '/dishes', '/food/searches']) {
      const r = await call('GET', p, undefined, { headers });
      expect(r.status, p).toBe(401);
      expect(r.body.error).toBe('unauthorized');
    }
  });

  it('unknown /auth route is 404, a foreign Origin is 403, OPTIONS preflight works', async () => {
    expect((await call('POST', '/auth/nope', {})).status).toBe(404);
    expect((await call('GET', '/auth/login')).status).toBe(404);
    expect((await call('GET', '/me', undefined, { headers: { Origin: 'https://evil.example' } })).status).toBe(403);
    const r = await fetch('http://localhost:8790/api/me', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } });
    expect(r.status).toBe(200);
    expect(r.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });

  it('password change: wrong current → 400, short next → 400, ok → other sessions die, this one lives, new password works', async () => {
    const body = registerBody();
    const t1 = (await call('POST', '/auth/register', body)).body.token;
    const t2 = (await call('POST', '/auth/login', { email: body.email, password: body.password })).body.token;
    expect((await call('POST', '/me/password', { current: 'nope', next: 'newpassword1' }, { token: t1 })).body.field).toBe('current');
    expect((await call('POST', '/me/password', { current: body.password, next: 'short' }, { token: t1 })).body.field).toBe('next');
    expect((await call('POST', '/me/password', { current: body.password, next: 'newpassword1' }, { token: t1 })).status).toBe(200);
    expect((await call('GET', '/me', undefined, { token: t1 })).status).toBe(200);
    expect((await call('GET', '/me', undefined, { token: t2 })).status).toBe(401);
    expect((await call('POST', '/auth/login', { email: body.email, password: body.password })).status).toBe(401);
    expect((await call('POST', '/auth/login', { email: body.email, password: 'newpassword1' })).status).toBe(200);
  });
});

describe('login rate limit', () => {
  it('after 10 failed tries for an e-mail the 11th is refused even with the right password; other e-mails still sign in', async () => {
    const ip = { 'CF-Connecting-IP': '203.0.113.7' };
    const body = registerBody();
    await call('POST', '/auth/register', body);
    for (let i = 0; i < 10; i++) {
      const r = await call('POST', '/auth/login', { email: body.email, password: 'wrong-password' }, { headers: ip });
      expect(r.status).toBe(401);
    }
    const blocked = await call('POST', '/auth/login', { email: body.email, password: body.password }, { headers: ip });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe('too_many_attempts');
    expect(blocked.body.retryAfter).toBeGreaterThan(0);
    const other = registerBody();
    await call('POST', '/auth/register', other);
    expect((await call('POST', '/auth/login', { email: other.email, password: other.password }, { headers: ip })).status).toBe(200);
  });

  it('a successful sign-in clears the e-mail counter', async () => {
    const ip = { 'CF-Connecting-IP': '203.0.113.8' };
    const body = registerBody();
    await call('POST', '/auth/register', body);
    for (let i = 0; i < 9; i++) await call('POST', '/auth/login', { email: body.email, password: 'wrong-password' }, { headers: ip });
    expect((await call('POST', '/auth/login', { email: body.email, password: body.password }, { headers: ip })).status).toBe(200);
    for (let i = 0; i < 9; i++) expect((await call('POST', '/auth/login', { email: body.email, password: 'wrong-password' }, { headers: ip })).status).toBe(401);
    expect((await call('POST', '/auth/login', { email: body.email, password: body.password }, { headers: ip })).status).toBe(200);
  });
});

describe('rest timer', () => {
  const timer = (path: string, body: unknown, token?: string) => fetch(`${BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body),
  });
  it('needs a signed-in user: no token or a bad one → 401; signed in, the endpoint is still checked', async () => {
    const body = { endpoint: 'https://web.push.apple.com/abc', seconds: 60 };
    expect((await timer('/start', body)).status).toBe(401);
    expect((await timer('/stop', body, 'nope')).status).toBe(401);
    const u = await newUser();
    expect((await timer('/start', { endpoint: 'https://evil.example/x', seconds: 60 }, u.token)).status).toBe(400);
  });
});

describe('delete the account', () => {
  it('needs the password; deletes the user and all their data; own shared products stay without the author', async () => {
    const a = await newUser();
    const code = String(Date.now()).slice(-8);
    const prod = await a.post('/products', { name: 'Продукт удалённого', barcode: code, protein: 10, fat: 5, carbs: 20 });
    expect(prod.status).toBe(201);
    expect((await a.post('/diary', { date: '2026-11-10', meal: 'lunch', itemType: 'product', itemId: prod.body.id ?? prod.body.product?.id, grams: 100 })).status).toBeLessThan(300);

    const wrong = await a.req('DELETE', '/me', { password: 'nope-nope' });
    expect(wrong.status).toBe(400);
    expect(wrong.body).toEqual({ error: 'bad_password', field: 'password' });
    expect((await a.get('/me')).status).toBe(200);

    expect((await a.req('DELETE', '/me', { password: 'password123' })).status).toBe(200);
    expect((await a.get('/me')).status).toBe(401);
    expect((await call('POST', '/auth/login', { email: a.email, password: 'password123' })).status).toBe(401);
    // the e-mail is free again
    expect((await call('POST', '/auth/register', registerBody({ email: a.email }))).status).toBe(201);

    const b = await newUser();
    const found = await b.get(`/products?barcode=${code}`);
    expect(found.body.product).toMatchObject({ name: 'Продукт удалённого' });
    expect(found.body.product.own ?? false).toBe(false);
  });
});
