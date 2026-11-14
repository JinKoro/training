import { useEffect, useState } from 'react';
import { useApp } from '../app-context';
import { api } from '../lib/api';
import { activeProgram, exerciseSubtitle, plannedFor, showKg, workoutStats, dayTitle } from '../lib/calc';
import { addDays, dayMonth, diffDays, today, WD_CAP, WD_SHORT, weekStart } from '../lib/dates';
import { invalidate, useQuery } from '../lib/query';
import { go } from '../lib/router';
import type { Workout } from '../lib/types';
import { ExerciseArt } from '../art';
import { ErrorBox, Screen, Sheet, Skeleton, errText, toast } from '../ui';
import { ExercisePicker } from './ExercisePicker';

interface DraftSet { w: string; r: string; plannedWeight: number | null; plannedReps: number }
interface DraftEx { exerciseId: number | null; name: string; kind: string | null; muscles: string | null; type: string; rest: number; sets: DraftSet[] }

const toDraft = (w: Workout): DraftEx[] => w.exercises.map((e) => ({
  exerciseId: e.exerciseId, name: e.name, kind: e.kind, muscles: e.muscles, type: e.type, rest: e.rest,
  sets: e.sets.map((s) => ({ w: s.weight == null ? '' : showKg(s.weight), r: s.reps == null || s.completedAt == null ? '' : String(s.reps), plannedWeight: s.plannedWeight, plannedReps: s.plannedReps })),
}));

const n = (s: string) => Number(String(s).replace(',', '.'));
const shortDate = (d: string) => `${WD_SHORT[diffDays(d, weekStart(d))]}, ${dayMonth(d)}`;

/** Editor body shared by the phone screen (N09) and the desktop list (D04). */
function Editor({ w, onDone, onCancel, wide }: { w: Workout; onDone: () => void; onCancel: () => void; wide?: boolean }) {
  const [ex, setEx] = useState<DraftEx[]>(() => toDraft(w));
  const [pick, setPick] = useState(false);
  const [confirm, setConfirm] = useState<null | { kind: 'workout' } | { kind: 'ex'; i: number }>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setEx(toDraft(w)); setPick(false); }, [w]);

  const bad = (s: DraftSet) => (s.w !== '' && !(n(s.w) >= 0 && n(s.w) <= 1000)) || (s.r !== '' && !/^\d{1,4}$/.test(s.r));
  const invalid = ex.some((e) => e.sets.some(bad)) || !ex.length;
  const upd = (i: number, j: number, k: 'w' | 'r', v: string) => setEx((p) => p.map((e, a) => (a !== i ? e : { ...e, sets: e.sets.map((s, b) => (b !== j ? s : { ...s, [k]: v })) })));

  const save = async () => {
    if (invalid || busy) return;
    setBusy(true);
    try {
      await api('PUT', `/workouts/${w.id}`, {
        exercises: ex.map((e) => ({
          ...e, sets: e.sets.map((s) => ({
            plannedWeight: s.plannedWeight, plannedReps: s.plannedReps,
            weight: s.w === '' ? null : n(s.w), reps: s.r === '' ? null : Number(s.r),
          })),
        })),
      });
      invalidate('/workouts');
      toast('Сохранено');
      onDone();
    } catch (e) { toast(errText(e)); } finally { setBusy(false); }
  };
  const del = async () => {
    try { await api('DELETE', `/workouts/${w.id}`); invalidate('/workouts'); go(wide ? 'workouts' : 'calendar'); } catch (e) { toast(errText(e)); }
  };

  if (pick) {
    return <ExercisePicker subtitle={shortDate(w.date)} existing={ex.map((e) => e.exerciseId ?? 0)} onBack={() => setPick(false)} onPick={(e) => {
      setEx((p) => [...p, { exerciseId: e.id, name: e.name, kind: e.kind, muscles: exerciseSubtitle(e), type: e.type, rest: e.rest, sets: [{ w: '', r: '', plannedWeight: null, plannedReps: 10 }] }]);
      setPick(false);
    }} />;
  }

  const inp: React.CSSProperties = { height: 42, borderRadius: 10, border: '1px solid var(--track)', background: 'var(--bg)', textAlign: 'center', fontWeight: 800, width: '100%', outline: 'none' };
  return (
    <div className="col" style={{ gap: 12 }}>
      {!wide ? (
        <div className="navbar">
          <button className="link" onClick={onCancel}>Отмена</button>
          <b>{shortDate(w.date)}</b>
          <button className="link" onClick={save} disabled={invalid || busy} style={{ color: invalid ? 'var(--muted)' : 'var(--acc)' }}>Сохранить</button>
        </div>
      ) : null}
      {ex.map((e, i) => (
        <div key={i} className="card col a-in" style={{ borderRadius: 18, gap: 8 }}>
          <div className="row">
            <ExerciseArt kind={e.kind} name={e.name} size={44} />
            <b className="grow">{e.name}</b>
            <button aria-label="Удалить упражнение" onClick={() => setConfirm({ kind: 'ex', i })} className="muted" style={{ width: 40, height: 40 }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 32px', gap: 8, alignItems: 'center' }}>
            <span className="sub" style={{ fontSize: 12, fontWeight: 800 }}>№</span><span className="sub" style={{ fontSize: 12, fontWeight: 800 }}>Вес, кг</span><span className="sub" style={{ fontSize: 12, fontWeight: 800 }}>{e.type === 'time' ? 'Секунды' : 'Повторы'}</span><span />
            {e.sets.map((s, j) => (
              <Row4 key={j}>
                <b>{j + 1}</b>
                <input aria-label="Вес" inputMode="decimal" style={{ ...inp, borderColor: s.w !== '' && !(n(s.w) >= 0) ? 'var(--warn)' : 'var(--track)' }} value={s.w} onChange={(ev) => upd(i, j, 'w', ev.target.value)} placeholder={s.plannedWeight == null ? '' : showKg(s.plannedWeight)} />
                <input aria-label="Повторы" inputMode="numeric" style={{ ...inp, borderColor: s.r !== '' && !/^\d+$/.test(s.r) ? 'var(--warn)' : 'var(--track)' }} value={s.r} onChange={(ev) => upd(i, j, 'r', ev.target.value)} placeholder="—" />
                <button aria-label="Удалить подход" className="muted" style={{ height: 40 }} onClick={() => setEx((p) => p.map((x, a) => (a !== i ? x : { ...x, sets: x.sets.filter((_, b) => b !== j) })))}>✕</button>
              </Row4>
            ))}
          </div>
          <button className="btn ghost" style={{ height: 44, borderRadius: 12, fontSize: 15 }} onClick={() => setEx((p) => p.map((x, a) => {
            if (a !== i) return x;
            const last = x.sets[x.sets.length - 1];
            return { ...x, sets: [...x.sets, { w: last?.w ?? '', r: '', plannedWeight: last?.plannedWeight ?? null, plannedReps: last?.plannedReps ?? 10 }] };
          }))}>+ Подход</button>
        </div>
      ))}
      <button className="btn ghost" style={{ height: 52, borderRadius: 14 }} onClick={() => setPick(true)}>+ Упражнение</button>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn danger" style={{ height: 48, borderRadius: 14, fontSize: 15 }} onClick={() => setConfirm({ kind: 'workout' })}>Удалить тренировку</button>
        <span className="grow" />
        {wide ? <button className="btn small" onClick={save} disabled={invalid || busy}>Сохранить</button> : null}
      </div>
      <Sheet open={!!confirm} onClose={() => setConfirm(null)} label="Подтверждение">
        <b className="display" style={{ fontSize: 20 }}>{confirm?.kind === 'workout' ? 'Удалить тренировку?' : `Убрать «${confirm?.kind === 'ex' ? ex[confirm.i]?.name : ''}»?`}</b>
        <button className="btn" style={{ background: 'var(--warn)', color: '#fff' }} onClick={() => {
          if (confirm?.kind === 'workout') void del();
          else if (confirm?.kind === 'ex') setEx((p) => p.filter((_, a) => a !== confirm.i));
          setConfirm(null);
        }}>Удалить</button>
        <button className="btn outline" onClick={() => setConfirm(null)}>Отмена</button>
      </Sheet>
    </div>
  );
}

const Row4 = ({ children }: { children: React.ReactNode }) => <>{children}</>;

export function WorkoutEditScreen({ id, back }: { id: number; back?: string }) {
  const { wide } = useApp();
  const q = useQuery<{ workout: Workout }>(`/workouts/${id}`);
  useEffect(() => { if (wide) go('workouts', id); }, [wide, id]);
  if (wide) return null;
  if (q.error) return <Screen className="modal"><ErrorBox error={q.error} retry={q.reload} /></Screen>;
  if (!q.data) return <Screen className="modal"><Skeleton n={3} /></Screen>;
  // Saving or cancelling returns to the workout's summary (which keeps where it was opened from).
  const backTo = () => (back ? go('summary', id, back) : go('summary', id));
  return <Screen className="modal"><Editor w={q.data.workout} onDone={backTo} onCancel={backTo} /></Screen>;
}

/** Desktop «Тренировки»: list of workouts on the left, the selected one on the right (edit, or start today's). */
export function WorkoutsScreen({ selected }: { selected: number | null }) {
  const { programs, exById } = useApp();
  const t = today();
  const q = useQuery<{ workouts: Workout[] }>(`/workouts?from=${addDays(t, -120)}&to=${t}`);
  const program = activeProgram(programs);
  const planned = plannedFor(program, t);
  if (q.error) return <Screen title="Тренировки"><ErrorBox error={q.error} retry={q.reload} /></Screen>;
  if (!q.data) return <Screen title="Тренировки"><Skeleton n={4} /></Screen>;
  const list = q.data.workouts;
  const todayW = list.find((w) => w.date === t);
  const sel = list.find((w) => w.id === selected) ?? null;
  const todayTitle = planned ? dayTitle(planned.rows, exById, WD_CAP[diffDays(t, weekStart(t))]) : null;
  return (
    <Screen title="Тренировки">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        <aside className="col" style={{ flex: '1 1 260px', minWidth: 0, gap: 8, maxWidth: 360 }}>
          {planned && !todayW ? (
            <a href="#/workouts" className="a-in" style={{ borderRadius: 14, padding: '12px 14px', background: sel ? 'var(--card)' : '#2438C9', color: sel ? 'var(--ink)' : '#fff' }}>
              <b>{shortDate(t)}</b><div style={{ fontSize: 14, opacity: 0.85 }}>Сегодня · {todayTitle}</div>
            </a>
          ) : null}
          {list.map((w) => {
            const on = sel?.id === w.id;
            return (
              <a key={w.id} href={`#/workouts/${w.id}`} className="a-in" style={{ borderRadius: 14, padding: '12px 14px', background: on ? '#2438C9' : 'var(--card)', color: on ? '#fff' : 'var(--ink)' }}>
                <b>{shortDate(w.date)}</b>
                <div style={{ fontSize: 14, opacity: 0.85 }}>{w.title} · {w.status === 'finished' ? `${workoutStats(w).pct}%` : 'идёт'}</div>
              </a>
            );
          })}
          {!list.length && !planned ? <div className="empty">Здесь появятся тренировки</div> : null}
        </aside>
        <section className="col" style={{ flex: '3 1 560px', minWidth: 0, gap: 14 }}>
          {sel ? (
            <>
              <div className="between" style={{ flexWrap: 'wrap' }}>
                <div><div className="muted" style={{ fontWeight: 700 }}>{WD_CAP[diffDays(sel.date, weekStart(sel.date))]}, {dayMonth(sel.date)}</div><h2 className="display" style={{ fontSize: 26 }}>{sel.title}</h2></div>
                <a className="btn small sec" href={sel.status === 'finished' ? `#/summary/${sel.id}/workouts` : `#/workout/${sel.id}`}>{sel.status === 'finished' ? 'Итог ›' : 'Продолжить'}</a>
              </div>
              <Editor w={sel} wide onDone={() => {}} onCancel={() => {}} />
            </>
          ) : planned && !todayW ? (
            <>
              <div className="between" style={{ flexWrap: 'wrap' }}>
                <div><div className="muted" style={{ fontWeight: 700 }}>{WD_CAP[diffDays(t, weekStart(t))]}, {dayMonth(t)} · по программе</div><h2 className="display" style={{ fontSize: 26 }}>{todayTitle}</h2></div>
                <a className="btn small blue" href={`#/day/${t}`}>Начать тренировку</a>
              </div>
              {planned.rows.map((r, i) => {
                const e = exById.get(r.exerciseId);
                return (
                  <div key={i} className="card row a-in" style={{ borderRadius: 18 }}>
                    <ExerciseArt kind={e?.kind} name={e?.name} size={72} />
                    <div className="grow"><b style={{ fontSize: 17 }}>{e?.name}</b><div className="muted">{r.sets}×{r.reps}{r.kg ? ` · ${r.kg} кг` : ''}</div></div>
                  </div>
                );
              })}
            </>
          ) : <div className="empty">Выберите тренировку слева</div>}
        </section>
      </div>
    </Screen>
  );
}
