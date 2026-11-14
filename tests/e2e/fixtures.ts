import { test as base, expect, type Page, type Locator } from '@playwright/test';

export const API = 'http://localhost:8791';

// ---------- dates (the suite runs with timezoneId UTC, same as the worker) ----------
const pad = (n: number) => String(n).padStart(2, '0');
export const toDay = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const today = () => toDay(new Date());
export const addDays = (s: string, n: number) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return toDay(d); };
/** 0 = Monday … 6 = Sunday */
export const weekdayIdx = (s: string) => (new Date(`${s}T00:00:00Z`).getUTCDay() + 6) % 7;
export const weekStart = (s: string) => addDays(s, -weekdayIdx(s));
export const WD_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const MONTH_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const dayMonth = (s: string) => { const d = new Date(`${s}T00:00:00Z`); return `${d.getUTCDate()} ${MONTH_GEN[d.getUTCMonth()]}`; };
/** Russian number format as Math.round(n).toLocaleString('ru-RU') renders it (narrow nbsp as group separator). */
export const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');

// ---------- API ----------
export async function call<T = any>(token: string | null, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data as T;
}

export interface User {
  email: string; password: string; name: string; token: string; sex: 'm' | 'f';
  norms: { training: [number, number, number] | null; rest: [number, number, number] };
}

let seq = 0;
export async function registerUser(opts: Partial<{ sex: 'm' | 'f'; name: string; training: [number, number, number] | null; rest: [number, number, number]; weight: number; bodyFat: number; steps: number }> = {}): Promise<User> {
  const email = `e2e-${Date.now().toString(36)}-${process.pid}-${seq++}-${Math.random().toString(36).slice(2, 7)}@test.dev`;
  const password = 'password123';
  const name = opts.name ?? 'Тестер';
  const sex = opts.sex ?? 'm';
  const norms = { training: opts.training === undefined ? [150, 70, 300] as [number, number, number] : opts.training, rest: opts.rest ?? [150, 70, 250] as [number, number, number] };
  const { token } = await call<{ token: string }>(null, 'POST', '/auth/register', {
    email, password, name, sex, birthDate: '1990-05-15', weight: opts.weight ?? 80, height: 180, bodyFat: opts.bodyFat ?? 20, steps: opts.steps ?? 8000,
    trainingMode: 'time', trainingMin: 60, goal: 'keep', norms,
  });
  return { email, password, name, token, sex, norms };
}

let exCache: Map<string, { id: number; rest: number; type: string; group: string }> | null = null;
export async function exercises(token: string) {
  if (!exCache) {
    const { exercises: list } = await call<{ exercises: { id: number; name: string; rest: number; type: string; group: string }[] }>(token, 'GET', '/exercises');
    exCache = new Map(list.map((e) => [e.name, e]));
  }
  return exCache;
}
export async function exId(token: string, name: string) {
  const e = (await exercises(token)).get(name);
  if (!e) throw new Error(`no exercise ${name}`);
  return e.id;
}

export interface Row { name: string; sets: number; reps: string; kg?: string; rest?: number | null; pct?: number | null }
/** Program via the API; `days` maps weekday index -> rows, the same rows for every week unless `perWeek` is given. */
export async function createProgram(token: string, p: { name: string; weeks: number; days: Record<number, Row[]>; perWeek?: Record<number, Record<number, Row[]>>; startDate?: string; level?: number }) {
  const weekdays = Object.keys(p.days).map(Number);
  const plan: Record<number, Record<number, unknown[]>> = {};
  for (let w = 1; w <= p.weeks; w++) {
    plan[w] = {};
    const days = p.perWeek?.[w] ?? p.days;
    for (const [wd, rows] of Object.entries(days)) {
      plan[w][Number(wd)] = await Promise.all(rows.map(async (r) => ({ exerciseId: await exId(token, r.name), sets: r.sets, reps: r.reps, kg: r.kg ?? '', rest: r.rest ?? null, note: null, pct: r.pct ?? null })));
    }
  }
  const { program } = await call<{ program: { id: number; startDate: string } }>(token, 'POST', '/programs', { name: p.name, weekdays, weeks: p.weeks, plan, startDate: p.startDate, level: p.level });
  return program;
}

export async function productId(token: string, q: string, exact: string) {
  const { products } = await call<{ products: { id: number; name: string }[] }>(token, 'GET', `/products?q=${encodeURIComponent(q)}`);
  const p = products.find((x) => x.name === exact);
  if (!p) throw new Error(`no product ${exact}`);
  return p.id;
}

export async function addEntry(token: string, date: string, meal: string, productName: string, grams: number) {
  const id = await productId(token, productName.split(' ')[0], productName);
  return call(token, 'POST', '/diary', { date, meal, itemType: 'product', itemId: id, grams, portions: null });
}

// ---------- page helpers ----------
export async function login(page: Page, token: string) {
  await page.addInitScript((t) => {
    if (!sessionStorage.getItem('e2e-init')) { localStorage.setItem('podhod-token', t); sessionStorage.setItem('e2e-init', '1'); }
  }, token);
}

/** Navigate to a hash route and wait until the authed shell (tab bar or sidebar) or the screen is there. */
export async function open(page: Page, hash: string) {
  await page.goto(`./#/${hash.replace(/^#?\/?/, '')}`);
  await page.waitForLoadState('domcontentloaded');
}

export const toast = (page: Page) => page.locator('.toast');
export const sheet = (page: Page, label?: string) => (label ? page.getByRole('dialog', { name: label }) : page.getByRole('dialog'));
export const tab = (page: Page, name: string) => page.getByRole('navigation', { name: 'Разделы' }).getByRole('link', { name });

/**
 * Layout check: visible elements whose box sticks out of the viewport horizontally (outside any element that
 * scrolls horizontally on purpose), plus a page that scrolls horizontally. Returns human-readable offenders.
 */
export async function layoutProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const W = document.documentElement.clientWidth;
    const se = document.scrollingElement!;
    if (se.scrollWidth > se.clientWidth + 1) out.push(`page scrolls horizontally: ${se.scrollWidth} > ${se.clientWidth}`);
    for (const sc of Array.from(document.querySelectorAll('.scroller'))) {
      if (sc.scrollWidth > sc.clientWidth + 1) out.push(`.scroller content wider than screen: ${sc.scrollWidth} > ${sc.clientWidth}`);
    }
    const scrollsX = (el: Element | null) => {
      for (let n = el?.parentElement; n && n !== document.body; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (/(auto|scroll)/.test(s.overflowX) && !n.classList.contains('scroller')) return true;
      }
      return false;
    };
    const desc = (el: Element) => {
      const t = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
      return `<${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? ` class="${el.className}"` : ''}> "${t}"`;
    };
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.position === 'fixed' && el.classList.contains('toast')) continue;
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
      if ((r.right > W + 1 || r.left < -1) && !scrollsX(el)) {
        // translated rows (swipe-to-delete) and off-screen hidden parts are fine only when clipped by an ancestor
        let clipped = false;
        for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
          const ns = getComputedStyle(n);
          if (ns.overflowX !== 'visible' && !n.matches('.scroller, .shell-m, .shell-d, main, #root')) {
            const nr = n.getBoundingClientRect();
            if (nr.right <= W + 1 && nr.left >= -1) { clipped = true; break; }
          }
        }
        if (!clipped) out.push(`overflows viewport (${Math.round(r.left)}..${Math.round(r.right)} of ${W}): ${desc(el)}`);
      }
      // text cut inside buttons / labels / chips without an ellipsis on purpose
      const tag = el.tagName.toLowerCase();
      if (['button', 'a', 'b', 'span', 'label', 'h1', 'h2'].includes(tag) && el.children.length === 0 && (el.textContent ?? '').trim()) {
        const cut = el.scrollWidth > el.clientWidth + 1 && s.overflowX !== 'visible' && s.textOverflow !== 'ellipsis' && el.clientWidth > 0;
        if (cut) out.push(`text clipped (${el.scrollWidth} > ${el.clientWidth}): ${desc(el)}`);
      }
    }
    return [...new Set(out)];
  });
}

export async function expectNoLayoutProblems(page: Page, where: string) {
  const p = await layoutProblems(page);
  expect(p, `layout problems on ${where}`).toEqual([]);
}

// ---------- fixtures: fresh user per test, console / network errors fail the test ----------
interface Fixtures {
  user: User;
  /** Patterns (matched against "console: ..." / "http 4xx ..." lines) that this test expects. */
  allowErrors: (re: RegExp) => void;
  authed: Page;
}

export const test = base.extend<Fixtures & { _errors: { list: string[]; allow: RegExp[] } }>({
  _errors: async ({}, use) => { await use({ list: [], allow: [] }); },
  allowErrors: async ({ _errors }, use) => { await use((re) => { _errors.allow.push(re); }); },
  page: async ({ page, _errors }, use, testInfo) => {
    // Web fonts are not needed for the checks and may be offline.
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    page.on('console', (m) => { if (m.type() === 'error') _errors.list.push(`console: ${m.text()} @ ${m.location().url}`); });
    page.on('pageerror', (e) => _errors.list.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => {
      const f = r.failure()?.errorText ?? '';
      if (/ERR_ABORTED|NS_BINDING_ABORTED/.test(f) && r.resourceType() !== 'fetch') return; // navigations, HMR
      _errors.list.push(`requestfailed: ${r.method()} ${r.url()} ${f}`);
    });
    page.on('response', (r) => {
      if (r.status() >= 400 && r.url().startsWith(API)) _errors.list.push(`http ${r.status()} ${r.request().method()} ${r.url().replace(API, '')}`);
    });
    await use(page);
    const bad = _errors.list.filter((l) => !_errors.allow.some((re) => re.test(l)));
    if (bad.length && testInfo.status === 'passed') {
      testInfo.annotations.push({ type: 'errors', description: bad.join('\n') });
      expect(bad, 'console errors / failed requests during the test').toEqual([]);
    }
  },
  user: async ({}, use) => { await use(await registerUser()); },
  authed: async ({ page, user }, use) => { await login(page, user.token); await use(page); },
});

export { expect, type Page, type Locator };
