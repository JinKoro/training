import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app-context';
import { api, ApiError } from '../lib/api';
import { MEALS, MEAL_IN, MEAL_RU, entryMacros, fmt, fmtG, kcal, macroLine, sumMacros } from '../lib/calc';
import { addDays, dayMonth, diffDays, isDayStr, today } from '../lib/dates';
import { invalidate, useQuery } from '../lib/query';
import { go } from '../lib/router';
import type { Entry, FoodItem, Meal } from '../lib/types';
import { FOOD_CATS, SUB_INFO, guessSub } from '../lib/categories';
import { FoodArt, Icon } from '../art';
import { AmountInput, ErrorBox, Screen, Sheet, Skeleton, TOAST_MS, errText, toast } from '../ui';
import { SearchInput } from './ExercisePicker';
import { Tiles } from './Food';

const asMeal = (m?: string): Meal => (MEALS.includes(m as Meal) ? (m as Meal) : 'breakfast');
const asDate = (d?: string) => (isDayStr(d) ? d : today());
const per100 = (it: FoodItem): [number, number, number] => [it.protein, it.fat, it.carbs];
const subtitle = (it: FoodItem) => {
  if (it.type === 'dish') return `своё блюдо · ${kcal(per100(it))} ккал на 100 г`;
  if (it.portionName === 'шт' && it.portionG) return `${kcal(per100(it).map((x) => (x * it.portionG!) / 100) as [number, number, number])} ккал за штуку`;
  return `${kcal(per100(it))} ккал · ${macroLine(per100(it))}`;
};
const n = (s: string) => Number(String(s).replace(',', '.').trim());
const MEAL_GEN: Record<Meal, string> = { breakfast: 'завтрака', lunch: 'обеда', dinner: 'ужина', snack: 'перекуса' };
const MEAL_GEN_PL: Record<Meal, string> = { breakfast: 'завтраков', lunch: 'обедов', dinner: 'ужинов', snack: 'перекусов' };

/** Four on/off chips: which meals a food shows up for. At least one stays on. */
export function MealChips({ value, onChange }: { value: Meal[]; onChange: (v: Meal[]) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
      {MEALS.map((m) => {
        const on = value.includes(m);
        return (
          <button key={m} type="button" aria-pressed={on} onClick={() => { const next = on ? value.filter((x) => x !== m) : MEALS.filter((x) => x === m || value.includes(x)); if (next.length) onChange(next); }}
            style={{ height: 42, borderRadius: 12, fontWeight: 800, fontSize: 14, background: on ? 'var(--acc)' : 'transparent', color: on ? 'var(--onAcc)' : 'var(--ink)', border: on ? 0 : '1px solid var(--track)' }}>
            {MEAL_RU[m]}
          </button>
        );
      })}
    </div>
  );
}

const PLUS: React.CSSProperties = { width: 36, height: 36, borderRadius: 18, border: '2px solid var(--acc)', color: 'var(--acc)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, flex: 'none' };

const CHECK_ICON = 'M5 12.5l4.5 4.5L19 7.5';

/**
 * A food row. Tapping it, or its "+", opens the weight/amount screen. Rows that pass onAdd (Recent, Yesterday)
 * add right away; their "+" turns into an animated check for as long as the toast is shown.
 */
function ItemRow({ it, href, sub, onAdd, rowKey }: { it: FoodItem; href: string; sub?: string; onAdd?: () => Promise<boolean>; rowKey?: string }) {
  useAddedStore();
  const done = !!rowKey && (checkedUntil.get(rowKey) ?? 0) > Date.now();
  const add = async () => { if (onAdd && !done) await onAdd(); };
  const ease = 'cubic-bezier(.34,1.3,.5,1)'; // soft overshoot
  const glyph = (d: string, on: boolean) => (
    <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: on ? 1 : 0, transform: on ? 'scale(1) rotate(0deg)' : 'scale(.3) rotate(-120deg)', transition: `opacity .45s ease, transform .6s ${ease}` }}>
      <Icon d={d} size={18} />
    </span>
  );
  return (
    <div className="row a-in" style={{ minHeight: 56, gap: 12 }}>
      <a href={href} onClick={() => { cameFromAdd = true; }} className="row grow" style={{ gap: 12, minWidth: 0 }}>
        <FoodArt kind={it.icon} size={44} />
        <div className="grow" style={{ minWidth: 0 }}><b>{it.name}</b><div className="sub ell">{sub ?? subtitle(it)}</div></div>
      </a>
      {onAdd ? (
        <button aria-label={done ? `${it.name} добавлен` : `Добавить ${it.name}`} onClick={() => void add()}
          style={{ ...PLUS, position: 'relative', background: done ? 'var(--good)' : 'transparent', borderColor: done ? 'var(--good)' : 'var(--acc)', color: done ? '#fff' : 'var(--acc)', transition: 'background .5s ease, border-color .5s ease, color .5s ease' }}>
          {glyph('M12 5v14M5 12h14', !done)}{glyph(CHECK_ICON, done)}
        </button>
      ) : <a href={href} onClick={() => { cameFromAdd = true; }} aria-label={`Выбрать вес: ${it.name}`} style={PLUS}>+</a>}
    </div>
  );
}

/**
 * What was added from the add panel, kept outside the list so a list reload does not reset it:
 * the count per day+meal (shown on the back button) and which rows show a checkmark right now.
 */
const addedCount = new Map<string, number>();
const checkedUntil = new Map<string, number>();
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());
function useAddedStore() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((x) => x + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
}
function markAdded(panelKey: string, rowKey?: string) {
  addedCount.set(panelKey, (addedCount.get(panelKey) ?? 0) + 1);
  if (rowKey) { checkedUntil.set(rowKey, Date.now() + TOAST_MS); window.setTimeout(notify, TOAST_MS + 20); }
  notify();
}
/** The food day calls this: a new visit to the add panel starts counting from zero. */
export function resetAdded() { addedCount.clear(); checkedUntil.clear(); }

/** Set when the weight screen is opened from the add panel, so adding there goes back to the same list/search. */
let cameFromAdd = false;
/** Search text and tab of the add panel per day+meal, kept while visiting the weight screen. */
const panelState = new Map<string, { q: string; tab: Tab }>();

const WHEN = (date: string, d: string) => { const k = diffDays(d, date); return k === 0 ? 'сегодня' : k === 1 ? 'вчера' : k === 2 ? 'позавчера' : dayMonth(date); };
const gramsText = (it: FoodItem, g: number) => (it.portionName === 'шт' && it.portionG ? `${fmtG(g / it.portionG)} шт` : `${fmtG(g)} г`);
const kcalAt = (it: { protein: number; fat: number; carbs: number }, g: number) => kcal([it.protein * g / 100, it.fat * g / 100, it.carbs * g / 100]);
const entryItem = (e: Entry): FoodItem | null => (e.productId || e.dishId ? {
  type: e.dishId ? 'dish' : 'product', id: (e.dishId ?? e.productId)!, name: e.name, protein: e.protein, fat: e.fat, carbs: e.carbs,
  portionName: e.portionName, portionG: e.portionG, icon: e.icon,
} : null);

const SCAN_ICON = 'M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M8 8v8M11 8v8M14 8v8M17 8v8';
const PLUS_ICON = 'M12 5v14M5 12h14';
const BOWL_ICON = 'M3 12h18a9 9 0 0 1-18 0zM8 8c0-2 2-2 2-4M13 8c0-2 2-2 2-4';
type Tab = 'recent' | 'yesterday' | 'library' | 'dishes';
const TABS: [Tab, string][] = [['recent', 'Недавние'], ['yesterday', 'Вчера'], ['library', 'Библиотека'], ['dishes', 'Блюда']];

/** Search, scan, dish and the four lists for adding food to one meal. Shared by phone and desktop. */
function AddPanel({ date: d, meal: m }: { date: string; meal: Meal }) {
  const { wide } = useApp();
  const key = `${d}/${m}`;
  const [q, setQ] = useState(() => panelState.get(key)?.q ?? '');
  const [tab, setTab] = useState<Tab>(() => panelState.get(key)?.tab ?? 'recent');
  useEffect(() => { panelState.set(key, { q, tab }); }, [key, q, tab]);
  const searchRef = useRef<HTMLDivElement>(null);
  const s = q.trim();
  const y = addDays(d, -1);
  const recent = useQuery<{ items: FoodItem[] }>(`/food/recent?meal=${m}&date=${d}`);
  const yday = useQuery<{ entries: Entry[] }>(tab === 'yesterday' ? `/diary?from=${y}&to=${y}` : null);
  const lib = useQuery<{ products: FoodItem[] }>(s.length >= 2 ? `/products?q=${encodeURIComponent(s)}` : tab === 'library' ? '/products' : null);
  const dishes = useQuery<{ dishes: FoodItem[] }>('/dishes');
  const itemHref = (it: FoodItem) => `#/food/${d}/item/${it.type}/${it.id}/${m}`;
  const rowKey = (it: FoodItem) => `${key}:${it.type}${it.id}`;
  // Optimistic: the tick and toast show at once, the request goes in the background (an error still shows a toast).
  const quick = (it: FoodItem, g: number) => async (): Promise<boolean> => {
    toast(`${it.name} — ${MEAL_IN[m]}`);
    markAdded(key, rowKey(it));
    api('POST', '/diary', { date: d, meal: m, itemType: it.type, itemId: it.id, grams: g, portions: it.portionG && Math.abs(g / it.portionG - Math.round(g / it.portionG)) < 1e-6 && Math.round(g / it.portionG) > 0 ? Math.round(g / it.portionG) : null })
      .then(() => invalidate('/diary', '/food/recent'))
      .catch((e) => toast(errText(e)));
    return true;
  };
  const newProduct = `#/food/${d}/new-product/${m}/${encodeURIComponent(s ? `name:${s}` : '-')}`;

  let body: React.ReactNode;
  if (s) {
    const low = s.toLowerCase();
    const found = lib.data && dishes.data ? [...dishes.data.dishes.filter((x) => x.name.toLowerCase().includes(low)), ...(s.length >= 2 ? lib.data.products : [])] : undefined;
    body = !found ? <Skeleton n={4} /> : (
      <div className="col" style={{ gap: 4 }}>
        {found.map((it) => <ItemRow key={`${it.type}${it.id}`} it={it} href={itemHref(it)} sub={`${subtitle(it)}${it.type === 'product' && it.base === false ? ' · добавлен пользователем' : ''}`} />)}
        {!found.length ? <span className="muted" style={{ padding: '12px 0' }}>Ничего не нашлось</span> : null}
        <a className="link" href={newProduct} style={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>{found.length ? 'Нет нужного? Добавить продукт ›' : 'Не нашли? Добавить продукт ›'}</a>
      </div>
    );
  } else if (tab === 'recent') {
    body = !recent.data ? <Skeleton n={4} /> : recent.data.items.length ? (
      <div className="col" style={{ gap: 4 }}>
        {recent.data.items.map((it) => <ItemRow key={`${it.type}${it.id}`} it={it} href={itemHref(it)} sub={`${WHEN(it.lastDate!, d)} · ${gramsText(it, it.lastGrams!)} · ${fmt(kcalAt(it, it.lastGrams!))} ккал`} onAdd={quick(it, it.lastGrams!)} rowKey={rowKey(it)} />)}
      </div>
    ) : <div className="empty">За последние 3 дня {MEAL_GEN_PL[m]} не было</div>;
  } else if (tab === 'yesterday') {
    const entries = yday.data?.entries;
    body = !entries ? <Skeleton n={4} /> : entries.length ? (
      <div className="col" style={{ gap: 14 }}>
        {MEALS.map((mm) => {
          const list = entries.filter((e) => e.meal === mm);
          if (!list.length) return null;
          return (
            <div key={mm} className="col">
              <div className="col" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
                <b style={{ fontSize: 16 }}>{MEAL_RU[mm]}</b><span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>{fmt(kcal(sumMacros(list.map(entryMacros))))} ккал</span>
              </div>
              {list.map((e) => {
                const it = entryItem(e);
                const sub = `${gramsText({ ...(it ?? { portionName: e.portionName, portionG: e.portionG }) } as FoodItem, e.grams)} · ${fmt(kcalAt(e, e.grams))} ккал`;
                return it ? <ItemRow key={e.id} it={it} href={itemHref(it)} sub={sub} onAdd={quick(it, e.grams)} rowKey={rowKey(it)} /> : null;
              })}
            </div>
          );
        })}
      </div>
    ) : <div className="empty">Вчера ничего не записано</div>;
  } else if (tab === 'library') {
    body = !lib.data ? <Skeleton n={5} /> : (
      <div className="col" style={{ gap: 4 }}>
        {lib.data.products.map((it) => <ItemRow key={it.id} it={it} href={itemHref(it)} />)}
        <div className="card col" style={{ marginTop: 10, gap: 6, alignItems: 'flex-start' }}>
          <b style={{ fontWeight: 700 }}>Остальные продукты, в том числе добавленные другими, ищи через поиск.</b>
          <button className="link" style={{ minHeight: 36 }} onClick={() => { searchRef.current?.querySelector('input')?.focus(); searchRef.current?.scrollIntoView({ block: 'center' }); }}>Найти в поиске ›</button>
        </div>
      </div>
    );
  } else {
    const list = dishes.data?.dishes.filter((x) => !x.meals || x.meals.includes(m));
    body = !list ? <Skeleton n={3} /> : (
      <div className="col" style={{ gap: 4 }}>
        {list.map((it) => <ItemRow key={it.id} it={it} href={itemHref(it)} />)}
        {!list.length ? <span className="muted" style={{ padding: '12px 0' }}>Для {MEAL_GEN[m]} блюд пока нет</span> : null}
        <a className="link" href={`#/food/${d}/dish/${m}`} style={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>+ Новое блюдо</a>
      </div>
    );
  }

  return (
    <div className="col" style={{ gap: 12 }}>
      <div ref={searchRef}><SearchInput id="food-search" value={q} onChange={setQ} placeholder="Поиск по всем продуктам" /></div>
      {!s ? (
        <>
          {/* Phone: a quick «new product» tile first (desktop has the product form beside the list). */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${wide ? 2 : 3}, 1fr)`, gap: 8 }}>
            {([...(wide ? [] : [['Продукт', PLUS_ICON, `#/food/${d}/new-product/${m}/-`, false]]), ['Штрихкод', SCAN_ICON, `#/food/${d}/scan/${m}`, true], ['Блюдо', BOWL_ICON, `#/food/${d}/dish/${m}`, false]] as [string, string, string, boolean][]).map(([l, ic, h, blue]) => (
              <a key={l} href={h} className={wide ? 'row a-in' : 'col a-in'} style={{ ...(wide ? { height: 56, padding: '0 14px', gap: 10 } : { height: 72, padding: 8, gap: 4, justifyContent: 'center', alignItems: 'center' }), borderRadius: 16, background: blue ? '#2438C9' : 'var(--card)', color: blue ? '#fff' : 'var(--ink)', border: blue ? 0 : '1px solid var(--cardBorder)' }}>
                <span style={{ width: 32, height: 32, borderRadius: 10, background: blue ? 'rgba(255,255,255,.18)' : 'var(--btn)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon d={ic} size={20} /></span>
                <b style={{ fontSize: wide ? 16 : 14 }}>{l}</b>
              </a>
            ))}
          </div>
          <div role="tablist" className="row" style={{ gap: 16, borderBottom: '1px solid var(--line)', overflowX: 'auto' }}>
            {TABS.map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} style={{ flex: 'none', padding: '10px 0', fontWeight: 800, color: tab === k ? 'var(--ink)' : 'var(--muted)', borderBottom: `3px solid ${tab === k ? 'var(--acc)' : 'transparent'}` }}>{l}</button>
            ))}
          </div>
        </>
      ) : null}
      {body}
    </div>
  );
}

/** "‹ Еда" until something is added; then a check with the count of added foods that returns to the day. */
function BackOrDone({ date, meal }: { date: string; meal: Meal }) {
  useAddedStore();
  const n = addedCount.get(`${date}/${meal}`) ?? 0;
  if (!n) return <a className="link" href={`#/food/${date}`}>‹ Еда</a>;
  return (
    <button key="done" className="check-pop" aria-label={`Готово, добавлено: ${n}`} onClick={() => { resetAdded(); go('food', date); }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px 0 8px', borderRadius: 18, background: 'var(--good)', color: '#fff', fontWeight: 800 }}>
      <Icon d={CHECK_ICON} size={18} /><span key={n} className="count-pop num">{n}</span>
    </button>
  );
}

export function AddFoodScreen({ date, meal }: { date?: string; meal?: string }) {
  const { wide } = useApp();
  const d = asDate(date), m = asMeal(meal);
  if (wide) return <DesktopAdd date={d} meal={m} />;
  return (
    <Screen className="modal">
      <div className="between"><BackOrDone date={d} meal={m} /><b>{MEAL_RU[m]}</b><span style={{ width: 44 }} /></div>
      <AddPanel date={d} meal={m} />
    </Screen>
  );
}

function DesktopAdd({ date, meal }: { date: string; meal: Meal }) {
  return (
    <Screen>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        <section className="col" style={{ flex: '1 1 420px', minWidth: 0, maxWidth: 640, gap: 12 }}>
          <a className="link" href={`#/food/${date}`}>‹ Дневник</a>
          <h1 className="display" style={{ fontSize: 28 }}>Добавить {MEAL_IN[meal]}</h1>
          <AddPanel date={date} meal={meal} />
        </section>
        <section className="card" style={{ flex: '1 1 320px', minWidth: 0, borderRadius: 22, padding: 18 }}>
          <h2 className="display" style={{ fontSize: 20, marginBottom: 12 }}>Новый продукт</h2>
          <ProductForm compact onSaved={() => toast('Продукт в библиотеке')} />
        </section>
      </div>
    </Screen>
  );
}

export function ItemScreen({ date, type, id, meal }: { date?: string; type: 'product' | 'dish'; id: number; meal?: string }) {
  const d = asDate(date);
  const q = useQuery<{ product?: FoodItem; dish?: FoodItem }>(type === 'dish' ? `/dishes/${id}` : `/products/${id}`);
  const last = useQuery<{ grams: number | null }>(`/food/last-grams?type=${type}&id=${id}`);
  const m = asMeal(meal);
  const [grams, setGrams] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tags, setTags] = useState<Meal[] | null>(null);
  const it = q.data?.product ?? q.data?.dish;
  const saveTags = async (v: Meal[]) => {
    setTags(v);
    try { await api('PUT', `/${type === 'dish' ? 'dishes' : 'products'}/${id}/meals`, { meals: v }); invalidate('/products', '/dishes', '/food/recent'); }
    catch (e) { toast(errText(e)); setTags(null); }
  };
  useEffect(() => {
    if (it && last.data && grams === null) setGrams(String(Math.round(last.data.grams ?? it.portionG ?? 100)));
  }, [it, last.data, grams]);
  if (q.error) return <Screen className="modal"><ErrorBox error={q.error} retry={q.reload} /></Screen>;
  if (!it || grams === null) return <Screen className="modal"><Skeleton n={3} /></Screen>;
  const g = Number(grams) || 0;
  const piece = it.portionName === 'шт' && it.portionG ? it.portionG : null;
  const step = piece ?? 50;
  const m100 = per100(it).map((x) => (x * g) / 100) as [number, number, number];
  const add = async () => {
    if (g < 1 || g > 5000 || busy) return;
    setBusy(true);
    // Optimistic: go back at once, the request finishes in the background (an error still shows a toast).
    api('POST', '/diary', { date: d, meal: m, itemType: it.type, itemId: it.id, grams: g, portions: it.portionG && Math.abs(g / it.portionG - Math.round(g / it.portionG)) < 1e-6 && Math.round(g / it.portionG) > 0 ? Math.round(g / it.portionG) : null })
      .then(() => invalidate('/diary', '/food/recent'))
      .catch((e) => toast(errText(e)));
    toast(`${it.name} — ${MEAL_IN[m]}`);
    markAdded(`${d}/${m}`);
    // Back to where it was picked (search, recent, library...) rather than to the day.
    if (cameFromAdd) { cameFromAdd = false; history.back(); } else go('food', d, 'add', m);
  };
  const chips: [string, number][] = [['100 г', 100], ['150 г', 150], ['200 г', 200], ...(it.portionG ? [['порция', it.portionG] as [string, number]] : [])];
  return (
    <Screen className="modal fixed-cta">
      <div><button className="link" onClick={() => history.back()}>‹ Назад</button></div>
      <div className="col" style={{ alignItems: 'center', gap: 8, textAlign: 'center' }}>
        <FoodArt kind={it.icon} size={150} />
        <h1 className="display" style={{ fontSize: 24 }}>{it.name}</h1>
        <span className="muted" style={{ fontSize: 14 }}>{it.type === 'dish' ? 'своё блюдо' : 'Общая библиотека'}</span>
      </div>
      <div className="col" style={{ alignItems: 'center', gap: 8 }}>
        <span className="muted" style={{ fontWeight: 700 }}>Сколько граммов</span>
        <div className="row" style={{ gap: 16 }}>
          <button aria-label="Меньше" onClick={() => setGrams(String(Math.max(0, g - step)))} style={{ width: 52, height: 52, borderRadius: 26, background: 'var(--card)', fontSize: 22, fontWeight: 800 }}>−</button>
          <div style={{ minWidth: 140, display: 'flex', justifyContent: 'center' }}>
            {piece
              ? <AmountInput label="Штук" value={fmtG(g / piece)} onChange={(v) => setGrams(String(Math.round((Number(v) || 0) * piece)))} unit="шт" size={46} />
              : <AmountInput label="Граммы" value={grams} onChange={setGrams} unit="г" size={46} />}
          </div>
          <button aria-label="Больше" onClick={() => setGrams(String(Math.min(5000, g + step)))} style={{ width: 52, height: 52, borderRadius: 26, background: 'var(--card)', fontSize: 22, fontWeight: 800 }}>+</button>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          {chips.map(([l, v]) => <button key={l} className="chip" aria-pressed={g === v} onClick={() => setGrams(String(v))}>{l}</button>)}
        </div>
      </div>
      <Tiles m={m100} big />
      {it.type === 'dish' ? (
        <div className="col" style={{ gap: 6 }}>
          <span className="label">Приёмы пищи</span>
          <MealChips value={tags ?? it.meals ?? MEALS} onChange={(v) => void saveTags(v)} />
        </div>
      ) : null}
      <div className="fixed-bottom"><button className="btn big" disabled={busy || g < 1 || g > 5000} onClick={add}>Добавить {MEAL_IN[m]}</button></div>
    </Screen>
  );
}

/** Two-level picker: category list, then that category's sub-categories as picture tiles. */
function CategoryPicker({ open, value, onClose, onPick }: { open: boolean; value: string | null; onClose: () => void; onPick: (id: string) => void }) {
  const [cat, setCat] = useState<string | null>(null);
  useEffect(() => { if (open) setCat(value ? SUB_INFO[value].cat : null); }, [open, value]);
  const c = FOOD_CATS.find((x) => x.id === cat);
  return (
    <Sheet open={open} onClose={onClose} label="Категория">
      {!c ? (
        <>
          <b style={{ fontSize: 18 }}>Категория</b>
          <div className="list">
            {FOOD_CATS.map((x) => (
              <button key={x.id} type="button" onClick={() => setCat(x.id)}>
                <FoodArt kind={x.subs[0].id} size={40} /><b className="grow">{x.name}</b><span className="muted">›</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setCat(null)}>‹ Категории</button>
          <b style={{ fontSize: 18 }}>{c.name}</b>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {c.subs.map((s) => (
              <button key={s.id} type="button" onClick={() => onPick(s.id)} className="col" style={{ alignItems: 'center', gap: 6, padding: '10px 4px', borderRadius: 14, background: 'var(--bg)', border: `2px solid ${s.id === value ? 'var(--acc)' : 'transparent'}`, fontSize: 13, fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>
                <FoodArt kind={s.id} size={56} />{s.name}
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}

function ProductForm({ barcode: initialBarcode, name: initialName, onSaved, compact, onScan }: {
  barcode?: string; name?: string; onSaved: (p: FoodItem) => void; compact?: boolean; onScan?: () => void;
}) {
  const [f, setF] = useState({ barcode: initialBarcode ?? '', name: initialName ?? '', p: '', fat: '', c: '', pn: '', pg: '' });
  const [dup, setDup] = useState<FoodItem | null>(null);
  const [busy, setBusy] = useState(false);
  // Where the prefilled numbers came from, so the user knows to double-check them.
  const [source, setSource] = useState<string | null>(null);
  const [ocr, setOcr] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Category follows the name until the user picks one by hand.
  const [picked, setPicked] = useState<string | null>(null);
  const sub = picked ?? guessSub(f.name);
  const [catOpen, setCatOpen] = useState(false);
  const fill = (v: { name?: string | null; protein: number | null; fat: number | null; carbs: number | null }) => setF((x) => ({
    ...x,
    name: v.name && !x.name.trim() ? v.name : x.name,
    p: v.protein !== null ? String(v.protein).replace('.', ',') : x.p,
    fat: v.fat !== null ? String(v.fat).replace('.', ',') : x.fat,
    c: v.carbs !== null ? String(v.carbs).replace('.', ',') : x.c,
  }));
  useEffect(() => {
    if (!initialBarcode) return;
    let alive = true;
    api<{ product: { name: string | null; protein: number | null; fat: number | null; carbs: number | null } | null }>('GET', `/products/lookup?barcode=${initialBarcode}`)
      .then((r) => { if (alive && r.product) { fill(r.product); setSource('Заполнено из базы Open Food Facts — проверь цифры с упаковкой'); } })
      .catch(() => {});
    return () => { alive = false; };
  }, [initialBarcode]); // eslint-disable-line react-hooks/exhaustive-deps
  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setOcr(0); setSource(null);
    try {
      const { readLabel } = await import('../lib/label');
      const r = await readLabel(file, setOcr);
      const got = [r.protein, r.fat, r.carbs].filter((v) => v !== null).length;
      if (!got) setSource('Не получилось прочитать БЖУ. Сфоткай таблицу ближе и ровнее, без бликов');
      else { fill(r); setSource(got === 3 ? 'Прочитано с этикетки — проверь цифры' : 'Прочитано не всё — допиши недостающее'); }
    } catch { setSource('Не получилось распознать фото'); } finally { setOcr(null); }
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => { setF((x) => ({ ...x, [k]: e.target.value })); if (k === 'barcode') setDup(null); };
  const okMacro = (s: string) => s.trim() !== '' && /^\d{1,3}([.,]\d)?$/.test(s.trim()) && n(s) <= 100;
  const errs = {
    name: f.name.trim().length < 2 || f.name.trim().length > 80,
    p: !okMacro(f.p), fat: !okMacro(f.fat), c: !okMacro(f.c) || n(f.p) + n(f.fat) + n(f.c) > 100,
    barcode: f.barcode.trim() !== '' && !/^(\d{8}|\d{12,14})$/.test(f.barcode.trim()),
  };
  const valid = !Object.values(errs).some(Boolean);
  const k = okMacro(f.p) && okMacro(f.fat) && okMacro(f.c) ? kcal([n(f.p), n(f.fat), n(f.c)]) : null;
  const touched = (s: string) => s.trim() !== '';
  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const { product } = await api<{ product: FoodItem }>('POST', '/products', {
        name: f.name.trim(), barcode: f.barcode.trim() || null, protein: n(f.p), fat: n(f.fat), carbs: n(f.c), icon: sub,
      });
      invalidate('/products', '/food/recent');
      onSaved(product);
      if (compact) { setF({ barcode: '', name: '', p: '', fat: '', c: '', pn: '', pg: '' }); setPicked(null); }
    } catch (e) {
      if (e instanceof ApiError && e.code === 'barcode_taken') {
        const r = await api<{ product: FoodItem | null }>('GET', `/products?barcode=${f.barcode.trim()}`).catch(() => null);
        setDup(r?.product ?? null);
      } else toast(errText(e));
    } finally { setBusy(false); }
  };
  const box = (key: 'p' | 'fat' | 'c', label: string, color: string) => (
    <div className="field">
      <label htmlFor={`pn-${key}`} className="sub" style={{ fontSize: 13 }}><span>{label}</span></label>
      <input id={`pn-${key}`} inputMode="decimal" className="input" value={f[key]} onChange={set(key)} aria-invalid={touched(f[key]) && errs[key]}
        style={{ height: compact ? 44 : 48, borderRadius: 10, borderLeft: `4px solid ${color}`, fontWeight: 800 }} />
    </div>
  );
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="field">
        <label htmlFor="pn-code">Штрихкод</label>
        <div className="row" style={{ gap: 8 }}>
          <input id="pn-code" className="input" inputMode="numeric" value={f.barcode} onChange={set('barcode')} aria-invalid={errs.barcode} style={{ height: compact ? 44 : 50, borderRadius: 12 }} />
          {onScan ? <button aria-label="Сканировать" onClick={onScan} style={{ width: 50, height: 50, borderRadius: 12, background: '#2438C9', color: '#fff', flex: 'none' }}>▥</button> : null}
        </div>
        {dup ? (
          <>
            <span className="err">Такой штрихкод уже есть</span>
            <button className="item" onClick={() => onSaved(dup)}><FoodArt kind={dup.icon} size={40} /><b className="grow">{dup.name}</b><span style={{ color: 'var(--acc)' }}>›</span></button>
          </>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor="pn-name">Название</label>
        <input id="pn-name" className="input" value={f.name} onChange={set('name')} maxLength={80} style={{ height: compact ? 44 : 50, borderRadius: 12 }} />
      </div>
      <div className="field">
        <span style={{ fontWeight: 700 }}>Категория</span>
        <button type="button" className="input row" onClick={() => setCatOpen(true)} style={{ height: 60, borderRadius: 12, gap: 12, textAlign: 'left', padding: '0 12px' }}>
          {sub ? <FoodArt kind={sub} size={44} /> : <span style={{ width: 44, height: 44, borderRadius: '50%', border: '2px dashed var(--track)', flex: 'none' }} />}
          {sub ? <span className="grow" style={{ minWidth: 0 }}><b className="ell" style={{ display: 'block' }}>{SUB_INFO[sub].name}</b><span className="sub">{SUB_INFO[sub].catName}</span></span>
            : <b className="grow" style={{ color: 'var(--acc)' }}>Выбрать категорию</b>}
          <span className="muted" style={{ fontWeight: 800 }}>›</span>
        </button>
      </div>
      <CategoryPicker open={catOpen} value={sub} onClose={() => setCatOpen(false)} onPick={(id) => { setPicked(id); setCatOpen(false); }} />
      <div className="between" style={{ gap: 8 }}>
        <span style={{ fontWeight: 700 }}>100 г</span>
        <button type="button" className="btn small outline" disabled={ocr !== null} onClick={() => fileRef.current?.click()} style={{ height: 38, flex: 'none' }}>
          {ocr === null ? 'Сфоткать этикетку' : ocr ? `Читаю… ${ocr}%` : 'Загружаю…'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPhoto} style={{ display: 'none' }} />
      </div>
      {source ? <span className="muted" style={{ fontSize: 14 }}>{source}</span> : null}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="field">
          <span className="sub" style={{ fontSize: 13 }}>Калории</span>
          <div className="input ro" style={{ height: compact ? 44 : 48, borderRadius: 10, borderLeft: '4px solid var(--acc)', fontWeight: 800 }}>{k ?? '—'}</div>
        </div>
        {box('p', 'Белки, г', 'var(--chart)')}
        {box('fat', 'Жиры, г', 'var(--warn)')}
        {box('c', 'Углеводы, г', 'var(--good)')}
      </div>
      <span className="muted" style={{ fontSize: 14 }}>Продукт попадёт в общую библиотеку и будет находиться через поиск.</span>
      <button className={compact ? 'btn small' : 'btn big'} disabled={!valid || busy} onClick={save}>{compact ? 'Сохранить в библиотеку' : 'Сохранить и выбрать вес'}</button>
    </div>
  );
}

export function ProductNewScreen({ date, meal, barcode }: { date?: string; meal?: string; barcode?: string }) {
  const d = asDate(date), m = asMeal(meal);
  return (
    <Screen className="modal">
      <div className="navbar"><a className="link" href={`#/food/${d}/add/${m}`}>Отмена</a><b>Новый продукт</b><span style={{ width: 60 }} /></div>
      <ProductForm barcode={barcode && /^\d+$/.test(barcode) ? barcode : undefined} name={barcode?.startsWith('name:') ? barcode.slice(5) : undefined} onScan={() => go('food', d, 'scan', m)}
        onSaved={(p) => go('food', d, 'item', 'product', p.id, m)} />
    </Screen>
  );
}

interface Ing { product: FoodItem; grams: string }

function DishForm({ onSaved, compact, initial, defaultMeals }: { onSaved: (d: FoodItem) => void; compact?: boolean; initial?: Ing[]; defaultMeals?: Meal[] }) {
  const [name, setName] = useState('');
  const [ings, setIngs] = useState<Ing[]>(initial ?? []);
  const [meals, setMeals] = useState<Meal[]>(defaultMeals ?? MEALS);
  const [cooked, setCooked] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const sumRaw = ings.reduce((a, i) => a + (n(i.grams) || 0), 0);
  const cw = cooked === null ? sumRaw : n(cooked) || 0;
  const tot = ings.reduce<[number, number, number]>((a, i) => { const g = n(i.grams) || 0; return [a[0] + (i.product.protein * g) / 100, a[1] + (i.product.fat * g) / 100, a[2] + (i.product.carbs * g) / 100]; }, [0, 0, 0]);
  const p100 = cw > 0 ? (tot.map((x) => (x / cw) * 100) as [number, number, number]) : [0, 0, 0] as [number, number, number];
  const valid = name.trim().length >= 2 && ings.length > 0 && ings.every((i) => n(i.grams) >= 1 && n(i.grams) <= 5000) && cw >= 1 && cw <= 20000;
  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const { dish } = await api<{ dish: FoodItem }>('POST', '/dishes', { name: name.trim(), cookedWeight: cw, meals, ingredients: ings.map((i) => (i.product.type === 'dish' ? { dishId: i.product.id, grams: n(i.grams) } : { productId: i.product.id, grams: n(i.grams) })) });
      invalidate('/dishes', '/food/recent');
      onSaved(dish);
      if (compact) { setName(''); setIngs([]); setCooked(null); }
    } catch (e) { toast(errText(e)); } finally { setBusy(false); }
  };
  if (picking) return <ProductPicker onBack={() => setPicking(false)} onPick={(p) => { setIngs((x) => [...x, { product: p, grams: '100' }]); setPicking(false); }} />;
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 12 }}>
        <FoodArt kind="dish" size={compact ? 56 : 84} />
        <div className="field grow">
          <label htmlFor="dish-name" className="sub" style={{ fontSize: 13 }}><span>Название</span></label>
          <input id="dish-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} style={{ height: 46, borderRadius: 12, fontWeight: 800 }} />
        </div>
      </div>
      <span className="label">Ингредиенты, вес сырыми</span>
      <div className="card" style={{ borderRadius: 18, padding: '4px 12px', background: compact ? 'var(--bg)' : 'var(--card)' }}>
        {ings.map((i, k) => (
          <div key={k} className="row" style={{ minHeight: 60, borderBottom: '1px solid var(--line)' }}>
            <FoodArt kind={i.product.icon} size={40} />
            <span className="grow ell" style={{ fontWeight: 700 }}>{i.product.name}</span>
            <span className="row" style={{ background: 'var(--bg)', borderRadius: 10, padding: '8px 10px', gap: 2 }}>
              <input aria-label={`Граммы: ${i.product.name}`} inputMode="numeric" value={i.grams} onChange={(e) => setIngs((x) => x.map((y, j) => (j === k ? { ...y, grams: e.target.value.replace(/\D/g, '').slice(0, 4) } : y)))} style={{ width: 44, border: 0, background: 'none', textAlign: 'right', fontWeight: 800, outline: 'none' }} /><b>г</b>
            </span>
            <button aria-label="Убрать ингредиент" className="muted" style={{ width: 40, height: 40 }} onClick={() => setIngs((x) => x.filter((_, j) => j !== k))}>✕</button>
          </div>
        ))}
        <button className="link" style={{ minHeight: 52 }} onClick={() => setPicking(true)}>+ Ингредиент</button>
      </div>
      <div className="card between" style={{ borderRadius: 18, padding: '12px 14px', background: compact ? 'var(--bg)' : 'var(--card)' }}>
        <b>Вес готового блюда</b>
        <span className="row" style={{ background: compact ? 'var(--card)' : 'var(--bg)', borderRadius: 10, padding: '8px 10px', gap: 2 }}>
          <input aria-label="Вес готового блюда" inputMode="numeric" value={cooked ?? String(Math.round(sumRaw))} onChange={(e) => setCooked(e.target.value.replace(/\D/g, '').slice(0, 5))} className="display" style={{ width: 64, border: 0, background: 'none', textAlign: 'right', fontWeight: 800, outline: 'none' }} /><b>г</b>
        </span>
      </div>
      <div style={{ background: '#2438C9', color: '#fff', borderRadius: 18, padding: 14 }}>
        <b>На 100 г готового блюда</b>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', marginTop: 8 }}>
          {[kcal(p100), ...p100.map((x) => Math.round(x))].map((v, i) => (
            <div key={i}><div className="display num" style={{ fontSize: 20 }}>{fmt(v)}</div><div style={{ fontSize: 13, fontWeight: 700 }}>{['ккал', 'белки', 'жиры', 'углев.'][i]}</div></div>
          ))}
        </div>
      </div>
      <div className="col" style={{ gap: 6 }}><span className="label">Приёмы пищи</span><MealChips value={meals} onChange={setMeals} /></div>
      {compact ? <button className="btn small" disabled={!valid || busy} onClick={save}>Сохранить в мои блюда</button> : (
        <button className="btn big" disabled={!valid || busy} onClick={save}>Готово</button>
      )}
    </div>
  );
}

function ProductPicker({ onBack, onPick }: { onBack: () => void; onPick: (p: FoodItem) => void }) {
  const [q, setQ] = useState('');
  const s = q.trim();
  const lib = useQuery<{ products: FoodItem[] }>(s.length >= 2 ? `/products?q=${encodeURIComponent(s)}` : '/products');
  return (
    <div className="col" style={{ gap: 12 }}>
      <div><button className="link" onClick={onBack}>‹ Назад</button></div>
      <SearchInput value={q} onChange={setQ} placeholder="Поиск по общей библиотеке" />
      {!lib.data ? <Skeleton n={4} /> : lib.data.products.length ? lib.data.products.map((p) => (
        <button key={p.id} className="row a-in" style={{ minHeight: 56, gap: 12, width: '100%', textAlign: 'left' }} onClick={() => onPick(p)}>
          <FoodArt kind={p.icon} size={44} /><div className="grow" style={{ minWidth: 0 }}><b>{p.name}</b><div className="sub ell">{subtitle(p)}</div></div><span style={PLUS}>+</span>
        </button>
      )) : <div className="empty">Ничего не найдено</div>}
    </div>
  );
}

/** New dish from scratch (all meals by default), or from a meal of the day ("from-meal": its food, tagged for that meal). */
export function DishNewScreen({ date, meal, from }: { date?: string; meal?: string; from?: string }) {
  const d = asDate(date), m = asMeal(meal);
  const fromMeal = from === 'from-meal';
  const day = useQuery<{ entries: Entry[] }>(fromMeal ? `/diary?from=${d}&to=${d}` : null);
  const initial = fromMeal && day.data
    ? day.data.entries.filter((e) => e.meal === m).map((e) => ({ item: entryItem(e), grams: String(Math.round(e.grams)) })).filter((x) => x.item).map((x) => ({ product: x.item!, grams: x.grams }))
    : undefined;
  const back = fromMeal ? `#/food/${d}` : `#/food/${d}/add/${m}`;
  return (
    <Screen className="modal">
      <div className="navbar"><a className="link" href={back}>Отмена</a><b>{fromMeal ? `Блюдо из ${MEAL_GEN[m]}` : 'Новое блюдо'}</b><span style={{ width: 60 }} /></div>
      {fromMeal && !day.data ? <Skeleton n={3} /> : (
        <DishForm initial={initial} defaultMeals={fromMeal ? [m] : undefined}
          onSaved={(dish) => { if (fromMeal) { toast(`Блюдо «${dish.name}» сохранено`); go('food', d); } else go('food', d, 'item', 'dish', dish.id, m); }} />
      )}
    </Screen>
  );
}

export function ScanScreen({ date, meal }: { date?: string; meal?: string }) {
  const d = asDate(date), m = asMeal(meal);
  const video = useRef<HTMLVideoElement>(null);
  const [found, setFound] = useState<FoodItem | null>(null);
  const [denied, setDenied] = useState(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  useEffect(() => {
    let stop = () => {};
    let cancelled = false;
    let lastCode = '', hits = 0;
    const onCode = async (code: string) => {
      if (pausedRef.current) return;
      if (code === lastCode) hits += 1; else { lastCode = code; hits = 1; }
      if (hits < 2) return;
      setPaused(true); pausedRef.current = true;
      navigator.vibrate?.(50);
      try {
        const r = await api<{ product: FoodItem | null }>('GET', `/products?barcode=${encodeURIComponent(code)}`);
        if (r.product) setFound(r.product);
        else go('food', d, 'new-product', m, code);
      } catch (e) { toast(errText(e)); setPaused(false); }
    };
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        const BD = (window as unknown as { BarcodeDetector?: new (o: unknown) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
        let timer = 0;
        if (BD) {
          const det = new BD({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
          const loop = async () => {
            if (cancelled) return;
            try { const r = await det.detect(v); if (r[0]) await onCode(r[0].rawValue); } catch { /* frame not ready */ }
            timer = window.setTimeout(loop, 150);
          };
          void loop();
          stop = () => { clearTimeout(timer); stream.getTracks().forEach((t) => t.stop()); };
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromVideoElement(v, (res) => { if (res) void onCode(res.getText()); });
          stop = () => { controls.stop(); stream.getTracks().forEach((t) => t.stop()); };
        }
      } catch { setDenied(true); }
    })();
    return () => { cancelled = true; stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#07090C', color: '#fff', zIndex: 30 }}>
      <video ref={video} playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onClick={() => { if (found) { setFound(null); setPaused(false); } }} />
      <div className="between" style={{ position: 'absolute', left: 16, right: 16, top: 'calc(18px + var(--safe-top))' }}>
        <a aria-label="Закрыть" href={`#/food/${d}/add/${m}`} style={{ width: 44, height: 44, borderRadius: 22, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</a>
        <span style={{ background: 'rgba(0,0,0,.5)', borderRadius: 14, padding: '8px 12px', fontWeight: 800 }}>Наведи на штрихкод</span>
        <span style={{ width: 44 }} />
      </div>
      {denied ? (
        <div className="col" style={{ position: 'absolute', left: 16, right: 16, top: 160, alignItems: 'center', gap: 14, textAlign: 'center' }}>
          <span style={{ color: '#B3BCC8', fontWeight: 700 }}>Нет доступа к камере</span>
          <a className="btn" style={{ background: '#A9CBFA', color: '#10151C' }} href={`#/food/${d}/new-product/${m}`}>Ввести вручную</a>
        </div>
      ) : (
        <div style={{ position: 'absolute', left: '50%', top: 140, transform: 'translateX(-50%)', width: 'min(310px, 84vw)', height: 240, borderRadius: 26, border: '3px solid #A9CBFA' }}>
          <i className="a-pulse" style={{ position: 'absolute', left: 12, right: 12, top: '50%', height: 3, background: '#A9CBFA', boxShadow: '0 0 16px #A9CBFA' }} />
        </div>
      )}
      <Sheet open={!!found} onClose={() => { setFound(null); setPaused(false); }} label="Продукт найден">
        {found ? (
          <>
            <div className="row"><FoodArt kind={found.icon} size={64} />
              <div className="grow">
                <b style={{ color: 'var(--good)', fontSize: 14 }}>Есть в общей библиотеке</b>
                <div style={{ fontWeight: 800, fontSize: 19 }}>{found.name}{found.portionName ? `, ${found.portionName} ${fmtG(found.portionG ?? 0)} г` : ''}</div>
                <div className="muted" style={{ fontSize: 14 }}>{kcal(per100(found))} ккал · Б {fmtG(found.protein)} · Ж {fmtG(found.fat)} · У {fmtG(found.carbs)} на 100 г</div>
              </div>
            </div>
            <a className="btn" href={`#/food/${d}/item/product/${found.id}/${m}`}>Выбрать вес и добавить</a>
          </>
        ) : null}
      </Sheet>
    </div>
  );
}
