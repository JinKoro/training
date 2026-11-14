import { donePct, durationMin, showKg, workoutStats } from '../lib/calc';
import { dayMonth, diffDays, WD_CAP, weekStart } from '../lib/dates';
import { useState } from 'react';
import { api } from '../lib/api';
import { invalidate, useQuery, forget } from '../lib/query';
import { go } from '../lib/router';
import type { Workout } from '../lib/types';
import { useApp } from '../app-context';
import { ErrorBox, MoreButton, Sheet, Skeleton, errText, menuRow, toast } from '../ui';

export function SummaryBody({ w, back, cta, onMenu }: { w: Workout; back?: string; cta?: { text: string; onClick: () => void }; onMenu?: () => void }) {
  const s = workoutStats(w);
  const dur = durationMin(w);
  const dateText = `${WD_CAP[diffDays(w.date, weekStart(w.date))]}, ${dayMonth(w.date)}`;
  return (
    <div className="col" style={{ gap: 14, paddingBottom: cta ? 96 : 24 }}>
      <div className="col" style={{ background: '#2438C9', color: '#fff', padding: 'calc(18px + var(--safe-top)) 18px 18px', borderRadius: '0 0 26px 26px', gap: 12 }}>
        {back || onMenu ? (
          <div className="between">
            {back ? <a href={back} style={{ fontWeight: 800, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>‹ Назад</a> : <span />}
            {onMenu ? <MoreButton onClick={onMenu} color="#fff" /> : null}
          </div>
        ) : null}
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{dateText}{back && dur ? ` · ${dur} мин` : ''}</div>
          <h1 className="display" style={{ fontSize: 24 }}>{back ? w.title : 'Тренировка завершена'}</h1>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="a-in" style={{ background: '#fff', color: '#12151C', borderRadius: 16, padding: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#5A6371' }}>Подходы</div>
            <div className="display num" style={{ fontSize: 24 }}>{s.done}</div>
            <div style={{ fontSize: 13, color: '#5A6371', fontWeight: 700 }}>из {s.total} по плану</div>
          </div>
          <div className="a-in" style={{ background: '#fff', color: '#12151C', borderRadius: 16, padding: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#5A6371' }}>Выполнено</div>
            <div className="display num" style={{ fontSize: 24 }}>{s.pct}%</div>
            <div style={{ fontSize: 13, color: '#5A6371', fontWeight: 700 }}>{s.D} из {s.P} повторов</div>
          </div>
        </div>
      </div>
      <div className="col" style={{ padding: '0 16px', gap: 10 }}>
        {w.exercises.map((e) => {
          const plan = e.sets.reduce((a, x) => a + x.plannedReps, 0);
          const dn = e.sets.reduce((a, x) => a + (x.completedAt !== null && x.reps !== null ? Math.min(x.reps, x.plannedReps) : 0), 0);
          const p = donePct(dn, plan);
          return (
            <div key={e.position} className="card col a-in" style={{ borderRadius: 16, gap: 10 }}>
              <div className="between"><b>{e.name}</b><b style={{ color: dn < plan ? 'var(--warnT)' : 'var(--goodT)' }}>{p}%</b></div>
              <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                {e.sets.map((x) => {
                  const done = x.completedAt !== null && x.reps !== null;
                  const ok = done && x.reps! >= x.plannedReps;
                  if (!done) {
                    return <span key={x.index} className="a-pop" style={{ minWidth: 76, borderRadius: 10, padding: '6px 9px', border: '2px dashed var(--warn)', color: 'var(--warnT)', fontWeight: 700, fontSize: 14 }}>
                      <div style={{ fontWeight: 800 }}>—</div>не сделан</span>;
                  }
                  return (
                    <span key={x.index} className="a-pop" title={`Подход ${x.index + 1}: ${showKg(x.weight)} кг × ${x.reps}`} style={{
                      minWidth: 76, borderRadius: 10, padding: '6px 9px', background: 'var(--btn)', border: `2px solid ${ok ? 'transparent' : 'var(--warn)'}`,
                    }}>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>{x.weight === null ? 'без веса' : `${showKg(x.weight)} кг`}</div>
                      <div style={{ color: ok ? 'var(--muted)' : 'var(--warnT)', fontWeight: 700, fontSize: 14 }}>{ok ? `× ${x.reps}` : `× ${x.reps} из ${x.plannedReps}`}</div>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {cta ? (
        <div className="fixed-bottom"><button className="btn big" style={{ height: 62, borderRadius: 20 }} onClick={cta.onClick}>{cta.text}</button></div>
      ) : null}
    </div>
  );
}

export function SummaryScreen({ id, back }: { id: number; back?: string }) {
  const { wide } = useApp();
  const q = useQuery<{ workout: Workout }>(`/workouts/${id}`);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  // Deleting frees the program day again, so the day screen offers to train it anew.
  const remove = async (date: string) => {
    if (busy) return;
    setBusy(true);
    try { await api('DELETE', `/workouts/${id}`); forget(`/workouts/${id}`); invalidate('/workouts'); toast('Тренировка удалена'); go('log'); }
    catch (e) { toast(errText(e)); setBusy(false); }
  };
  const backHref = back === 'week' ? '#/week' : back === 'calendar' ? '#/calendar' : back === 'workouts' ? `#/workouts/${id}` : '#/log';
  if (q.error) return <div className="page"><ErrorBox error={q.error} retry={q.reload} /></div>;
  if (!q.data) return <div className="page"><Skeleton n={4} /></div>;
  return (
    <div style={{ maxWidth: wide ? 760 : 640, margin: wide ? 0 : '0 auto', width: '100%' }}>
      <SummaryBody w={q.data.workout} back={backHref} onMenu={() => { setConfirm(false); setMenu(true); }} />
      {/* Same bottom sheet as the in-workout menu: actions, then the delete confirmation in place. */}
      <Sheet open={menu} onClose={() => setMenu(false)} label="Тренировка">
        {!confirm ? (
          <>
            <b style={{ fontSize: 18 }}>Тренировка</b>
            <div className="col" style={{ gap: 0 }}>
              <a href={back ? `#/workout-edit/${id}/${back}` : `#/workout-edit/${id}`} style={menuRow}>Изменить</a>
              <button onClick={() => setConfirm(true)} style={{ ...menuRow, color: 'var(--warn)', borderBottom: 0 }}>Удалить тренировку</button>
            </div>
          </>
        ) : (
          <>
            <b style={{ fontSize: 18 }}>Удалить тренировку?</b>
            <div className="col" style={{ gap: 0 }}>
              <button disabled={busy} onClick={() => void remove(q.data!.workout.date)} style={{ ...menuRow, color: 'var(--warn)' }}>Да, удалить</button>
              <button onClick={() => setMenu(false)} style={{ ...menuRow, borderBottom: 0 }}>Нет, оставить</button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}
