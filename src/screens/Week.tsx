import { useMemo, useRef, useState } from 'react';
import { useApp } from '../app-context';
import { activeProgram, dayTitle, fmt, kcal, MEAL_RU, MEALS, weekRange, workoutStats, type DayInfo } from '../lib/calc';
import { addDays, dayMonth, diffDays, plural, today, WD_CAP, WD_SHORT, weekDays, weekStart } from '../lib/dates';
import { useDays } from '../lib/hooks';
import { go } from '../lib/router';
import type { Macros } from '../lib/types';
import { FoodArt, Icon } from '../art';
import { ErrorBox, MacroBar, Screen, Skeleton } from '../ui';

const MACRO_COLORS = ['var(--chart)', 'var(--warn)', 'var(--good)'];
const MACRO_NAMES = ['Белки', 'Жиры', 'Углеводы'];
const RU_SHORT_LOWER = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

export const joinDays = (idx: number[]) => {
  const n = idx.map((i) => RU_SHORT_LOWER[i]);
  return n.length <= 1 ? n.join('') : `${n.slice(0, -1).join(', ')} и ${n[n.length - 1]}`;
};

export function WeekScreen({ offset }: { offset: number }) {
  const { programs, wide } = useApp();
  const start = addDays(weekStart(today()), offset * 7);
  const days = useMemo(() => weekDays(start), [start]);
  const data = useDays(days);
  const [sel, setSel] = useState<number | null>(null);
  const touch = useRef<number | null>(null);
  const setOffset = (o: number) => { setSel(null); go('week', o); };

  if (data.error) return <Screen title="Неделя"><ErrorBox error={data.error} retry={data.reload} /></Screen>;
  if (!data.days) return <Screen title="Неделя"><Skeleton n={4} /></Screen>;

  const empty = offset === 0 && !programs.length && !data.entries.length && !data.workouts.length;
  if (empty) return <EmptyWeek days={data.days} />;

  const ds = data.days;
  const todayIdx = ds.findIndex((d) => d.isToday);
  const selected = sel ?? (todayIdx >= 0 ? todayIdx : 0);

  const left = (
    <>
      <WeekHeader start={start} offset={offset} onOffset={setOffset} />
      <Budget days={ds} offset={offset} />
      <Bars days={ds} selected={selected} onSelect={setSel} />
    </>
  );
  const right = <DayPanel d={ds[selected]} onToday={() => { if (offset) setOffset(0); else setSel(todayIdx); }} />;
  return (
    <Screen title="Неделя">
      <div
        className={wide ? 'cols' : 'col'} style={{ gap: wide ? 28 : 12 }}
        onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touch.current === null) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          touch.current = null;
          if (Math.abs(dx) > 50) setOffset(offset + (dx > 0 ? -1 : 1));
        }}
      >
        {wide ? <><div>{left}</div><div>{right}</div></> : <>{left}{right}</>}
      </div>
    </Screen>
  );
}

function WeekHeader({ start, offset, onOffset }: { start: string; offset: number; onOffset: (o: number) => void }) {
  return (
    <div className="row" style={{ gap: 8 }}>
      <button className="icon-btn" aria-label="Предыдущая неделя" onClick={() => onOffset(offset - 1)}>‹</button>
      <b className="grow" style={{ textAlign: 'center', fontSize: 17, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{weekRange(start)}</b>
      <button className="icon-btn" aria-label="Следующая неделя" onClick={() => onOffset(offset + 1)}>›</button>
      <a className="icon-btn" aria-label="Календарь" href={`#/calendar/${start}`}><Icon d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" size={20} /></a>
    </div>
  );
}

function Budget({ days, offset }: { days: DayInfo[]; offset: number }) {
  const B = days.reduce((a, d) => a + kcal(d.norm), 0);
  const eaten = days.reduce((a, d) => a + (d.kcal ?? 0), 0);
  let label: string, big: number, hint: string | null;
  if (offset < 0) {
    label = 'Съедено за неделю'; big = eaten;
    hint = eaten > B ? `Больше бюджета на ${fmt(eaten - B)} ккал из ${fmt(B)}` : `Меньше бюджета на ${fmt(B - eaten)} ккал из ${fmt(B)}`;
  } else if (offset === 0) {
    label = 'Осталось на неделю'; big = B - eaten;
    const ti = days.findIndex((d) => d.isToday);
    const rest = days.slice(ti + 1);
    if (rest.length) {
      const before = days.slice(0, ti).reduce((a, d) => a + (d.kcal ?? 0), 0);
      const tday = days[ti];
      const x = Math.round((B - before - Math.max(tday.kcal ?? 0, kcal(tday.norm))) / rest.length);
      hint = `Доешь сегодня норму, и на ${joinDays(rest.map((_, i) => ti + 1 + i))} останется по ${fmt(Math.max(0, x))}`;
    } else hint = null;
  } else {
    label = 'Бюджет на неделю'; big = B;
    const nT = days.filter((d) => d.isTraining).length, nR = 7 - nT;
    const kT = days.find((d) => d.isTraining), kR = days.find((d) => !d.isTraining);
    const parts = [];
    if (nT && kT) parts.push(`${nT} ${plural(nT, ['тренировочный день', 'тренировочных дня', 'тренировочных дней'])} по ${fmt(kcal(kT.norm))}`);
    if (nR && kR) parts.push(`${nR} ${plural(nR, ['день', 'дня', 'дней'])} отдыха по ${fmt(kcal(kR.norm))}`);
    hint = parts.join(' и ');
  }
  return (
    <a className="col a-in" href={`#/week-macros/${offset}`} aria-label="Калории и БЖУ за неделю" style={{ gap: 2 }}>
      <span className="muted" style={{ fontSize: 14, fontWeight: 700 }}>{label}</span>
      <span className="row" style={{ gap: 6, alignItems: 'baseline' }}>
        <span className="display num" style={{ fontSize: 44, letterSpacing: '-.03em' }}>{fmt(big)}</span>
        <span style={{ fontSize: 18 }}>ккал</span><span style={{ color: 'var(--acc)', fontSize: 24, fontWeight: 800 }}>›</span>
      </span>
      {hint ? <span className="muted" style={{ fontSize: 14 }}>{hint}</span> : null}
    </a>
  );
}

function Bars({ days, selected, onSelect }: { days: DayInfo[]; selected: number; onSelect: (i: number) => void }) {
  const scale = Math.max(3000, ...days.map((d) => d.kcal ?? kcal(d.norm)));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, height: 128 }}>
      {days.map((d, k) => {
        const val = d.isPlan ? kcal(d.norm) : d.kcal ?? 0;
        const over = !d.isPlan && !d.isToday && (d.kcal ?? 0) > kcal(d.norm) + 100;
        const isSel = k === selected;
        return (
          <button key={d.date} onClick={() => onSelect(k)} aria-pressed={isSel}
            title={d.isPlan ? `${WD_SHORT[k]}: норма ${kcal(d.norm)} ккал` : `${WD_SHORT[k]}: ${d.kcal} ккал`}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
            <i className="a-bar" style={{
              width: '100%', maxWidth: 34, height: Math.max(4, Math.round((val / scale) * 90)), borderRadius: '6px 6px 2px 2px',
              background: d.isPlan ? 'transparent' : over ? 'var(--warn)' : d.isToday ? 'var(--acc)' : 'var(--chart)',
              border: d.isPlan ? '2px dashed var(--track)' : 'none', opacity: d.isPlan || isSel ? 1 : 0.75, boxSizing: 'border-box',
              animationDelay: `${0.15 + k * 0.05}s`,
            }} />
            <span style={{
              fontSize: 13, fontWeight: 800, minWidth: 30, borderRadius: 8, padding: '2px 0',
              background: isSel ? 'var(--acc)' : 'transparent', color: isSel ? 'var(--onAcc)' : d.isToday ? 'var(--acc)' : 'var(--ink)',
            }}>{WD_SHORT[k]}</span>
            <i style={{ width: 6, height: 6, borderRadius: 3, background: d.isTraining ? 'var(--acc)' : 'transparent' }} />
          </button>
        );
      })}
    </div>
  );
}

export function FoodCard({ d, title, meals }: { d: DayInfo; title?: string; meals?: boolean }) {
  const normK = kcal(d.norm);
  const over = !d.isPlan && !d.isToday && (d.kcal ?? 0) > normK + 100;
  const suffix = d.isToday ? 'пока' : d.isPlan ? 'план' : 'итог';
  const eaten: Macros = d.eaten ?? [0, 0, 0];
  return (
    <div className="card col a-in" style={{ gap: 10 }}>
      <div className="between">
        <span className="row" style={{ fontWeight: 800 }}><span style={{ color: 'var(--acc)' }}><Icon d="M3 12h18a9 9 0 0 1-18 0zM8 8c0-2 2-2 2-4M13 8c0-2 2-2 2-4" size={20} /></span>{title ?? `Еда · ${suffix}`}</span>
        <span><b className="display num" style={{ fontSize: 17, color: over ? 'var(--warnT)' : d.isPlan ? 'var(--muted)' : 'var(--ink)' }}>{fmt(d.kcal ?? 0)}</b><span className="muted"> / {fmt(normK)} ккал</span></span>
      </div>
      {[0, 1, 2].map((i) => (
        <MacroBar key={i} name={MACRO_NAMES[i]} value={eaten[i]} norm={d.norm[i]} color={MACRO_COLORS[i]} over={!d.isToday && !d.isPlan && eaten[i] - d.norm[i] > 3} />
      ))}
      {meals && d.meals && !d.isPlan ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {MEALS.map((m) => (
            <div key={m} style={{ background: 'var(--sub)', borderRadius: 10, padding: '6px 8px' }}>
              <div className="sub" style={{ fontSize: 12, fontWeight: 800 }}>{MEAL_RU[m]}</div>
              <b className="num" style={{ fontSize: 14 }}>{fmt(kcal(d.meals![m]))}</b>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function WorkoutCard({ d, calendar }: { d: DayInfo; calendar?: boolean }) {
  const { programs, exById } = useApp();
  const program = activeProgram(programs);
  const t = today();
  const w = d.workout;
  const icon = <span style={{ color: 'var(--acc)' }}><Icon d="M3 12h3M18 12h3M6 8v8M18 8v8M9 10v4M15 10v4M9 12h6" size={22} /></span>;
  if (!d.isTraining) {
    if (calendar) return <div className="card row a-in">{icon}<div className="grow"><b>День отдыха</b><div className="sub">тренировки нет</div></div></div>;
    return <div className="card row a-in muted" style={{ fontWeight: 700 }}><Icon d="M20 14A8 8 0 1 1 10 4a7 7 0 0 0 10 10z" size={20} />Тренировки нет, день отдыха</div>;
  }
  const title = w?.title ?? (d.planned ? dayTitle(d.planned.rows, exById, WD_CAP[(diffDays(d.date, weekStart(d.date)))]) : 'Тренировка');
  let sub: string, btn: { text: string; href: string; primary?: boolean } | null = null, btn2: { text: string; href: string } | null = null;
  if (w && w.status === 'finished') {
    const s = workoutStats(w);
    const dur = w.finishedAt ? Math.max(1, Math.round((w.finishedAt - w.startedAt) / 60000)) : null;
    sub = `✓ выполнено ${s.pct}%${calendar && dur ? ` · ${dur} мин` : ''}`;
    btn = { text: calendar ? 'Итог' : 'Итог ›', href: `#/summary/${w.id}` };
    if (calendar) btn2 = { text: 'Изменить', href: `#/workout-edit/${w.id}` };
  } else if (w) {
    sub = 'идёт тренировка';
    btn = { text: 'Продолжить', href: `#/workout/${w.id}`, primary: true };
  } else if (d.date === t) {
    const rows = d.planned?.rows ?? [];
    const sets = rows.reduce((a, r) => a + r.sets, 0);
    sub = `${rows.length} ${plural(rows.length, ['упражнение', 'упражнения', 'упражнений'])} · ${sets} ${plural(sets, ['подход', 'подхода', 'подходов'])}`;
    btn = { text: calendar ? 'Начать тренировку' : 'Начать', href: `#/day/${d.date}`, primary: true };
  } else if (d.date < t) {
    sub = 'пропущена';
    if (!calendar) btn = { text: 'Календарь ›', href: `#/calendar/${d.date}` };
  } else {
    sub = 'по плану';
    btn = { text: calendar ? 'Открыть план' : 'План ›', href: program ? `#/program/${program.id}` : '#/sport' };
  }
  return (
    <div className="card col a-in" style={{ gap: 12 }}>
      <div className="row">
        {icon}
        <div className="grow"><b>{title}</b><div className="sub" style={{ fontSize: 14 }}>{sub}</div></div>
        {!calendar && btn ? <a className={`btn small ${btn.primary ? '' : 'sec'}`} href={btn.href}>{btn.text}</a> : null}
      </div>
      {calendar && (btn || btn2) ? (
        <div className="row">
          {btn ? <a className={`btn small grow ${btn.primary ? '' : 'sec'}`} href={btn.href}>{btn.text}</a> : null}
          {btn2 ? <a className="btn small grow outline" href={btn2.href}>{btn2.text}</a> : null}
        </div>
      ) : null}
    </div>
  );
}

function DayPanel({ d, onToday }: { d: DayInfo; onToday: () => void }) {
  return (
    <>
      <div className="between" style={{ gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div className="display ell" style={{ fontSize: 17 }}>{d.isToday ? `Сегодня, ${dayMonth(d.date)}` : `${WD_CAP[diffDays(d.date, weekStart(d.date))]}, ${dayMonth(d.date)}`}</div>
          <div className="muted" style={{ fontSize: 14, fontWeight: 700 }}>{d.isTraining ? 'День тренировки' : 'День отдыха'}</div>
        </div>
        {!d.isToday ? <button onClick={onToday} style={{ flex: 'none', border: '1px solid var(--track)', color: 'var(--acc)', borderRadius: 999, padding: '6px 12px', fontWeight: 800, fontSize: 14 }}>К сегодня</button> : null}
      </div>
      <a href={`#/food/${d.date}`} style={{ display: 'block' }}><FoodCard d={d} /></a>
      <WorkoutCard d={d} />
    </>
  );
}

function EmptyWeek({ days }: { days: DayInfo[] }) {
  const B = days.reduce((a, d) => a + kcal(d.norm), 0);
  return (
    <Screen title="Неделя">
      <div><b>Неделя 1</b><div className="muted" style={{ fontSize: 14 }}>{weekRange(days[0].date)}</div></div>
      <div className="col" style={{ gap: 2 }}>
        <span className="muted" style={{ fontSize: 14, fontWeight: 700 }}>Бюджет на неделю</span>
        <span><span className="display num" style={{ fontSize: 44 }}>{fmt(B)}</span> <span style={{ fontSize: 18 }}>ккал</span></span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, height: 100, alignItems: 'end' }}>
        {WD_SHORT.map((w, i) => (
          <div key={w} className="col" style={{ alignItems: 'center', gap: 4 }}>
            <i className="a-bar" style={{ width: '100%', maxWidth: 34, height: 70, border: '2px dashed var(--track)', borderRadius: '6px 6px 2px 2px', animationDelay: `${0.15 + i * 0.05}s` }} />
            <span style={{ fontSize: 13, fontWeight: 800 }}>{w}</span>
          </div>
        ))}
      </div>
      <div className="a-in col" style={{ background: '#2438C9', color: '#fff', borderRadius: 22, padding: 16, gap: 12 }}>
        <span className="display" style={{ fontSize: 20 }}>Плана тренировок пока нет</span>
        <a className="btn a-in" style={{ background: '#fff', color: '#2438C9', height: 50, borderRadius: 14 }} href="#/program/new">Создать программу</a>
      </div>
      <a className="card row a-in" href={`#/food/${today()}/add/breakfast`}>
        <FoodArt kind="oat" size={48} />
        <b className="grow">Добавь первый приём пищи</b>
        <span style={{ color: 'var(--acc)', fontSize: 22, fontWeight: 800 }}>+</span>
      </a>
    </Screen>
  );
}

export function WeekMacrosScreen({ offset }: { offset: number }) {
  const start = addDays(weekStart(today()), offset * 7);
  const days = useMemo(() => weekDays(start), [start]);
  const data = useDays(days);
  const { programs, wide } = useApp();
  const program = activeProgram(programs);
  const weekNo = program ? Math.floor(diffDays(start, program.startDate) / 7) + 1 : null;
  return (
    <Screen title="Баланс БЖУ" className="modal">
      {!wide ? <a className="link" href={`#/week/${offset}`}>‹ Неделя</a> : <a className="link" href={`#/week/${offset}`}>‹ Неделя</a>}
      {!wide ? <h1 className="h1 a-h" style={{ fontSize: 26 }}>Баланс БЖУ</h1> : null}
      <span className="muted" style={{ fontSize: 14 }}>{weekNo && weekNo >= 1 && weekNo <= (program?.weeks ?? 0) ? `Неделя ${weekNo} · ` : ''}{weekRange(start)}</span>
      {data.error ? <ErrorBox error={data.error} retry={data.reload} /> : !data.days ? <Skeleton n={3} /> : (
        <div className={wide ? 'cols' : 'col'} style={wide ? { gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' } : { gap: 12 }}>
          {[0, 1, 2].map((j) => <MacroWeek key={j} j={j} days={data.days!} />)}
        </div>
      )}
    </Screen>
  );
}

function MacroWeek({ j, days }: { j: number; days: DayInfo[] }) {
  const goal = days.reduce((a, d) => a + d.norm[j], 0);
  const ti = days.findIndex((d) => d.isToday);
  const past = days.filter((d) => !d.isPlan);
  const sum = Math.round(past.reduce((a, d) => a + (d.eaten?.[j] ?? 0), 0));
  const rest = days.filter((d) => d.isPlan);
  let left = 0, line: { text: string; warn: boolean } | null = null;
  if (rest.length) {
    const before = days.filter((d) => !d.isPlan && !d.isToday).reduce((a, d) => a + (d.eaten?.[j] ?? 0), 0);
    const tday = ti >= 0 ? Math.max(days[ti].eaten?.[j] ?? 0, days[ti].norm[j]) : 0;
    left = Math.max(0, Math.round((goal - before - tday) / rest.length));
    const avgNorm = rest.reduce((a, d) => a + d.norm[j], 0) / rest.length;
    const diff = Math.round(left - avgNorm);
    const pre = (() => { const s = joinDays(rest.map((d) => days.indexOf(d))); return s[0].toUpperCase() + s.slice(1); })();
    line = diff < -5 ? { text: `${pre}: по ${left} г, на ${-diff} г меньше нормы — неделя уже с перебором`, warn: true }
      : diff > 5 ? { text: `${pre}: по ${left} г, можно добрать ${diff} г сверх нормы`, warn: false }
        : { text: `${pre}: по ${left} г, ровно по норме`, warn: false };
  }
  const max = 1.1 * Math.max(1, ...days.map((d) => Math.max(d.eaten?.[j] ?? 0, d.norm[j], d.isPlan ? left : 0)));
  return (
    <div className="card col a-in" style={{ gap: 10 }}>
      <div className="between"><b style={{ fontSize: 17 }}>{MACRO_NAMES[j]}</b><span className="muted"><b style={{ color: 'var(--ink)' }}>{fmt(sum)}</b> из {fmt(goal)} г за неделю</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, height: 64, alignItems: 'end' }}>
        {days.map((d, k) => {
          const g = d.isPlan ? left : d.eaten?.[j] ?? 0;
          const over = !d.isPlan && !d.isToday && g > d.norm[j] + 3;
          return (
            <div key={d.date} style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
              title={d.isPlan ? `${WD_SHORT[k]}: план ${left} г` : `${WD_SHORT[k]}: ${Math.round(g)} из ${d.norm[j]} г`}>
              <i className="a-bar" style={{
                width: '100%', maxWidth: 30, height: Math.round((g / max) * 64), borderRadius: '5px 5px 2px 2px', boxSizing: 'border-box',
                background: d.isPlan ? 'transparent' : d.isToday ? 'var(--acc)' : over ? 'var(--warn)' : 'var(--chart)',
                border: d.isPlan ? '2px dashed var(--chart)' : 'none', animationDelay: `${0.15 + k * 0.05}s`,
              }} />
              <i style={{ position: 'absolute', left: 2, right: 2, bottom: Math.round((d.norm[j] / max) * 64), height: 2, background: 'var(--ink)', opacity: 0.7 }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, textAlign: 'center' }}>
        {days.map((d, k) => <span key={d.date} style={{ fontSize: 12, fontWeight: 800, color: d.isToday ? 'var(--acc)' : d.isTraining ? 'var(--ink)' : 'var(--muted)' }}>{WD_SHORT[k]}</span>)}
      </div>
      {line ? <span style={{ fontSize: 14, fontWeight: 800, color: line.warn ? 'var(--warnT)' : 'var(--ink)' }}>{line.text}</span> : null}
    </div>
  );
}
