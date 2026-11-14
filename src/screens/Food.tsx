import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../app-context';
import { api } from '../lib/api';
import { MEALS, MEAL_IN, MEAL_RU, entryKcal, entryMacros, fmt, fmtG, kcal, kcal100, macroLine, sumKcal, sumMacros, weekRange } from '../lib/calc';
import { addDays, dayMonth, diffDays, fromDay, isDayStr, plural, today, WD_CAP, WD_SHORT, weekDays, weekStart } from '../lib/dates';
import { useDays } from '../lib/hooks';
import { go } from '../lib/router';
import { invalidate, useQuery } from '../lib/query';
import type { Entry, FoodItem, Meal } from '../lib/types';
import { FoodArt, Icon } from '../art';
import { AmountInput, ErrorBox, Screen, Sheet, Skeleton, errText, toast } from '../ui';
import { SearchInput } from './ExercisePicker';
import { resetAdded } from './FoodAdd';

const COLORS = ['var(--chart)', 'var(--warn)', 'var(--good)'];
const NAMES = ['Белки', 'Жиры', 'Углеводы'];
const amount = (e: Entry) => (e.portions && e.portionName ? `${fmtG(e.portions)} ${e.portionName}` : `${fmtG(e.grams)} г`);
const COPY_ICON = 'M8 8h11v11H8zM5 16V5h11';
const TRASH_ICON = 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3';

async function deleteEntry(e: Entry) {
  try { await api('DELETE', `/diary/${e.id}`); invalidate('/diary'); toast(`Удалено: ${e.name}`); } catch (err) { toast(errText(err)); }
}

const OPEN = 72; // width of the revealed trash button
const GAP = 12; // air between the kcal number and the button

const EASE = 'cubic-bezier(.22,.9,.24,1)';

/**
 * Row that slides left: a short swipe reveals a trash button (it fades and grows in with the swipe), a long one
 * (past half the row) deletes at once; the row then slides out and its space collapses.
 * While the finger moves, styles are written straight to the DOM (no React re-render per frame) for smoothness.
 * A tap opens the entry, or closes the row when the button is showing.
 */
function SwipeToDelete({ children, onDelete, onTap }: { children: React.ReactNode; onDelete: () => void; onTap: () => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLButtonElement>(null);
  const bin = useRef<HTMLButtonElement>(null);
  const icon = useRef<HTMLSpanElement>(null);
  const pos = useRef(0); // current offset, px (<= 0)
  const start = useRef<{ x: number; y: number; base: number; dir: 'h' | 'v' | null; w: number } | null>(null);
  const moved = useRef(false);
  const frame = useRef(0);
  const target = useRef(0); // latest finger position, applied on the next animation frame
  const busy = useRef(false);

  const paint = (x: number, animate: boolean) => {
    pos.current = x;
    const p = Math.min(1, -x / OPEN);
    const t = animate ? `.38s ${EASE}` : '0s';
    if (row.current) { row.current.style.transition = `transform ${t}`; row.current.style.transform = `translate3d(${x}px,0,0)`; }
    if (bin.current) {
      bin.current.style.transition = `opacity ${t}, transform ${t}, width ${t}`;
      bin.current.style.opacity = String(p);
      bin.current.style.transform = `scale(${0.75 + 0.25 * p})`;
      bin.current.style.width = `${Math.max(OPEN, -x - GAP)}px`;
      bin.current.tabIndex = x < 0 ? 0 : -1;
    }
    if (icon.current) { icon.current.style.transition = `transform ${t}`; icon.current.style.transform = `scale(${0.5 + 0.5 * p}) rotate(${(1 - p) * -25}deg)`; }
  };
  const remove = () => {
    if (busy.current) return;
    busy.current = true;
    const el = wrap.current; if (!el) return;
    paint(-el.offsetWidth, true);
    if (bin.current) bin.current.style.opacity = '1';
    setTimeout(() => {
      el.style.height = `${el.offsetHeight}px`;
      requestAnimationFrame(() => { el.style.transition = `height .32s ${EASE}, opacity .32s ${EASE}, margin .32s ${EASE}`; el.style.height = '0px'; el.style.opacity = '0'; });
    }, 260);
    setTimeout(onDelete, 600);
  };
  return (
    <div ref={wrap} style={{ position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
      <button ref={bin} aria-label="Удалить" onClick={remove} tabIndex={-1}
        style={{ position: 'absolute', top: 4, right: 0, bottom: 4, width: OPEN, borderRadius: 12, background: 'var(--warn)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transform: 'scale(.75)', transformOrigin: 'right center', willChange: 'opacity, transform' }}>
        <span ref={icon} style={{ display: 'inline-flex', transform: 'scale(.5)' }}><Icon d={TRASH_ICON} size={22} /></span>
      </button>
      <button ref={row} className="row" style={{ position: 'relative', width: '100%', minHeight: 48, textAlign: 'left', background: 'var(--card)', touchAction: 'pan-y', willChange: 'transform' }}
        onTouchStart={(ev) => { if (busy.current) return; const t = ev.touches[0]; start.current = { x: t.clientX, y: t.clientY, base: pos.current, dir: null, w: ev.currentTarget.offsetWidth }; target.current = pos.current; moved.current = false; }}
        onTouchMove={(ev) => {
          const s = start.current; if (!s) return;
          const t = ev.touches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
          if (!s.dir) { if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; s.dir = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'; }
          if (s.dir !== 'h') return;
          moved.current = true;
          const raw = s.base + dx;
          const x = raw > 0 ? raw * 0.2 : Math.max(-s.w, raw); // a little rubber band to the right
          target.current = x;
          cancelAnimationFrame(frame.current);
          frame.current = requestAnimationFrame(() => paint(target.current, false));
        }}
        onTouchEnd={() => {
          const s = start.current; start.current = null;
          if (!s || s.dir !== 'h') return;
          cancelAnimationFrame(frame.current);
          const x = target.current;
          if (-x > s.w * 0.5) remove(); else paint(-x > OPEN / 2 ? -(OPEN + GAP) : 0, true);
        }}
        onClick={() => { if (moved.current) { moved.current = false; return; } if (pos.current !== 0) paint(0, true); else onTap(); }}>
        {children}
      </button>
    </div>
  );
}

export function FoodScreen({ date }: { date?: string }) {
  const { wide } = useApp();
  const d = isDayStr(date) ? date : today();
  const start = weekStart(d);
  const days = useMemo(() => weekDays(start), [start]);
  const data = useDays(days);
  const [edit, setEdit] = useState<Entry | null>(null);
  const [copy, setCopy] = useState<Meal | null>(null);
  const [target, setTarget] = useState<Meal | null>(null);
  useEffect(() => { resetAdded(); }, []);

  if (data.error) return <Screen title="Еда"><ErrorBox error={data.error} retry={data.reload} /></Screen>;
  if (!data.days) return <Screen title="Еда"><Skeleton n={4} /></Screen>;
  const info = data.days.find((x) => x.date === d)!;
  const entries = data.entries.filter((e) => e.date === d);
  const eaten = info.eaten ?? sumMacros(entries.map(entryMacros));
  const eatenK = info.kcal ?? Math.round(sumKcal(entries)), normK = kcal(info.norm);
  const over = eatenK > normK + 100;
  const byMeal = (m: Meal) => entries.filter((e) => e.meal === m);
  const defaultTarget = target ?? MEALS.find((m) => !byMeal(m).length) ?? 'dinner';

  const sheets = (
    <>
      <EntrySheet entry={edit} onClose={() => setEdit(null)} />
      <CopySheet date={d} meal={copy} entries={copy ? byMeal(copy) : []} onClose={() => setCopy(null)} />
    </>
  );

  if (wide) {
    return (
      <Screen>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
          <section className="col" style={{ flex: '2 1 560px', minWidth: 0, gap: 16 }}>
            <div className="between" style={{ flexWrap: 'wrap' }}>
              <div className="row">
                <a className="icon-btn" aria-label="Предыдущий день" href={`#/food/${addDays(d, -1)}`}>‹</a>
                <h1 className="display a-h" style={{ fontSize: 32 }}>{WD_CAP[diffDays(d, start)]}, {dayMonth(d)}</h1>
                <a className="icon-btn" aria-label="Следующий день" href={`#/food/${addDays(d, 1)}`}>›</a>
              </div>
              <b style={{ color: over ? 'var(--warnT)' : 'var(--muted)' }}>{over ? `сверх нормы ${fmt(eatenK - normK)} ккал` : `осталось ${fmt(normK - eatenK)} ккал`}</b>
            </div>
            <div className="card" style={{ overflowX: 'auto', padding: '6px 16px 12px' }}>
              <table className="num" style={{ width: '100%', minWidth: 620, borderCollapse: 'collapse' }}>
                <thead><tr className="muted" style={{ fontSize: 13 }}>{['Продукт', 'Вес', 'Ккал', 'Б', 'Ж', 'У'].map((h, i) => <th key={h} style={{ textAlign: i ? 'right' : 'left', padding: '10px 6px', fontWeight: 800 }}>{h}</th>)}</tr></thead>
                <tbody>
                  {MEALS.map((m) => {
                    const list = byMeal(m);
                    const mk = sumKcal(list);
                    return [
                      <tr key={m} style={{ borderTop: '1px solid var(--track)', cursor: 'pointer' }} onClick={() => setTarget(m)}>
                        <td style={{ padding: '10px 6px', fontWeight: 800, color: 'var(--acc)' }}>
                          <span className="row" style={{ gap: 6 }}>{MEAL_RU[m]}
                            <button aria-label="Скопировать приём пищи" disabled={!list.length} onClick={(ev) => { ev.stopPropagation(); setCopy(m); }} style={{ width: 32, height: 32, opacity: list.length ? 1 : 0.35, color: 'var(--ink)' }}><Icon d={COPY_ICON} size={16} /></button>
                            {list.length ? <a href={`#/food/${d}/dish/${m}/from-meal`} onClick={(ev) => ev.stopPropagation()} style={{ fontSize: 13, fontWeight: 800, color: 'var(--acc)' }}>Создать блюдо</a> : null}
                            <a aria-label="Добавить" href={`#/food/${d}/add/${m}`} onClick={(ev) => ev.stopPropagation()} style={{ width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 16, background: target === m || (!target && defaultTarget === m) ? 'var(--acc)' : 'var(--btn)', color: target === m || (!target && defaultTarget === m) ? 'var(--onAcc)' : 'var(--ink)' }}>+</a>
                          </span>
                        </td>
                        <td /><td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--acc)', padding: '10px 6px' }}>{list.length ? fmt(mk) : '—'}</td><td /><td /><td />
                      </tr>,
                      ...list.map((e) => {
                        const mm = entryMacros(e);
                        return (
                          <tr key={e.id} style={{ borderTop: '1px solid var(--line)', cursor: 'pointer' }} onClick={() => setEdit(e)}>
                            <td style={{ padding: '10px 6px' }}>{e.name}</td>
                            <td style={{ textAlign: 'right', padding: '10px 6px' }}>{amount(e)}</td>
                            <td style={{ textAlign: 'right', padding: '10px 6px' }}>{fmt(entryKcal(e))}</td>
                            {mm.map((v, i) => <td key={i} style={{ textAlign: 'right', padding: '10px 6px' }}>{Math.round(v)}</td>)}
                          </tr>
                        );
                      }),
                    ];
                  })}
                </tbody>
              </table>
            </div>
          </section>
          <aside className="col" style={{ flex: '1 1 320px', minWidth: 0, gap: 16 }}>
            <QuickAdd date={d} meal={defaultTarget} />
            <WeekMacroCard days={data.days} d={d} />
          </aside>
        </div>
        {sheets}
      </Screen>
    );
  }

  const t = today();
  const rel = diffDays(d, t);
  const dayTitle = `${rel === 0 ? 'Сегодня' : rel === -1 ? 'Вчера' : rel === 1 ? 'Завтра' : WD_SHORT[diffDays(d, start)]}, ${dayMonth(d)}`;
  return (
    <Screen>
      <div className="row" style={{ gap: 8 }}>
        <a className="icon-btn" aria-label="Предыдущая неделя" href={`#/food/${addDays(d, -7)}`}>‹</a>
        <b className="grow" style={{ textAlign: 'center', fontSize: 17, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{weekRange(start)}</b>
        <a className="icon-btn" aria-label="Следующая неделя" href={`#/food/${addDays(d, 7)}`}>›</a>
        <button className="icon-btn" aria-label="Календарь" onClick={() => go('food-calendar', d)}><Icon d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" size={20} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {days.map((x, i) => {
          const isSel = x === d, future = x > t;
          return (
            <a key={x} href={`#/food/${x}`} aria-current={isSel ? 'date' : undefined} style={{
              height: 54, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: isSel ? 'var(--acc)' : 'var(--card)', color: isSel ? 'var(--onAcc)' : future ? '#6B7480' : 'var(--ink)',
              border: isSel ? 0 : x === t ? '2px solid #6B7480' : '1px solid var(--cardBorder)', fontWeight: 800,
            }}>
              <span style={{ fontSize: 13 }}>{WD_SHORT[i]}</span><span style={{ fontSize: 15 }}>{fromDay(x).getDate()}</span>
            </a>
          );
        })}
      </div>
      <div className="between" style={{ gap: 8, minHeight: 36 }}>
        <h1 className="display a-h ell" style={{ fontSize: 17, minWidth: 0 }}>{dayTitle}</h1>
        {rel !== 0 ? <a href={`#/food/${t}`} style={{ flex: 'none', border: '1px solid var(--track)', color: 'var(--acc)', borderRadius: 999, padding: '6px 12px', fontWeight: 800, fontSize: 14 }}>К сегодня</a> : null}
      </div>
      <div className="card row a-in" style={{ borderRadius: 22, padding: 14, gap: 16 }}>
        <Ring eaten={eatenK} norm={normK} over={over} />
        <div className="col grow" style={{ gap: 9 }}>
          <b style={{ fontSize: 15, color: over ? 'var(--warnT)' : 'var(--ink)' }}>{over ? `Сверх нормы ${fmt(eatenK - normK)} ккал` : `Осталось ${fmt(normK - eatenK)} ккал`}</b>
          <span className="sub" style={{ whiteSpace: 'nowrap' }}>{fmt(normK)} · {info.isTraining ? 'тренировка' : 'отдых'}</span>
          {[0, 1, 2].map((i) => {
            const o = eaten[i] > info.norm[i] + 3;
            return (
              <div key={i} className="col" style={{ gap: 4 }}>
                <div className="between" style={{ fontSize: 14 }}><b>{NAMES[i]}</b><span className="num" style={{ color: o ? 'var(--warnT)' : 'var(--ink)' }}>{Math.round(eaten[i])} / {info.norm[i]}</span></div>
                <div className="bar" style={{ height: 7 }}><i className="a-fill" style={{ width: `${Math.min(100, (eaten[i] / (info.norm[i] || 1)) * 100)}%`, background: COLORS[i] }} /></div>
              </div>
            );
          })}
        </div>
      </div>
      {MEALS.map((m) => {
        const list = byMeal(m);
        const mk = sumKcal(list);
        return (
          <div key={m} className="card col a-in" style={{ borderRadius: 18, padding: '10px 12px', gap: 8 }}>
            <div className="row">
              <b className="grow" style={{ fontSize: 17 }}>{MEAL_RU[m]}</b>
              <span className="muted" style={{ fontWeight: 700 }}>{fmt(mk)} ккал</span>
              <button aria-label="Скопировать приём пищи" disabled={!list.length} onClick={() => setCopy(m)} style={{ width: 40, height: 40, borderRadius: 20, border: '1px solid var(--track)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: list.length ? 1 : 0.35 }}><Icon d={COPY_ICON} size={18} /></button>
              <a aria-label="Добавить" href={`#/food/${d}/add/${m}`} style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--acc)', color: 'var(--onAcc)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800 }}>+</a>
            </div>
            {list.map((e) => {
              const mm = entryMacros(e);
              return (
                <SwipeToDelete key={e.id} onDelete={() => deleteEntry(e)} onTap={() => setEdit(e)}>
                  <FoodArt kind={e.icon} size={40} />
                  <div className="grow"><div style={{ fontWeight: 700, fontSize: 15 }}>{e.name}</div><div className="sub">{amount(e)} · {e.dishId ? 'своё блюдо' : macroLine(mm)}</div></div>
                  <b style={{ fontSize: 15 }}>{fmt(entryKcal(e))}</b>
                </SwipeToDelete>
              );
            })}
            {list.length ? <a className="btn ghost" href={`#/food/${d}/dish/${m}/from-meal`} style={{ height: 48, borderRadius: 14, fontSize: 15 }}>+ Создать блюдо</a> : null}
          </div>
        );
      })}
      {sheets}
    </Screen>
  );
}

function Ring({ eaten, norm, over }: { eaten: number; norm: number; over: boolean }) {
  const len = 2 * Math.PI * 48;
  const dash = Math.min(1, norm ? eaten / norm : 0) * len;
  return (
    <div style={{ position: 'relative', width: 116, height: 116, flex: 'none' }} aria-label={`Съедено ${eaten} из ${norm} ккал`} role="img">
      <svg width="116" height="116" viewBox="0 0 116 116" aria-hidden="true">
        <circle cx="58" cy="58" r="48" fill="none" stroke="var(--track)" strokeWidth="12" />
        <circle cx="58" cy="58" r="48" fill="none" stroke={over ? 'var(--warn)' : 'var(--acc)'} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${dash} ${len}`} transform="rotate(-90 58 58)" style={{ transition: 'stroke-dasharray 1.1s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <b className="display num" style={{ fontSize: 22 }}>{fmt(eaten)}</b><span className="sub" style={{ fontSize: 12 }}>съедено</span>
      </div>
    </div>
  );
}

function EntrySheet({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  const [grams, setGrams] = useState('');
  useEffect(() => { if (entry) setGrams(String(Math.round(entry.grams))); }, [entry]);
  if (!entry) return null;
  const g = Number(grams) || 0;
  const m = entryMacros({ ...entry, grams: g });
  const per100 = Math.round(kcal100(entry));
  const save = async () => {
    onClose();
    try { await api('PATCH', `/diary/${entry.id}`, { grams: g }); invalidate('/diary'); } catch (e) { toast(errText(e)); }
  };
  const remove = async () => {
    onClose();
    try { await api('DELETE', `/diary/${entry.id}`); invalidate('/diary'); } catch (e) { toast(errText(e)); }
  };
  return (
    <Sheet open onClose={onClose} label={entry.name}>
      <div className="row"><FoodArt kind={entry.icon} size={60} /><div className="grow"><b style={{ fontSize: 19 }}>{entry.name}</b><div className="muted" style={{ fontSize: 14 }}>{entry.dishId ? 'своё блюдо · ' : ''}{per100} ккал на 100 г</div></div></div>
      <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr 52px', gap: 10, alignItems: 'center' }}>
        <button className="icon-btn" aria-label="Меньше" style={{ height: 52, width: 52, borderRadius: 14, border: '1px solid var(--track)' }} onClick={() => setGrams(String(Math.max(0, g - 50)))}>−</button>
        <div style={{ justifySelf: 'center', display: 'flex', alignItems: 'center', height: 56, padding: '0 18px', borderRadius: 14, background: 'var(--bg)' }}>
          <AmountInput label="Граммы" value={grams} onChange={setGrams} unit="г" size={28} />
        </div>
        <button className="icon-btn" aria-label="Больше" style={{ height: 52, width: 52, borderRadius: 14, border: '1px solid var(--track)' }} onClick={() => setGrams(String(Math.min(5000, g + 50)))}>+</button>
      </div>
      <Tiles m={m} k={entryKcal({ ...entry, grams: g })} />
      <button className="btn" disabled={g < 1 || g > 5000} onClick={save}>Сохранить</button>
      <button className="btn danger" onClick={remove}>Удалить из дневника</button>
    </Sheet>
  );
}

export function Tiles({ m, k, big }: { m: [number, number, number]; k: number; big?: boolean }) {
  const vals = [k, ...m.map((x) => Math.round(x))];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
      {['ккал', 'белки', 'жиры', 'углев.'].map((l, i) => (
        <div key={l} style={{ background: big ? 'var(--card)' : 'var(--bg)', border: big ? '1px solid var(--cardBorder)' : 0, borderRadius: big ? 14 : 12, padding: big ? '10px 6px' : 8, borderTop: `${big ? 4 : 3}px solid ${['var(--acc)', ...COLORS][i]}`, textAlign: 'center' }}>
          <div className={big ? 'display num' : 'num'} style={{ fontWeight: 800, fontSize: big ? 19 : 16 }}>{fmt(vals[i])}</div>
          <div className="sub" style={{ fontSize: 12 }}>{l}</div>
        </div>
      ))}
    </div>
  );
}

function CopySheet({ date, meal, entries, onClose }: { date: string; meal: Meal | null; entries: Entry[]; onClose: () => void }) {
  const [sel, setSel] = useState<string[]>([]);
  const [mode, setMode] = useState<'append' | 'replace'>('append');
  const [busy, setBusy] = useState(false);
  // Week shown in the picker; selected days stay selected while switching weeks (e.g. copy Sunday into next week).
  const [wk, setWk] = useState(() => weekStart(date));
  useEffect(() => { setSel([]); setMode('append'); setWk(weekStart(date)); }, [meal, date]);
  if (!meal) return null;
  const t = today();
  const days = weekDays(wk);
  const canPrev = addDays(wk, -1) >= t;
  const mk = sumKcal(entries);
  const run = async () => {
    setBusy(true);
    try {
      await api('POST', '/diary/copy', { fromDate: date, meal, toDates: sel, mode });
      invalidate('/diary');
      toast('Скопировано');
      onClose();
    } catch (e) { toast(errText(e)); } finally { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} label="Копирование">
      <b className="display" style={{ fontSize: 22 }}>Скопировать {MEAL_RU[meal].toLowerCase()}</b>
      <span className="muted ell">{entries.map((e) => e.name).join(', ')} · {fmt(mk)} ккал</span>
      <div className="between">
        <button className="icon-btn" aria-label="Прошлая неделя" disabled={!canPrev} onClick={() => setWk(addDays(wk, -7))} style={{ background: 'var(--bg)', opacity: canPrev ? 1 : 0.4 }}>‹</button>
        <b>{weekRange(wk)}</b>
        <button className="icon-btn" aria-label="Следующая неделя" onClick={() => setWk(addDays(wk, 7))} style={{ background: 'var(--bg)' }}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
        {days.map((x, i) => {
          const disabled = x < t || x === date;
          const on = sel.includes(x);
          return (
            <button key={x} disabled={disabled} aria-pressed={on} onClick={() => setSel((s) => (on ? s.filter((y) => y !== x) : [...s, x]))} style={{
              height: 62, borderRadius: 14, fontWeight: 800, opacity: disabled ? 0.45 : 1, background: on ? 'var(--acc)' : 'var(--bg)', color: on ? 'var(--onAcc)' : 'var(--ink)',
              border: x === t ? '2px solid #6B7480' : 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}><span style={{ fontSize: 13 }}>{WD_SHORT[i]}</span><span style={{ fontSize: 16 }}>{fromDay(x).getDate()}</span></button>
          );
        })}
      </div>
      <div className="seg" style={{ background: 'var(--bg)', padding: 3, borderRadius: 12 }}>
        <button aria-pressed={mode === 'append'} onClick={() => setMode('append')} style={{ height: 42, borderRadius: 9 }}>Добавить к еде</button>
        <button aria-pressed={mode === 'replace'} onClick={() => setMode('replace')} style={{ height: 42, borderRadius: 9 }}>Заменить</button>
      </div>
      <button className="btn big" style={{ height: 58 }} disabled={!sel.length || busy} onClick={run}>{sel.length ? `Скопировать в ${sel.length} ${plural(sel.length, ['день', 'дня', 'дней'])}` : 'Скопировать'}</button>
    </Sheet>
  );
}

function QuickAdd({ date, meal }: { date: string; meal: Meal }) {
  const [q, setQ] = useState('');
  const recent = useQuery<{ items: FoodItem[] }>('/food/recent');
  const search = useQuery<{ products: FoodItem[] }>(q.trim() ? `/products?q=${encodeURIComponent(q.trim())}` : '/products?limit=6', { keep: true });
  const dishes = useQuery<{ dishes: FoodItem[] }>('/dishes');
  const s = q.trim().toLowerCase();
  const items = s
    ? [...(dishes.data?.dishes ?? []).filter((x) => x.name.toLowerCase().includes(s)), ...(search.data?.products ?? [])]
    : (recent.data?.items.length ? recent.data.items : search.data?.products ?? []);
  const add = async (it: FoodItem) => {
    let grams = it.portionG ?? 100;
    try {
      const last = await api<{ grams: number | null }>('GET', `/food/last-grams?type=${it.type}&id=${it.id}`);
      if (last.grams) grams = last.grams;
      await api('POST', '/diary', { date, meal, itemType: it.type, itemId: it.id, grams, portions: it.portionG && grams === it.portionG ? 1 : null });
      invalidate('/diary', '/food/recent');
      toast(`Добавлено ${MEAL_IN[meal]}`);
    } catch (e) { toast(errText(e)); }
  };
  return (
    <div className="card col" style={{ gap: 10 }}>
      <a className="btn sec" style={{ height: 48, borderRadius: 14, fontSize: 15, alignSelf: 'flex-start' }} href={`#/food/${date}/add/${meal}`}>Добавить {MEAL_IN[meal]}</a>
      <SearchInput value={q} onChange={setQ} placeholder="Поиск по общей библиотеке" />
      {items.slice(0, 6).map((it) => (
        <div key={`${it.type}${it.id}`} className="row">
          <FoodArt kind={it.icon} size={44} />
          <div className="grow"><b>{it.name}</b><div className="sub">{it.type === 'dish' ? 'своё блюдо' : `${Math.round(kcal100(it))} ккал на 100 г`}</div></div>
          <button aria-label={`Добавить ${it.name}`} onClick={() => void add(it)} style={{ width: 34, height: 34, borderRadius: 17, border: '2px solid var(--acc)', color: 'var(--acc)', fontWeight: 800 }}>+</button>
        </div>
      ))}
    </div>
  );
}

function WeekMacroCard({ days, d }: { days: ReturnType<typeof useDays>['days']; d: string }) {
  if (!days) return null;
  const idx = days.findIndex((x) => x.date === d);
  const remaining = days.slice(idx + 1);
  return (
    <div className="card col" style={{ gap: 12 }}>
      <b style={{ fontSize: 18 }}>Неделя</b>
      {[0, 1, 2].map((j) => {
        const goal = days.reduce((a, x) => a + x.norm[j], 0);
        const eaten = days.slice(0, idx + 1).reduce((a, x) => a + (x.eaten?.[j] ?? 0), 0);
        const per = remaining.length ? Math.max(0, Math.round((goal - eaten) / remaining.length)) : null;
        const pre = j === 0 && remaining.length ? (remaining.length === 2 && remaining[0].date === days[5].date ? 'на выходные ' : `на ${remaining.length} дн. `) : '';
        return (
          <div key={j} className="col" style={{ gap: 6 }}>
            <div className="between"><b>{NAMES[j]}</b>{per !== null ? <span className="muted" style={{ fontSize: 13 }}>{pre}по {per} г</span> : null}</div>
            <div className="bar" style={{ height: 10, borderRadius: 5 }}><i className="a-fill" style={{ width: `${Math.min(100, (eaten / (goal || 1)) * 100)}%`, background: COLORS[j] }} /></div>
          </div>
        );
      })}
    </div>
  );
}

