import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../app-context';
import { api } from '../lib/api';
import { mmss, showKg } from '../lib/calc';
import { invalidate, useQuery } from '../lib/query';
import { go, scrollTop } from '../lib/router';
import { enqueue, drained } from '../lib/sync';
import { pushStart, pushStop } from '../lib/push';
import type { Workout } from '../lib/types';
import { ExerciseArt } from '../art';
import { ErrorBox, Sheet, Skeleton } from '../ui';
import { SummaryBody } from './Summary';

type Screen = 'set' | 'rest' | 'left' | 'done';
type LogSet = { w: number; r: number };
interface Snap { screen: Screen; ei: number; si: number; log: LogSet[][]; w: string; r: string; left: number; total: number; skipped: number[] }
interface St extends Snap { step: number; restEndsAt: number | null; hist: Snap[]; menu: boolean; confirm: boolean; startedAt?: number }

const num = (s: string) => Number(String(s).replace(',', '.'));
const show = (v: number) => String(Math.round(v * 100) / 100).replace('.', ',');
const KEY = (id: number) => `podhod-flow-${id}`;

interface Ex { name: string; kind: string | null; muscles: string; rest: number; reps: number; w: (number | null)[]; type: string }

export function WorkoutFlow({ id }: { id: number }) {
  const q = useQuery<{ workout: Workout }>(`/workouts/${id}`);
  const { wide } = useApp();
  const wrap = (child: React.ReactNode) => (
    <div style={{ minHeight: '100dvh', background: wide ? '#2438C9' : undefined, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: wide ? 480 : 640, position: 'relative' }}>{child}</div>
    </div>
  );
  if (q.error) return wrap(<div className="page"><ErrorBox error={q.error} retry={q.reload} /></div>);
  if (!q.data) return wrap(<div className="page"><Skeleton n={4} /></div>);
  if (q.data.workout.status === 'finished') return wrap(<SummaryBody w={q.data.workout} cta={{ text: 'Продолжить', onClick: () => go('week') }} />);
  return wrap(<Flow workout={q.data.workout} />);
}

function Flow({ workout }: { workout: Workout }) {
  const EX: Ex[] = useMemo(() => workout.exercises.map((e) => ({
    name: e.name, kind: e.kind, muscles: e.muscles ?? '', rest: e.rest, type: e.type,
    reps: Math.max(...e.sets.map((s) => s.plannedReps), 0), w: e.sets.map((s) => s.plannedWeight),
  })), [workout]);

  const at = useCallback((ei: number, si: number) => {
    const e = EX[ei];
    const pw = e.w[Math.min(si, e.w.length - 1)];
    return { ei, si, w: pw == null ? '' : show(pw), r: String(e.reps) };
  }, [EX]);

  const initial = useMemo<St>(() => {
    const log: LogSet[][] = workout.exercises.map((e) => e.sets.filter((s) => s.completedAt !== null && s.reps !== null).map((s) => ({ w: s.weight ?? 0, r: s.reps ?? 0 })));
    const skipped = workout.exercises.flatMap((e, i) => (e.skippedAt ? [i] : []));
    try {
      const saved = JSON.parse(localStorage.getItem(KEY(workout.id)) ?? 'null') as St | null;
      // Workout ids get reused after a delete, so the saved state must belong to this very workout.
      if (saved && saved.startedAt === workout.startedAt && saved.screen !== 'done' && saved.log.length === log.length) return { ...saved, log, skipped, menu: false, confirm: false };
    } catch { /* ignore */ }
    let ei = log.findIndex((l, i) => l.length < EX[i].w.length && !skipped.includes(i));
    if (ei < 0) ei = 0;
    return { screen: 'set', ...at(ei, log[ei]?.length ?? 0), log, step: 2.5, left: 0, total: 0, restEndsAt: null, skipped, hist: [], menu: false, confirm: false };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [s, setS] = useState<St>(initial);
  const sRef = useRef(s);
  sRef.current = s;
  const [, tick] = useState(0);
  const completing = useRef(false);

  // persist UI state so a reload in the gym resumes in place
  useEffect(() => {
    if (s.screen === 'done' || completing.current) return;
    try { localStorage.setItem(KEY(workout.id), JSON.stringify({ ...s, menu: false, confirm: false, startedAt: workout.startedAt })); } catch { /* */ }
  }, [s, workout.id, workout.startedAt]);
  useEffect(() => { scrollTop(); }, [s.screen, s.ei]);

  // rest countdown from an end timestamp (setInterval sleeps on a locked phone)
  const left = s.screen === 'rest' && s.restEndsAt ? Math.max(0, Math.ceil((s.restEndsAt - Date.now()) / 1000)) : s.left;
  useEffect(() => {
    if (s.screen !== 'rest') return;
    const t = setInterval(() => tick((x) => x + 1), 250);
    return () => clearInterval(t);
  }, [s.screen]);

  const snap = (st: St): Snap => ({ screen: st.screen, ei: st.ei, si: st.si, log: st.log.map((a) => a.slice()), w: st.w, r: st.r,
    left: st.screen === 'rest' && st.restEndsAt ? Math.max(0, Math.ceil((st.restEndsAt - Date.now()) / 1000)) : st.left, total: st.total, skipped: st.skipped.slice() });
  const goTo = (patch: Partial<St>) => setS((st) => ({ ...st, ...patch, hist: [...st.hist, snap(st)], menu: false, confirm: false }));

  const path = (ei: number) => `/workouts/${workout.id}/exercises/${workout.exercises[ei].position}`;
  const syncDiff = (from: { log: LogSet[][]; skipped: number[] }, to: { log: LogSet[][]; skipped: number[] }) => {
    to.log.forEach((l, ei) => {
      const f = from.log[ei];
      for (let j = l.length; j < f.length; j++) enqueue({ method: 'PUT', path: `${path(ei)}/sets/${j}`, body: { clear: true } });
      for (let j = 0; j < l.length; j++) if (!f[j] || f[j].w !== l[j].w || f[j].r !== l[j].r) enqueue({ method: 'PUT', path: `${path(ei)}/sets/${j}`, body: { weight: l[j].w, reps: l[j].r } });
    });
    EX.forEach((_, i) => {
      const a = from.skipped.includes(i), b = to.skipped.includes(i);
      if (a !== b) enqueue({ method: 'PATCH', path: path(i), body: { skipped: b } });
    });
  };

  const firstOpen = (log: LogSet[][], from: number, skipped: number[]) => {
    for (let k = 0; k < EX.length; k++) {
      const i = (from + k) % EX.length;
      if (log[i].length < EX[i].w.length && !skipped.includes(i)) return i;
    }
    return -1;
  };

  const finish = (log: LogSet[][]) => {
    void pushStop();
    const empty = EX.some((_, i) => log[i].length === 0);
    goTo({ screen: empty ? 'left' : 'done', log, restEndsAt: null });
    if (!empty) complete();
  };

  const complete = () => {
    if (completing.current) return;
    completing.current = true;
    enqueue({ method: 'POST', path: `/workouts/${workout.id}/finish` });
    try { localStorage.removeItem(KEY(workout.id)); } catch { /* */ }
  };

  const e = EX[s.ei];
  const w = num(s.w) || 0, r = Math.max(0, Math.round(num(s.r) || 0));

  const done = () => {
    const log = s.log.map((a) => a.slice());
    log[s.ei][s.si] = { w, r };
    enqueue({ method: 'PUT', path: `${path(s.ei)}/sets/${s.si}`, body: { weight: w, reps: r } });
    const nxt = s.si + 1 < e.w.length ? [s.ei, s.si + 1] : (() => { const n = firstOpen(log, s.ei + 1, s.skipped); return n < 0 ? null : [n, log[n].length]; })();
    if (!nxt) { finish(log); return; }
    if (e.rest <= 0) { goTo({ screen: 'set', log, ...at(nxt[0], nxt[1]) }); return; }
    goTo({ screen: 'rest', log, ...at(nxt[0], nxt[1]), left: e.rest, total: e.rest, restEndsAt: Date.now() + e.rest * 1000 });
    void pushStart(e.rest, true);
  };

  const skipEx = () => {
    const sk = [...s.skipped, s.ei];
    enqueue({ method: 'PATCH', path: path(s.ei), body: { skipped: true } });
    const n = firstOpen(s.log, s.ei + 1, sk);
    if (n < 0) { setS((st) => ({ ...st, skipped: sk })); finish(s.log); return; }
    goTo({ screen: 'set', skipped: sk, ...at(n, s.log[n].length) });
  };

  const back = () => {
    const st = sRef.current;
    if (!st.hist.length) { go('day', workout.date); return; }
    const h = st.hist[st.hist.length - 1];
    syncDiff(st, h);
    if (st.screen === 'rest') void pushStop();
    if (h.screen === 'rest' && h.left > 0) void pushStart(h.left);
    setS({ ...st, ...h, restEndsAt: h.screen === 'rest' ? Date.now() + h.left * 1000 : null, hist: st.hist.slice(0, -1), menu: false, confirm: false });
  };

  const endRest = () => { void pushStop(); goTo({ screen: 'set', restEndsAt: null, left: 0 }); };
  const adjustRest = (d: number) => {
    const st = sRef.current;
    const cur = st.restEndsAt ? Math.max(0, Math.ceil((st.restEndsAt - Date.now()) / 1000)) : 0;
    const nl = Math.max(0, cur + d);
    void pushStart(nl);
    setS({ ...st, restEndsAt: Date.now() + nl * 1000, total: d > 0 ? Math.max(st.total, nl) : st.total });
  };

  const cancel = async () => {
    void pushStop();
    try { localStorage.removeItem(KEY(workout.id)); } catch { /* */ }
    await drained(3000);
    try { await api('DELETE', `/workouts/${workout.id}`); } catch { enqueue({ method: 'DELETE', path: `/workouts/${workout.id}` }); }
    invalidate('/workouts');
    go('week');
  };

  // ---------- render ----------
  if (s.screen === 'done') {
    const view: Workout = {
      ...workout, status: 'finished', finishedAt: Date.now(),
      exercises: workout.exercises.map((x, i) => ({ ...x, sets: x.sets.map((st, j) => {
        const l = s.log[i][j];
        return l ? { ...st, weight: l.w, reps: l.r, completedAt: 1 } : { ...st, weight: null, reps: null, completedAt: null };
      }) })),
    };
    return <SummaryBody w={view} cta={{ text: 'Продолжить', onClick: async () => { await drained(); invalidate('/workouts'); go('week'); } }} />;
  }

  const dots: string[] = [];
  EX.forEach((x, i) => x.w.forEach((_, j) => dots.push(j < s.log[i].length ? '#FFFFFF' : i === s.ei && j === s.si && s.screen === 'set' ? '#A9CBFA' : 'rgba(255,255,255,.3)')));

  const head = (
    <>
      <div className="between">
        <button onClick={back} style={{ fontWeight: 800, minHeight: 44, color: '#fff' }}>‹ Назад</button>
        {s.screen !== 'left' ? <button onClick={() => setS((st) => ({ ...st, menu: true, confirm: false }))} aria-label="Меню тренировки" style={{ width: 44, height: 44, fontSize: 24, color: '#fff' }}>⋯</button> : null}
      </div>
      {s.screen !== 'left' ? <div style={{ display: 'flex', gap: 3 }}>{dots.map((c, i) => <i key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: c }} />)}</div> : null}
    </>
  );

  const blue: React.CSSProperties = { minHeight: '100dvh', background: '#2438C9', color: '#fff', padding: 'calc(12px + var(--safe-top)) 18px calc(22px + var(--safe-bottom))', display: 'flex', flexDirection: 'column', gap: 14 };
  const outlineBtn: React.CSSProperties = { height: 64, borderRadius: 16, border: '2px solid #fff', color: '#fff', fontSize: 22, fontWeight: 800 };
  const inputStyle: React.CSSProperties = { height: 72, borderRadius: 16, border: 0, background: 'rgba(0,0,0,.18)', color: '#fff', textAlign: 'center', fontFamily: 'var(--display)', fontWeight: 800, fontSize: 40, width: '100%', outline: 'none' };

  let body: React.ReactNode;
  if (s.screen === 'set') {
    body = (
      <>
        <div style={{ fontWeight: 700 }}>Упражнение {s.ei + 1} из {EX.length} · подход {s.si + 1} из {e.w.length}</div>
        <div className="row a-in" style={{ background: 'rgba(0,0,0,.16)', borderRadius: 18, padding: 8, gap: 12 }}>
          <ExerciseArt kind={e.kind} name={e.name} size={64} />
          <div className="grow"><div className="display" style={{ fontSize: 18 }}>{e.name}</div><div style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>{e.muscles ? `${e.muscles} · ` : ''}план {e.w.length} × {e.reps}</div></div>
        </div>
        <div className="col" style={{ gap: 8 }}>
          <div className="between">
            <label htmlFor="fw" style={{ fontWeight: 700 }}>{e.type === 'time' ? 'Вес, кг (если есть)' : 'Вес, кг'}</label>
            <div className="row" style={{ gap: 6 }}>
              {[1, 2.5, 5].map((n) => (
                <button key={n} onClick={() => setS((st) => ({ ...st, step: n }))} style={{ height: 32, padding: '0 10px', borderRadius: 16, fontWeight: 800, fontSize: 13, background: s.step === n ? '#fff' : 'rgba(255,255,255,.16)', color: s.step === n ? '#2438C9' : '#fff' }}>шаг {show(n)}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 64px', gap: 10, alignItems: 'center' }}>
            <button style={outlineBtn} aria-label="Уменьшить вес" onClick={() => setS((st) => ({ ...st, w: show(Math.max(0, (num(st.w) || 0) - st.step)) }))}>−</button>
            <input id="fw" inputMode="decimal" style={inputStyle} value={s.w} onChange={(ev) => setS((st) => ({ ...st, w: ev.target.value.replace(/[^\d.,]/g, '') }))} />
            <button style={outlineBtn} aria-label="Увеличить вес" onClick={() => setS((st) => ({ ...st, w: show((num(st.w) || 0) + st.step) }))}>+</button>
          </div>
        </div>
        <div className="col" style={{ gap: 8 }}>
          <label htmlFor="fr" style={{ fontWeight: 700 }}>{e.type === 'time' ? 'Секунды' : 'Повторения'}</label>
          <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 64px', gap: 10, alignItems: 'center' }}>
            <button style={outlineBtn} aria-label="Меньше повторений" onClick={() => setS((st) => ({ ...st, r: String(Math.max(0, (Math.round(num(st.r)) || 0) - 1)) }))}>−</button>
            <input id="fr" inputMode="numeric" style={inputStyle} value={s.r} onChange={(ev) => setS((st) => ({ ...st, r: ev.target.value.replace(/\D/g, '') }))} />
            <button style={outlineBtn} aria-label="Больше повторений" onClick={() => setS((st) => ({ ...st, r: String((Math.round(num(st.r)) || 0) + 1) }))}>+</button>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,.35)' }}>
          {e.w.map((pw, j) => {
            const l = s.log[s.ei][j];
            const v = l ? `${show(l.w)} × ${l.r} ✓` : j === s.si ? `${show(w)} × ${r} · сейчас` : `${pw == null ? '—' : show(pw)} × ${e.reps}`;
            return <div key={j} className="between" style={{ padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.2)', fontWeight: 700, opacity: l || j === s.si ? 1 : 0.55 }}><span>Подход {j + 1}</span><span>{v}</span></div>;
          })}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button onClick={skipEx} aria-label="Пропустить упражнение" className="display" style={{ height: 64, borderRadius: 20, border: '2px solid #fff', color: '#fff', fontSize: 18 }}>Пропустить</button>
          <button onClick={done} className="display" style={{ height: 64, borderRadius: 20, background: '#fff', color: '#12151C', fontSize: 18 }}>Сделал</button>
        </div>
      </>
    );
  } else if (s.screen === 'rest') {
    const deg = s.total ? Math.round((left / s.total) * 360) : 0;
    const ne = EX[s.ei];
    const startedEx = s.log[s.ei].length > 0;
    const pw = ne.w[Math.min(s.si, ne.w.length - 1)];
    body = (
      <>
        <div style={{ fontWeight: 700, fontSize: 17 }}>Отдых</div>
        <div className="a-pulse" role="timer" aria-label={`Осталось ${mmss(left)}`} style={{ alignSelf: 'center', width: 264, height: 264, borderRadius: '50%', background: `conic-gradient(#FFFFFF ${deg}deg, rgba(255,255,255,.22) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .3s' }}>
          <div style={{ width: 228, height: 228, borderRadius: '50%', background: '#2438C9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span className="display num" style={{ fontSize: 64 }}>{mmss(left)}</span>
            <span style={{ fontWeight: 700, fontSize: 16, opacity: 0.85 }}>из {mmss(s.total)}</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button onClick={() => adjustRest(-15)} style={{ height: 54, borderRadius: 14, border: '2px solid #fff', color: '#fff', fontWeight: 800 }}>−15 с</button>
          <button onClick={() => adjustRest(15)} style={{ height: 54, borderRadius: 14, border: '2px solid #fff', color: '#fff', fontWeight: 800 }}>+15 с</button>
        </div>
        <div className="row a-in" style={{ background: 'rgba(0,0,0,.18)', borderRadius: 18, padding: 10, gap: 12 }}>
          <ExerciseArt kind={ne.kind} name={ne.name} size={64} phase="start" />
          <div className="grow">
            <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.85 }}>{startedEx || s.si > 0 ? `Дальше · подход ${s.si + 1} из ${ne.w.length}` : `Дальше · упражнение ${s.ei + 1} из ${EX.length}`}</div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{ne.name}</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{pw == null ? '' : `${showKg(pw)} кг × `}{ne.reps}</div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={endRest} className="display" style={{ height: 72, borderRadius: 20, background: '#fff', color: '#12151C', fontSize: 19 }}>{left > 0 ? 'Пропустить отдых' : 'К подходу'}</button>
      </>
    );
  } else {
    const missing = EX.map((x, i) => ({ x, i })).filter((o) => s.log[o.i].length === 0);
    body = (
      <>
        <h1 className="display" style={{ fontSize: 24 }}>Не все упражнения сделаны</h1>
        {missing.map(({ x, i }) => (
          <button key={i} className="row a-in" onClick={() => {
            enqueue({ method: 'PATCH', path: path(i), body: { skipped: false } });
            goTo({ screen: 'set', skipped: s.skipped.filter((k) => k !== i), ...at(i, 0) });
          }} style={{ background: '#fff', color: '#12151C', borderRadius: 18, padding: 10, gap: 12, textAlign: 'left' }}>
            <ExerciseArt kind={x.kind} name={x.name} size={56} />
            <div className="grow"><b>{x.name}</b><div style={{ color: '#5A6371', fontSize: 13, fontWeight: 700 }}>{x.w.length} × {x.reps}{x.w.some((v) => v != null) ? ` · ${[...new Set(x.w.filter((v) => v != null).map((v) => showKg(v)))].join(' → ')} кг` : ''}</div></div>
            <b style={{ color: '#2438C9' }}>Вернуться ›</b>
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => { complete(); goTo({ screen: 'done' }); }} style={{ height: 64, borderRadius: 20, border: '2px solid #fff', color: '#fff', fontWeight: 800, fontSize: 18 }}>Завершить</button>
      </>
    );
  }

  return (
    <div style={blue}>
      {head}
      {body}
      <Sheet open={s.menu} onClose={() => setS((st) => ({ ...st, menu: false, confirm: false }))} label="Тренировка">
        {!s.confirm ? (
          <>
            <b style={{ fontSize: 18 }}>Тренировка</b>
            <div className="col" style={{ gap: 0 }}>
              <button onClick={() => finish(s.log)} style={{ minHeight: 52, textAlign: 'left', fontWeight: 700, borderBottom: '1px solid var(--line)' }}>Завершить тренировку</button>
              <button onClick={() => setS((st) => ({ ...st, confirm: true }))} style={{ minHeight: 52, textAlign: 'left', fontWeight: 700, color: 'var(--warn)' }}>Отменить тренировку</button>
            </div>
          </>
        ) : (
          <>
            <b style={{ fontSize: 18 }}>Отменить тренировку?</b>
            <div className="col" style={{ gap: 0 }}>
              <button onClick={() => void cancel()} style={{ minHeight: 52, textAlign: 'left', fontWeight: 700, color: 'var(--warn)', borderBottom: '1px solid var(--line)' }}>Да, отменить</button>
              <button onClick={() => setS((st) => ({ ...st, menu: false, confirm: false }))} style={{ minHeight: 52, textAlign: 'left', fontWeight: 700 }}>Нет, продолжить</button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}
