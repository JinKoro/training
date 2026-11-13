import { useMemo, useState } from 'react';
import { useApp } from '../app-context';
import { kcal } from '../lib/calc';
import { addDays, dayMonth, diffDays, fromDay, isDayStr, MONTH_GEN, MONTH_NOM, toDay, today, WD_CAP, WD_SHORT, weekStart } from '../lib/dates';
import { useDays } from '../lib/hooks';
import { go } from '../lib/router';
import { ErrorBox, Screen, Skeleton } from '../ui';
import { FoodCard, WorkoutCard } from './Week';

/** Month calendar. `food`: opened from the food diary — same grid, the panel shows that day's food with a button to open it. */
export function CalendarScreen({ date, food }: { date?: string; food?: boolean }) {
  const { wide } = useApp();
  const t = today();
  const anchor = date && isDayStr(date) ? date : t;
  const a = fromDay(anchor);
  const first = toDay(new Date(a.getFullYear(), a.getMonth(), 1));
  const daysInMonth = new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate();
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => addDays(first, i)), [first, daysInMonth]);
  const data = useDays(days);
  const [sel, setSel] = useState<string | null>(null);
  const inMonth = (d: string) => d.slice(0, 7) === first.slice(0, 7);
  const selected = sel && inMonth(sel) ? sel : (inMonth(anchor) ? anchor : first);
  const lead = diffDays(first, weekStart(first));
  const isCurrent = inMonth(t);
  const route = food ? 'food-calendar' : 'calendar';
  const shift = (n: number) => { setSel(null); go(route, toDay(new Date(a.getFullYear(), a.getMonth() + n, 1))); };

  if (data.error) return <Screen title="Календарь"><ErrorBox error={data.error} retry={data.reload} /></Screen>;
  if (!data.days) return <Screen title="Календарь"><Skeleton n={4} /></Screen>;
  const d = data.days.find((x) => x.date === selected)!;
  const status = d.isToday ? ['идёт день', 'var(--acc)'] : d.isPlan ? ['впереди', 'var(--muted)']
    : (d.kcal ?? 0) > kcal(d.norm) + 100 ? ['перебор', 'var(--warnT)'] : ['в норме', 'var(--goodT)'];

  const grid = (
    <>
      {food ? <a className="link" href={`#/food/${anchor}`}>‹ Еда</a> : !wide ? <a className="link" href={`#/week/${Math.round(diffDays(weekStart(selected), weekStart(t)) / 7)}`}>‹ Неделя</a> : null}
      <div className="row" style={{ gap: 8 }}>
        <button className="icon-btn" aria-label="Предыдущий месяц" onClick={() => shift(-1)}>‹</button>
        <div className="grow col" style={{ alignItems: 'center', gap: 4 }}>
          <h1 className="display a-h" style={{ fontSize: 24 }}>{MONTH_NOM[a.getMonth()]} {a.getFullYear()}</h1>
          {!isCurrent ? <button onClick={() => { setSel(null); go(route, t); }} style={{ height: 26, padding: '0 10px', borderRadius: 13, background: 'var(--acc)', color: 'var(--onAcc)', fontSize: 12, fontWeight: 800 }}>К сегодня</button> : null}
        </div>
        <button className="icon-btn" aria-label="Следующий месяц" onClick={() => shift(1)}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {WD_SHORT.map((w) => <span key={w} className="muted" style={{ textAlign: 'center', fontSize: 13, fontWeight: 800 }}>{w}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
        {data.days.map((x) => {
          const isSel = x.date === selected;
          const past = x.date < t;
          const hasFood = (x.kcal ?? 0) > 0;
          const foodColor = x.isToday ? (hasFood ? 'var(--track)' : null) : past && hasFood ? ((x.kcal ?? 0) > kcal(x.norm) + 100 ? 'var(--warn)' : 'var(--good)') : null;
          const missed = past && x.isTraining && !x.workout;
          return (
            <button key={x.date} onClick={() => setSel(x.date)} aria-pressed={isSel} title={dayMonth(x.date)}
              style={{
                height: 58, borderRadius: 12, background: isSel ? 'var(--btn)' : 'var(--sub)',
                border: `2px solid ${isSel ? 'var(--ink)' : x.isToday ? 'var(--acc)' : 'transparent'}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0',
              }}>
              <b style={{ fontSize: 15 }}>{fromDay(x.date).getDate()}</b>
              <span className="row" style={{ gap: 4, height: 7 }}>
                {x.isTraining ? <i style={{ width: 7, height: 7, borderRadius: 4, boxSizing: 'border-box', background: x.date <= t && !missed ? 'var(--acc)' : 'transparent', border: x.date > t || missed ? '2px solid var(--acc)' : 'none' }} /> : null}
                {foodColor ? <i style={{ width: 14, height: 7, borderRadius: 4, background: foodColor }} /> : null}
              </span>
            </button>
          );
        })}
      </div>
      <div className="row muted" style={{ fontSize: 13, fontWeight: 700, gap: 14, flexWrap: 'wrap' }}>
        <span className="row" style={{ gap: 6 }}><i style={{ width: 7, height: 7, borderRadius: 4, background: 'var(--acc)' }} />тренировка</span>
        <span className="row" style={{ gap: 6 }}><i style={{ width: 14, height: 7, borderRadius: 4, background: 'var(--good)' }} />в норме</span>
        <span className="row" style={{ gap: 6 }}><i style={{ width: 14, height: 7, borderRadius: 4, background: 'var(--warn)' }} />перебор</span>
      </div>
    </>
  );
  const panel = (
    <>
      <div className="between">
        <span className="display" style={{ fontSize: 17 }}>{d.isToday ? `Сегодня, ${dayMonth(d.date)}` : `${WD_CAP[diffDays(d.date, weekStart(d.date))]}, ${dayMonth(d.date)}`}</span>
        <b style={{ fontSize: 14, color: status[1] }}>{status[0]}</b>
      </div>
      {!food ? <WorkoutCard d={d} calendar /> : null}
      <FoodCard d={d} title="Еда" meals />
      {food ? <a className="btn" href={`#/food/${d.date}`}>Открыть день ›</a> : (
        <a className="link" href={`#/food/${d.date}`} style={{ minHeight: 36 }}>
          {d.isToday ? 'Добавить еду ›' : d.isPlan ? 'Запланировать еду ›' : 'Дневник еды за этот день ›'}
        </a>
      )}
    </>
  );
  return (
    <Screen title="Календарь">
      {wide ? <div className="cols"><div>{grid}</div><div>{panel}</div></div> : <>{grid}{panel}</>}
    </Screen>
  );
}

export const monthTitle = (d: string) => `${fromDay(d).getDate()} ${MONTH_GEN[fromDay(d).getMonth()]}`;
