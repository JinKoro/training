import { useMemo, useState } from 'react';
import { useApp } from '../app-context';
import { activeProgram, dayTitle, durationMin, plannedOpen, weekRange, workoutStats } from '../lib/calc';
import { addDays, diffDays, fromDay, plural, today, WD_CAP, WD_SHORT, weekStart } from '../lib/dates';
import { useQuery } from '../lib/query';
import type { Workout } from '../lib/types';
import { ErrorBox, Screen, Skeleton } from '../ui';

const SHORT_M = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export function LogScreen() {
  const { programs, exById, wide } = useApp();
  const t = today();
  const [weeks, setWeeks] = useState(4);
  const from = addDays(weekStart(t), -(weeks - 1) * 7);
  const q = useQuery<{ workouts: Workout[] }>(`/workouts?from=${from}&to=${t}`);
  const all = useQuery<{ workouts: Workout[] }>('/workouts');
  const program = activeProgram(programs);

  const groups = useMemo(() => {
    if (!q.data) return null;
    const out: { start: string; rows: ({ kind: 'w'; w: Workout } | { kind: 'missed'; date: string; title: string })[] }[] = [];
    for (let i = 0; i < weeks; i++) {
      const start = addDays(weekStart(t), -i * 7);
      const rows: (typeof out)[number]['rows'] = [];
      for (let k = 6; k >= 0; k--) {
        const d = addDays(start, k);
        if (d > t) continue;
        const w = q.data.workouts.find((x) => x.date === d && x.status === 'finished');
        if (w) { rows.push({ kind: 'w', w }); continue; }
        if (d === t) continue;
        const pl = plannedOpen(program, d, q.data.workouts);
        if (!pl) continue;
        rows.push({ kind: 'missed', date: d, title: dayTitle(pl.rows, exById, WD_CAP[k]) });
      }
      if (rows.length) out.push({ start, rows });
    }
    return out;
  }, [q.data, weeks, t, program, exById]);

  const oldest = all.data?.workouts.reduce((m, w) => (w.date < m ? w.date : m), t) ?? t;
  const hasMore = from > oldest;

  return (
    <Screen title="Журнал">
      {!wide ? <h1 className="h1 a-h">Журнал</h1> : null}
      <div className="col" style={{ gap: 18, maxWidth: wide ? 760 : undefined }}>
        {q.error ? <ErrorBox error={q.error} retry={q.reload} /> : !groups ? <Skeleton n={4} /> : !groups.length ? <div className="empty">Здесь появятся прошедшие тренировки</div> : groups.map((g, gi) => {
          const done = g.rows.filter((r) => r.kind === 'w').length;
          return (
            <div key={g.start} className="col" style={{ gap: 8 }}>
              <div className="between">
                <span><b>{weekRange(g.start)}</b>{gi === 0 && g.start === weekStart(t) ? <span className="muted"> · эта неделя</span> : g.start === addDays(weekStart(t), -7) ? <span className="muted"> · прошлая</span> : null}</span>
                <span className="muted" style={{ fontSize: 13, fontWeight: 800 }}>{done} из {g.rows.length}</span>
              </div>
              <div className="list a-in">
                {g.rows.map((r) => {
                  const date = r.kind === 'w' ? r.w.date : r.date;
                  const wd = diffDays(date, weekStart(date));
                  const left = (
                    <div style={{ width: 40, flex: 'none' }}>
                      <b>{WD_SHORT[wd]}</b>
                      <div className="sub" style={{ fontSize: 12 }}>{fromDay(date).getDate()} {SHORT_M[fromDay(date).getMonth()]}</div>
                    </div>
                  );
                  if (r.kind === 'missed') {
                    return <div key={date} style={{ color: '#6B7480' }}>{left}<div className="grow"><b>{r.title}</b><div style={{ fontSize: 13, fontWeight: 700 }}>пропущена</div></div><b>—</b></div>;
                  }
                  const s = workoutStats(r.w);
                  const exN = r.w.exercises.length;
                  return (
                    <a key={r.w.id} href={`#/summary/${r.w.id}`}>
                      {left}
                      <div className="grow"><b>{r.w.title}</b><div className="sub">{exN} {plural(exN, ['упражнение', 'упражнения', 'упражнений'])}{durationMin(r.w) ? ` · ${durationMin(r.w)} мин` : ''}</div></div>
                      <b style={{ color: s.pct >= 100 ? 'var(--goodT)' : 'var(--warnT)' }}>{Math.min(100, s.pct)}%</b>
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })}
        {groups && hasMore ? <button className="btn small outline" style={{ color: 'var(--acc)' }} onClick={() => setWeeks((w) => w + 2)}>Показать ещё 2 недели</button> : null}
      </div>
    </Screen>
  );
}
