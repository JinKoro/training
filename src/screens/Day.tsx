import { useState } from 'react';
import { useApp } from '../app-context';
import { api } from '../lib/api';
import { activeProgram, dayTitle, exerciseSubtitle, mmss, plannedFor, setWeights, showKg, workoutFromPlan } from '../lib/calc';
import { diffDays, isDayStr, plural, today, WD_CAP, weekStart } from '../lib/dates';
import { invalidate, useQuery } from '../lib/query';
import { go } from '../lib/router';
import type { Workout } from '../lib/types';
import { ExerciseArt } from '../art';
import { errText, Screen, Skeleton, toast } from '../ui';

export function DayScreen({ date }: { date?: string }) {
  const { programs, exById, wide } = useApp();
  const d = isDayStr(date) ? date : today();
  const program = activeProgram(programs);
  const planned = plannedFor(program, d);
  const wq = useQuery<{ workouts: Workout[] }>(`/workouts?from=${d}&to=${d}`);
  const [busy, setBusy] = useState(false);
  const weekOffset = Math.round(diffDays(weekStart(d), weekStart(today())) / 7);
  const wdName = WD_CAP[diffDays(d, weekStart(d))];

  if (!wq.data) return <Screen><Skeleton n={4} /></Screen>;
  const existing = wq.data.workouts[0];
  const rows = planned?.rows ?? [];
  const title = dayTitle(rows, exById, wdName);
  const sets = rows.reduce((a, r) => a + r.sets, 0);
  const minutes = Math.round(rows.reduce((a, r) => a + r.sets * (45 + (r.rest ?? exById.get(r.exerciseId)?.rest ?? 150)), 0) / 60);

  const start = async () => {
    if (busy) return;
    if (existing) { go(existing.status === 'finished' ? 'summary' : 'workout', existing.id); return; }
    if (!program || !planned) return;
    setBusy(true);
    try {
      const { workout } = await api<{ workout: Workout }>('POST', '/workouts', workoutFromPlan(program, planned.week, planned.weekday, d, exById, title));
      invalidate('/workouts');
      go('workout', workout.id);
    } catch (e) { toast(errText(e)); setBusy(false); }
  };

  return (
    <Screen className="fixed-cta">
      <div className="between">
        <a className="link" href={wide ? '#/workouts' : `#/week/${weekOffset}`}>‹ {wide ? 'Тренировки' : 'Неделя'}</a>
        {program ? <a className="link" href={`#/program/${program.id}/edit`}>Изменить</a> : null}
      </div>
      <div>
        <div className="muted" style={{ fontSize: 14, fontWeight: 700 }}>{wdName}{planned ? ` · неделя ${planned.week} программы` : ''}</div>
        <h1 className="display a-h" style={{ fontSize: 24 }}>{planned ? title : 'Тренировки нет'}</h1>
      </div>
      {planned && rows.length ? (
        <>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {[`${rows.length} ${plural(rows.length, ['упражнение', 'упражнения', 'упражнений'])}`, `${sets} ${plural(sets, ['подход', 'подхода', 'подходов'])}`, `~ ${minutes} мин`].map((c) => (
              <span key={c} style={{ background: 'var(--card)', borderRadius: 10, padding: '6px 10px', fontSize: 13, fontWeight: 800 }}>{c}</span>
            ))}
          </div>
          <div className="col">
            {rows.map((r, i) => {
              const ex = exById.get(r.exerciseId);
              const ws = setWeights(r.kg, r.sets);
              const uniq = [...new Set(ws.map((w) => showKg(w)))];
              const wText = ws.every((w) => w === null) ? '—' : uniq.length === 1 ? `${uniq[0]} × ${r.sets}` : ws.map((w) => showKg(w)).join(' · ');
              const rest = r.rest ?? ex?.rest ?? 150;
              return (
                <a key={i} className="card col a-in" style={{ gap: 10, padding: 12, borderRadius: 18 }} href={`#/exercises/all/${r.exerciseId}`}>
                  <div className="row">
                    <ExerciseArt kind={ex?.kind} name={ex?.name} size={56} />
                    <div className="grow"><b>{i + 1}. {ex?.name ?? 'Упражнение'}</b><div className="sub">{ex ? exerciseSubtitle(ex) : ''}</div></div>
                    <span className="muted" style={{ fontWeight: 800 }}>›</span>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    {[[`${r.sets} × ${r.reps}`, 'подходы', 1], [wText, 'вес, кг', 1.6], [r.note || mmss(rest), r.note ? 'заметка' : 'отдых', 1]].map(([v, l, f]) => (
                      <div key={String(l)} style={{ flex: Number(f), minWidth: 0, background: 'var(--bg)', borderRadius: 10, padding: '6px 8px' }}>
                        <div className="ell" style={{ fontWeight: 800, fontSize: 15 }}>{v}</div>
                        <div className="sub" style={{ fontSize: 12 }}>{l}</div>
                      </div>
                    ))}
                  </div>
                </a>
              );
            })}
          </div>
          <div className="fixed-bottom">
            <button className="btn big blue" style={{ height: 60 }} onClick={start} disabled={busy}>
              {existing ? (existing.status === 'finished' ? 'Итог ›' : 'Продолжить') : 'Начать'}
            </button>
          </div>
        </>
      ) : (
        <div className="card col" style={{ alignItems: 'flex-start' }}>
          <b>{planned ? 'В этом дне программы пока нет упражнений' : 'По программе в этот день отдых'}</b>
          <a className="btn small sec" href={program ? `#/program/${program.id}/edit` : '#/program/new'}>{program ? 'Открыть программу' : 'Создать программу'}</a>
        </div>
      )}
    </Screen>
  );
}
