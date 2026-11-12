import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app-context';
import { api, ApiError } from '../lib/api';
import { MEALS, MEAL_IN, MEAL_RU, fmt, fmtG, kcal, macroLine } from '../lib/calc';
import { isDayStr, today } from '../lib/dates';
import { invalidate, useQuery } from '../lib/query';
import { go } from '../lib/router';
import type { FoodItem, Meal } from '../lib/types';
import { FoodArt } from '../art';
import { ErrorBox, Screen, Sheet, Skeleton, errText, toast } from '../ui';
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

function useItems(q: string) {
  const s = q.trim();
  const recent = useQuery<{ items: FoodItem[] }>('/food/recent');
  const lib = useQuery<{ products: FoodItem[] }>(s.length >= 2 ? `/products?q=${encodeURIComponent(s)}` : '/products');
  const dishes = useQuery<{ dishes: FoodItem[] }>('/dishes');
  return { recent, lib, dishes };
}

function ItemRow({ it, href, onPlus, right }: { it: FoodItem; href?: string; onPlus?: () => void; right?: React.ReactNode }) {
  const inner = (
    <>
      <FoodArt kind={it.icon} size={48} />
      <div className="grow"><b>{it.name}</b><div className="sub ell">{subtitle(it)}</div></div>
      {right}
      <span aria-hidden={!onPlus} role={onPlus ? undefined : 'presentation'} style={{ width: 34, height: 34, borderRadius: 17, border: '2px solid var(--acc)', color: 'var(--acc)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flex: 'none' }}>+</span>
    </>
  );
  if (href) return <a className="row a-in" style={{ minHeight: 56, gap: 12 }} href={href}>{inner}</a>;
  return <button className="row a-in" style={{ minHeight: 56, gap: 12, width: '100%', textAlign: 'left' }} onClick={onPlus}>{inner}</button>;
}

export function AddFoodScreen({ date, meal }: { date?: string; meal?: string }) {
  const { wide } = useApp();
  const d = asDate(date), m = asMeal(meal);
  const [q, setQ] = useState('');
  const { recent, lib, dishes } = useItems(q);
  const [tab, setTab] = useState<0 | 1 | 2 | null>(null);
  const curTab = tab ?? (recent.data && !recent.data.items.length ? 1 : 0);
  const itemHref = (it: FoodItem) => `#/food/${d}/item/${it.type}/${it.id}/${m}`;
  const s = q.trim().toLowerCase();
  const searching = s.length > 0;
  const list: FoodItem[] | undefined = searching
    ? (lib.data && dishes.data ? [...dishes.data.dishes.filter((x) => x.name.toLowerCase().includes(s)), ...lib.data.products.filter((x) => s.length >= 2 || x.name.toLowerCase().includes(s))] : undefined)
    : curTab === 0 ? recent.data?.items : curTab === 1 ? lib.data?.products : dishes.data?.dishes;

  if (wide) return <DesktopAdd date={d} meal={m} />;

  return (
    <Screen className="modal">
      <div className="between"><a className="link" href={`#/food/${d}`}>‹ Еда</a><b>{MEAL_RU[m]}</b><span style={{ width: 44 }} /></div>
      <SearchInput id="food-search" value={q} onChange={setQ} placeholder="Поиск по общей библиотеке" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[['Штрихкод', '▥', `#/food/${d}/scan/${m}`, true], ['Вручную', '✎', `#/food/${d}/new-product/${m}`, false], ['Блюдо', '◔', `#/food/${d}/dish/${m}`, false]].map(([l, ic, href, blue]) => (
          <a key={String(l)} href={String(href)} className="col a-in" style={{ minHeight: 86, borderRadius: 16, padding: 10, justifyContent: 'space-between', background: blue ? '#2438C9' : 'var(--card)', color: blue ? '#fff' : 'var(--ink)', border: blue ? 0 : '1px solid var(--cardBorder)' }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: blue ? 'rgba(255,255,255,.18)' : 'var(--btn)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{ic}</span>
            <b>{l}</b>
          </a>
        ))}
      </div>
      {!searching ? (
        <div className="row" style={{ gap: 16, borderBottom: '1px solid var(--line)' }}>
          {['Недавние', 'Библиотека', 'Мои блюда'].map((l, i) => (
            <button key={l} onClick={() => setTab(i as 0 | 1 | 2)} style={{ padding: '10px 0', fontWeight: 800, color: curTab === i ? 'var(--ink)' : 'var(--muted)', borderBottom: `3px solid ${curTab === i ? 'var(--acc)' : 'transparent'}` }}>{l}</button>
          ))}
        </div>
      ) : null}
      {!list ? <Skeleton n={5} /> : list.length ? <div className="col" style={{ gap: 4 }}>{list.map((it) => <ItemRow key={`${it.type}${it.id}`} it={it} href={itemHref(it)} />)}</div>
        : searching ? <div className="empty">Ничего не найдено</div> : curTab === 2 ? null : <div className="empty">Пока пусто</div>}
    </Screen>
  );
}

function DesktopAdd({ date, meal }: { date: string; meal: Meal }) {
  const [q, setQ] = useState('');
  const { recent, lib, dishes } = useItems(q);
  const [grams, setGrams] = useState<Record<string, string>>({});
  const [added, setAdded] = useState<string | null>(null);
  const [fresh, setFresh] = useState<FoodItem[]>([]);
  const s = q.trim().toLowerCase();
  const base = s ? [...(dishes.data?.dishes ?? []).filter((x) => x.name.toLowerCase().includes(s)), ...(lib.data?.products ?? [])]
    : [...fresh, ...(recent.data?.items ?? []), ...(lib.data?.products ?? [])];
  const seen = new Set<string>();
  const list = base.filter((it) => { const k = `${it.type}${it.id}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const add = async (it: FoodItem) => {
    const k = `${it.type}${it.id}`;
    const g = n(grams[k] ?? String(it.portionG ?? 100));
    if (!(g >= 1 && g <= 5000)) return;
    try {
      await api('POST', '/diary', { date, meal, itemType: it.type, itemId: it.id, grams: g, portions: it.portionG && g === it.portionG ? 1 : null });
      invalidate('/diary', '/food/recent');
      setAdded(k); setTimeout(() => setAdded((x) => (x === k ? null : x)), 1200);
    } catch (e) { toast(errText(e)); }
  };
  return (
    <Screen>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        <section className="col" style={{ flex: '1 1 360px', minWidth: 0, gap: 12 }}>
          <a className="link" href={`#/food/${date}`}>‹ Дневник</a>
          <h1 className="display" style={{ fontSize: 28 }}>Добавить {MEAL_IN[meal]}</h1>
          <SearchInput value={q} onChange={setQ} placeholder="Поиск по общей библиотеке" />
          {list.slice(0, 40).map((it) => {
            const k = `${it.type}${it.id}`;
            return (
              <div key={k} className="item" style={{ borderRadius: 14, padding: '8px 12px' }}>
                <FoodArt kind={it.icon} size={48} />
                <div className="grow"><b>{it.name}</b><div className="sub ell">{subtitle(it)}</div></div>
                <span className="row" style={{ height: 36, borderRadius: 10, background: 'var(--bg)', padding: '0 8px', gap: 2 }}>
                  <input aria-label="Граммы" inputMode="numeric" value={grams[k] ?? String(it.portionG ?? 100)} onChange={(e) => setGrams((g) => ({ ...g, [k]: e.target.value.replace(/\D/g, '').slice(0, 4) }))} style={{ width: 44, border: 0, background: 'none', textAlign: 'right', fontWeight: 800, outline: 'none' }} /><b>г</b>
                </span>
                <button aria-label={`Добавить ${it.name}`} onClick={() => void add(it)} style={{ width: 36, height: 36, borderRadius: 18, border: `2px solid ${added === k ? 'var(--good)' : 'var(--acc)'}`, color: added === k ? 'var(--good)' : 'var(--acc)', fontWeight: 800 }}>{added === k ? '✓' : '+'}</button>
              </div>
            );
          })}
        </section>
        <section className="card" style={{ flex: '1 1 320px', minWidth: 0, borderRadius: 22, padding: 18 }}>
          <h2 className="display" style={{ fontSize: 20, marginBottom: 12 }}>Новый продукт</h2>
          <ProductForm compact onSaved={(p) => { setFresh((f) => [p, ...f]); toast('Продукт в библиотеке'); }} />
        </section>
        <section className="card" style={{ flex: '1 1 320px', minWidth: 0, borderRadius: 22, padding: 18 }}>
          <h2 className="display" style={{ fontSize: 20, marginBottom: 12 }}>Новое блюдо</h2>
          <DishForm compact onSaved={(dsh) => { setFresh((f) => [dsh, ...f]); toast('Блюдо сохранено'); }} />
        </section>
      </div>
    </Screen>
  );
}

export function ItemScreen({ date, type, id, meal }: { date?: string; type: 'product' | 'dish'; id: number; meal?: string }) {
  const d = asDate(date);
  const q = useQuery<{ product?: FoodItem; dish?: FoodItem }>(type === 'dish' ? `/dishes/${id}` : `/products/${id}`);
  const last = useQuery<{ grams: number | null }>(`/food/last-grams?type=${type}&id=${id}`);
  const [m, setM] = useState<Meal>(asMeal(meal));
  const [grams, setGrams] = useState<string | null>(null);
  const [mealSheet, setMealSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const it = q.data?.product ?? q.data?.dish;
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
    try {
      await api('POST', '/diary', { date: d, meal: m, itemType: it.type, itemId: it.id, grams: g, portions: it.portionG && Math.abs(g / it.portionG - Math.round(g / it.portionG)) < 1e-6 && Math.round(g / it.portionG) > 0 ? Math.round(g / it.portionG) : null });
      invalidate('/diary', '/food/recent');
      go('food', d);
    } catch (e) { toast(errText(e)); setBusy(false); }
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
          {piece ? <span className="display num" style={{ fontSize: 46 }}>{fmtG(g / piece)} шт</span>
            : <input aria-label="Граммы" inputMode="numeric" value={grams} onChange={(e) => setGrams(e.target.value.replace(/\D/g, '').slice(0, 4))} className="display num" style={{ width: 140, fontSize: 46, textAlign: 'center', border: 0, background: 'none', outline: 'none', fontWeight: 800 }} />}
          <button aria-label="Больше" onClick={() => setGrams(String(Math.min(5000, g + step)))} style={{ width: 52, height: 52, borderRadius: 26, background: 'var(--card)', fontSize: 22, fontWeight: 800 }}>+</button>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          {chips.map(([l, v]) => <button key={l} className="chip" aria-pressed={g === v} onClick={() => setGrams(String(v))}>{l}</button>)}
        </div>
      </div>
      <Tiles m={m100} big />
      <button className="card between" style={{ borderRadius: 16, padding: '12px 14px', width: '100%' }} onClick={() => setMealSheet(true)}>
        <span style={{ fontWeight: 700 }}>Приём пищи</span><b style={{ color: 'var(--acc)' }}>{MEAL_RU[m]} ›</b>
      </button>
      <div className="fixed-bottom"><button className="btn big" disabled={busy || g < 1 || g > 5000} onClick={add}>Добавить {MEAL_IN[m]}</button></div>
      <Sheet open={mealSheet} onClose={() => setMealSheet(false)} label="Приём пищи">
        {MEALS.map((x) => <button key={x} style={{ minHeight: 52, textAlign: 'left', fontWeight: 800, color: x === m ? 'var(--acc)' : 'var(--ink)' }} onClick={() => { setM(x); setMealSheet(false); }}>{MEAL_RU[x]}</button>)}
        <button className="btn outline" onClick={() => setMealSheet(false)}>Отмена</button>
      </Sheet>
    </Screen>
  );
}

function ProductForm({ barcode: initialBarcode, onSaved, compact, onScan }: { barcode?: string; onSaved: (p: FoodItem) => void; compact?: boolean; onScan?: () => void }) {
  const [f, setF] = useState({ barcode: initialBarcode ?? '', name: '', p: '', fat: '', c: '', pn: '', pg: '' });
  const [dup, setDup] = useState<FoodItem | null>(null);
  const [busy, setBusy] = useState(false);
  // Where the prefilled numbers came from, so the user knows to double-check them.
  const [source, setSource] = useState<string | null>(null);
  const [ocr, setOcr] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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
    portion: (f.pn.trim() !== '' || f.pg.trim() !== '') && !(f.pn.trim().length >= 1 && f.pn.trim().length <= 20 && n(f.pg) >= 1 && n(f.pg) <= 2000),
  };
  const valid = !Object.values(errs).some(Boolean);
  const k = okMacro(f.p) && okMacro(f.fat) && okMacro(f.c) ? kcal([n(f.p), n(f.fat), n(f.c)]) : null;
  const touched = (s: string) => s.trim() !== '';
  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const { product } = await api<{ product: FoodItem }>('POST', '/products', {
        name: f.name.trim(), barcode: f.barcode.trim() || null, protein: n(f.p), fat: n(f.fat), carbs: n(f.c),
        portionName: f.pn.trim() || null, portionG: f.pn.trim() ? n(f.pg) : null,
      });
      invalidate('/products', '/food/recent');
      onSaved(product);
      if (compact) setF({ barcode: '', name: '', p: '', fat: '', c: '', pn: '', pg: '' });
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
      <div className="between" style={{ gap: 8 }}>
        <span style={{ fontWeight: 700 }}>На 100 г, как на упаковке</span>
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
      <div className="field">
        <label htmlFor="pn-portion">Порция, <span className="muted" style={{ fontWeight: 500 }}>необязательно</span></label>
        <div className="row" style={{ gap: 8 }}>
          <input id="pn-portion" className="input" placeholder="шт, банка" value={f.pn} onChange={set('pn')} maxLength={20} style={{ height: compact ? 44 : 50, borderRadius: 12 }} aria-invalid={errs.portion} />
          <input aria-label="Граммов в порции" className="input" inputMode="numeric" placeholder="г" value={f.pg} onChange={set('pg')} style={{ height: compact ? 44 : 50, borderRadius: 12, width: 100, flex: 'none' }} aria-invalid={errs.portion} />
        </div>
      </div>
      <button className={compact ? 'btn small' : 'btn big'} disabled={!valid || busy} onClick={save}>{compact ? 'Сохранить в библиотеку' : 'Сохранить и выбрать вес'}</button>
    </div>
  );
}

export function ProductNewScreen({ date, meal, barcode }: { date?: string; meal?: string; barcode?: string }) {
  const d = asDate(date), m = asMeal(meal);
  return (
    <Screen className="modal">
      <div className="between"><a className="link" href={`#/food/${d}/add/${m}`}>Отмена</a><b>Новый продукт</b><span style={{ width: 60 }} /></div>
      <ProductForm barcode={barcode && /^\d+$/.test(barcode) ? barcode : undefined} onScan={() => go('food', d, 'scan', m)}
        onSaved={(p) => go('food', d, 'item', 'product', p.id, m)} />
    </Screen>
  );
}

interface Ing { product: FoodItem; grams: string }

function DishForm({ onSaved, compact }: { onSaved: (d: FoodItem) => void; compact?: boolean }) {
  const [name, setName] = useState('');
  const [ings, setIngs] = useState<Ing[]>([]);
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
      const { dish } = await api<{ dish: FoodItem }>('POST', '/dishes', { name: name.trim(), cookedWeight: cw, ingredients: ings.map((i) => ({ productId: i.product.id, grams: n(i.grams) })) });
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
      {!lib.data ? <Skeleton n={4} /> : lib.data.products.length ? lib.data.products.map((p) => <ItemRow key={p.id} it={p} onPlus={() => onPick(p)} />) : <div className="empty">Ничего не найдено</div>}
    </div>
  );
}

export function DishNewScreen({ date, meal }: { date?: string; meal?: string }) {
  const d = asDate(date), m = asMeal(meal);
  return (
    <Screen className="modal">
      <div className="between"><a className="link" href={`#/food/${d}/add/${m}`}>Отмена</a><b>Новое блюдо</b><span style={{ width: 60 }} /></div>
      <DishForm onSaved={(dish) => go('food', d, 'item', 'dish', dish.id, m)} />
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
