import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../app-context';
import { api } from '../lib/api';
import { mmss, showKg, schemeText, durText } from '../lib/calc';
import { invalidate, useQuery, forget } from '../lib/query';
import { go, scrollTop } from '../lib/router';
import { enqueue, drained } from '../lib/sync';
import { pushStart, pushStop, remindStart, remindStop } from '../lib/push';
import type { Workout } from '../lib/types';
import { ExerciseArt } from '../art';
import { ErrorBox, Sheet, Skeleton } from '../ui';
import { SummaryBody } from './Summary';
import { ExerciseInfo } from './Exercises';

/** 'edit' = a set already done, reopened with «‹ Назад»: only its weight and reps change, it stays done. */
type Screen = 'set' | 'rest' | 'left' | 'done' | 'edit';
type LogSet = { w: number; r: number };
interface Snap { screen: Screen; ei: number; si: number; log: LogSet[][]; w: string; r: string; left: number; total: number; skipped: number[] }
interface St extends Snap {
  step: number; restEndsAt: number | null; hist: Snap[]; menu: boolean; confirm: boolean; startedAt?: number;
  /** Rest changed with −15/+15 during this workout, per exercise index: used for the rest of that exercise's sets. */
  restFor?: Record<number, number>; restOf?: number;
  /** Where «Сохранить» of an edited done set returns to. */
  ret?: { screen: Screen; ei: number; si: number; w: string; r: string } | null;
  /** Sheet over the workout: the day's plan, or one exercise's info (infoBack = opened from the plan). */
  sheet?: 'plan' | 'info' | null; infoEi?: number; infoBack?: boolean;
  /** Timer of a timed exercise's set (warmup, plank…): which set it belongs to («ei-si»), seconds counted before, start of the running stretch. */
  tKey?: string; tAcc?: number; tRun?: number | null;
}

/** No action in the workout for this long → «Не забудьте про тренировку» (rest time is not counted). */
const REMIND_AFTER = 15 * 60;

const num = (s: string) => Number(String(s).replace(',', '.'));
const show = (v: number) => String(Math.round(v * 100) / 100).replace('.', ',');
const KEY = (id: number) => `podhod-flow-${id}`;

interface Ex { name: string; kind: string | null; muscles: string; rest: number; reps: number; w: (number | null)[]; type: string }

export function WorkoutFlow({ id }: { id: number }) {
  const q = useQuery<{ workout: Workout }>(`/workouts/${id}`);
  const { wide } = useApp();
  const wrap = (child: React.ReactNode) => (
    <div style={{ minHeight: '100dvh', background: wide ? 'var(--hero)' : undefined, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: wide ? 480 : 640, position: 'relative' }}>{child}</div>
    </div>
  );
  if (q.error) return wrap(<div className="page"><ErrorBox error={q.error} retry={q.reload} /></div>);
  if (!q.data) return wrap(<div className="page"><Skeleton n={4} /></div>);
  if (q.data.workout.status === 'finished') return wrap(<SummaryBody w={q.data.workout} cta={{ text: 'Продолжить', onClick: () => go('week') }} />);
  return wrap(<Flow workout={q.data.workout} />);
}

function Flow({ workout }: { workout: Workout }) {
  const { exById } = useApp();
  const EX: Ex[] = useMemo(() => workout.exercises.map((e) => ({
    name: e.name, kind: e.kind, muscles: e.muscles ?? '', rest: e.rest, type: e.type,
    reps: Math.max(...e.sets.map((s) => s.plannedReps), 0), w: e.sets.map((s) => s.plannedWeight),
  })), [workout]);

  /** Next set's fields. No planned weight (calibration): the weight of this exercise's last done set carries over. */
  const at = useCallback((ei: number, si: number, log?: LogSet[][]) => {
    const e = EX[ei];
    const pw = e.w[Math.min(si, e.w.length - 1)];
    const last = log?.[ei]?.[log[ei].length - 1];
    return { ei, si, w: pw != null ? show(pw) : last && last.w > 0 ? show(last.w) : '', r: String(e.reps) };
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
    return { screen: 'set', ...at(ei, log[ei]?.length ?? 0, log), log, step: 2.5, left: 0, total: 0, restEndsAt: null, skipped, hist: [], menu: false, confirm: false };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [s, setS] = useState<St>(initial);
  const sRef = useRef(s);
  sRef.current = s;
  const [, tick] = useState(0);
  const completing = useRef(false);

  // persist UI state so a reload in the gym resumes in place
  useEffect(() => {
    if (s.screen === 'done' || completing.current) return;
    try { localStorage.setItem(KEY(workout.id), JSON.stringify({ ...s, menu: false, confirm: false, sheet: null, startedAt: workout.startedAt })); } catch { /* */ }
  }, [s, workout.id, workout.startedAt]);
  useEffect(() => { scrollTop(); }, [s.screen, s.ei]);

  // rest countdown from an end timestamp (setInterval sleeps on a locked phone)
  const left = s.screen === 'rest' && s.restEndsAt ? Math.max(0, Math.ceil((s.restEndsAt - Date.now()) / 1000)) : s.left;
  useEffect(() => {
    if (s.screen !== 'rest') return;
    const t = setInterval(() => tick((x) => x + 1), 250);
    return () => clearInterval(t);
  }, [s.screen]);

  // Rest over: the next set opens by itself (no «К подходу» step).
  useEffect(() => {
    if (s.screen === 'rest' && s.restEndsAt && left === 0) {
      setS((st) => (st.screen === 'rest' ? { ...st, screen: 'set', restEndsAt: null, left: 0, hist: [...st.hist, snap(st)] } : st));
    }
  }, [s.screen, s.restEndsAt, left]); // eslint-disable-line react-hooks/exhaustive-deps

  // Every action moves the idle reminder: 15 minutes after it, plus whatever rest is still running.
  useEffect(() => {
    if (s.screen === 'done' || s.screen === 'left') return;
    const t = setTimeout(() => {
      const st = sRef.current;
      const x = EX[st.ei];
      const restLeft = st.restEndsAt ? Math.max(0, (st.restEndsAt - Date.now()) / 1000) : 0;
      const pw = x.w[Math.min(st.si, x.w.length - 1)];
      const text = `Дальше: ${x.name}, подход ${st.si + 1} из ${x.w.length}${pw != null ? ` · ${showKg(pw)} кг × ${x.reps}` : ''}`;
      void remindStart(restLeft + REMIND_AFTER, text, `./#/workout/${workout.id}`);
    }, 1500);
    return () => clearTimeout(t);
  }, [s.screen, s.ei, s.si, s.log, s.skipped, s.restEndsAt]); // eslint-disable-line react-hooks/exhaustive-deps

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
    void remindStop();
    // anything not fully done (skipped, or some sets left) is offered before the summary
    const empty = EX.some((x, i) => log[i].length < x.w.length);
    goTo({ screen: empty ? 'left' : 'done', log, restEndsAt: null });
    if (!empty) complete();
  };

  const complete = () => {
    if (completing.current) return;
    completing.current = true;
    enqueue({ method: 'POST', path: `/workouts/${workout.id}/finish` });
    try { localStorage.removeItem(KEY(workout.id)); } catch { /* */ }
    // Finishing calibrates the program's later weights on the server: refetch it once the queue has gone through.
    if (workout.programId) void drained().then(() => invalidate('/programs'));
  };

  const e = EX[s.ei];
  const w = num(s.w) || 0, r = Math.max(0, Math.round(num(s.r) || 0));

  // A timed exercise (warmup, plank, run…) counts down its planned seconds; the time it ran is what gets written.
  const timed = e.type === 'time' && s.screen === 'set';
  const tKey = `${s.ei}-${s.si}`;
  const tPlan = e.reps > 0 ? e.reps : 60;
  const tMine = s.tKey === tKey;
  const tRunning = tMine && !!s.tRun;
  const tElapsed = tMine ? (s.tAcc ?? 0) + (s.tRun ? (Date.now() - s.tRun) / 1000 : 0) : 0;
  const tLeft = Math.max(0, tPlan - tElapsed);
  useEffect(() => {
    if (!tRunning) return;
    const t = setInterval(() => tick((x) => x + 1), 250);
    return () => clearInterval(t);
  }, [tRunning]);
  const tStart = () => setS((st) => ({ ...st, tKey, tAcc: st.tKey === tKey ? st.tAcc ?? 0 : 0, tRun: Date.now() }));
  const tPause = () => setS((st) => ({ ...st, tAcc: (st.tAcc ?? 0) + (st.tRun ? (Date.now() - st.tRun) / 1000 : 0), tRun: null }));
  const tDone = () => { const sec = Math.max(1, Math.round(Math.min(tElapsed, tPlan) || tPlan)); setS((st) => ({ ...st, tRun: null, tAcc: 0, tKey: undefined })); done(sec); };
  // time is up: the set is written with the planned time and the workout moves on by itself
  useEffect(() => {
    if (tRunning && tLeft <= 0) tDone();
  }); // eslint-disable-line react-hooks/exhaustive-deps

  /** `reps`: the seconds a timed set ran (its timer), instead of the field. */
  const done = (reps?: number) => {
    const r1 = reps ?? r;
    const log = s.log.map((a) => a.slice());
    log[s.ei][s.si] = { w, r: r1 };
    enqueue({ method: 'PUT', path: `${path(s.ei)}/sets/${s.si}`, body: { weight: w, reps: r1 } });
    const nxt = s.si + 1 < e.w.length ? [s.ei, s.si + 1] : (() => { const n = firstOpen(log, s.ei + 1, s.skipped); return n < 0 ? null : [n, log[n].length]; })();
    if (!nxt) { finish(log); return; }
    const rest = s.restFor?.[s.ei] ?? e.rest;
    if (rest <= 0) { goTo({ screen: 'set', log, ...at(nxt[0], nxt[1], log) }); return; }
    goTo({ screen: 'rest', log, ...at(nxt[0], nxt[1], log), left: rest, total: rest, restEndsAt: Date.now() + rest * 1000, restOf: s.ei });
    void pushStart(rest, true);
  };

  const skipEx = () => {
    const sk = [...s.skipped, s.ei];
    enqueue({ method: 'PATCH', path: path(s.ei), body: { skipped: true } });
    const n = firstOpen(s.log, s.ei + 1, sk);
    if (n < 0) { setS((st) => ({ ...st, skipped: sk })); finish(s.log); return; }
    goTo({ screen: 'set', skipped: sk, ...at(n, s.log[n].length, s.log) });
  };

  /** The done set right before (ei, si) in program order. */
  const prevDone = (log: LogSet[][], ei: number, si: number): [number, number] | null => {
    let best: [number, number] | null = null;
    log.forEach((a, i) => a.forEach((_, j) => { if (i < ei || (i === ei && j < si)) best = [i, j]; }));
    return best;
  };

  const back = () => {
    const st = sRef.current;
    // «‹ Назад» steps back through the program order (never the rest screens). The exercise before, if it was skipped or
    // has sets left, opens at its first undone set to be done now (a skip is undone); a done set opens to edit its numbers.
    if (st.screen === 'set' || st.screen === 'edit') {
      const pi = st.si > 0 ? -1 : st.ei - 1;
      if (pi >= 0 && st.log[pi].length < EX[pi].w.length) {
        const skipped = st.skipped.filter((k) => k !== pi);
        if (skipped.length !== st.skipped.length) enqueue({ method: 'PATCH', path: path(pi), body: { skipped: false } });
        setS({ ...st, ...at(pi, st.log[pi].length, st.log), screen: 'set', skipped, ret: null, menu: false, confirm: false, sheet: null });
        return;
      }
    }
    if (st.screen === 'set' || st.screen === 'rest' || st.screen === 'edit') {
      const p = prevDone(st.log, st.ei, st.si);
      if (p) {
        const v = st.log[p[0]][p[1]];
        const ret = st.screen === 'edit' && st.ret ? st.ret : { screen: st.screen, ei: st.ei, si: st.si, w: st.w, r: st.r };
        setS({ ...st, screen: 'edit', ei: p[0], si: p[1], w: show(v.w), r: String(v.r), ret, menu: false, confirm: false, sheet: null });
        return;
      }
      if (st.screen === 'edit') return;
    }
    if (!st.hist.length) { go('day', workout.date); return; }
    const h = st.hist[st.hist.length - 1];
    syncDiff(st, h);
    if (st.screen === 'rest') void pushStop();
    if (h.screen === 'rest' && h.left > 0) void pushStart(h.left);
    setS({ ...st, ...h, restEndsAt: h.screen === 'rest' ? Date.now() + h.left * 1000 : null, hist: st.hist.slice(0, -1), menu: false, confirm: false });
  };

  const saveEdit = () => {
    const st = sRef.current;
    const R = st.ret;
    const log = st.log.map((a) => a.slice());
    log[st.ei][st.si] = { w, r };
    enqueue({ method: 'PUT', path: `${path(st.ei)}/sets/${st.si}`, body: { weight: w, reps: r } });
    if (!R) { setS({ ...st, log, screen: 'set', ...at(st.ei, Math.min(st.si + 1, EX[st.ei].w.length - 1), log) }); return; }
    // The rest kept running while the set was edited: if it is over, straight to the next set.
    const restOver = R.screen === 'rest' && (!st.restEndsAt || st.restEndsAt <= Date.now());
    setS({ ...st, log, screen: restOver ? 'set' : R.screen, ei: R.ei, si: R.si, w: R.w, r: R.r, ret: null, restEndsAt: restOver ? null : st.restEndsAt });
  };

  const endRest = () => { void pushStop(); goTo({ screen: 'set', restEndsAt: null, left: 0 }); };
  const adjustRest = (d: number) => {
    const st = sRef.current;
    const cur = st.restEndsAt ? Math.max(0, Math.ceil((st.restEndsAt - Date.now()) / 1000)) : 0;
    const nl = Math.max(0, cur + d);
    void pushStart(nl);
    // The new length also becomes this exercise's rest for its next sets (this workout only).
    const ri = st.restOf ?? st.ei;
    const restFor = { ...st.restFor, [ri]: Math.max(0, Math.min(600, (st.restFor?.[ri] ?? EX[ri].rest) + d)) };
    setS({ ...st, restEndsAt: Date.now() + nl * 1000, total: d > 0 ? Math.max(st.total, nl) : st.total, restFor });
  };

  const cancel = async () => {
    void pushStop();
    void remindStop();
    try { localStorage.removeItem(KEY(workout.id)); } catch { /* */ }
    await drained(3000);
    try { await api('DELETE', `/workouts/${workout.id}`); } catch { enqueue({ method: 'DELETE', path: `/workouts/${workout.id}` }); }
    forget(`/workouts/${workout.id}`);
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
    return <SummaryBody w={view} cta={{ text: 'Продолжить', onClick: async () => { await drained(); await Promise.all([invalidate('/workouts'), invalidate('/programs')]); go('week'); } }} />;
  }

  const dots: string[] = [];
  EX.forEach((x, i) => x.w.forEach((_, j) => dots.push(j < s.log[i].length ? '#FFFFFF' : i === s.ei && j === s.si && (s.screen === 'set' || s.screen === 'edit') ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.3)')));

  const head = (
    <>
      <div className="between">
        <button onClick={back} style={{ fontWeight: 800, minHeight: 44, color: '#fff' }}>‹ Назад</button>
        {s.screen !== 'left' ? (
          <div className="row" style={{ gap: 2 }}>
            {/* out to the app; the workout keeps going and the bar «Тренировка идёт» brings it back */}
            <button onClick={() => go('week')} aria-label="Свернуть тренировку" title="Свернуть" style={{ width: 44, height: 44, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            <button onClick={() => setS((st) => ({ ...st, menu: true, confirm: false, sheet: null }))} aria-label="Меню тренировки" style={{ width: 44, height: 44, fontSize: 24, color: '#fff' }}>⋯</button>
          </div>
        ) : null}
      </div>
      {s.screen !== 'left' ? <div style={{ display: 'flex', gap: 3 }}>{dots.map((c, i) => <i key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: c }} />)}</div> : null}
    </>
  );

  const blue: React.CSSProperties = { minHeight: '100dvh', background: 'var(--hero)', color: '#fff', padding: 'calc(12px + var(--safe-top)) 18px calc(22px + var(--safe-bottom))', display: 'flex', flexDirection: 'column', gap: 14 };
  const outlineBtn: React.CSSProperties = { height: 64, borderRadius: 20, border: '2px solid #fff', color: '#fff', fontSize: 22, fontWeight: 800 };
  const inputStyle: React.CSSProperties = { height: 72, borderRadius: 20, border: 0, background: 'rgba(0,0,0,.18)', color: '#fff', textAlign: 'center', fontFamily: 'var(--display)', fontWeight: 800, fontSize: 40, width: '100%', outline: 'none' };

  // Program exercise without a planned weight, before its first done set: this workout calibrates it.
  const calib = !!workout.programId && e.type !== 'time' && e.w.every((x) => x == null) && s.log[s.ei].length === 0;
  let body: React.ReactNode;
  const editing = s.screen === 'edit';
  const openInfo = (i: number, fromPlan = false) => setS((st) => ({ ...st, sheet: 'info', infoEi: i, infoBack: fromPlan, menu: false }));
  if (timed) {
    const deg = Math.round(Math.min(1, tElapsed / tPlan) * 360);
    const big: React.CSSProperties = { height: 64, borderRadius: 22, fontSize: 18 };
    const outline: React.CSSProperties = { ...big, border: '2px solid #fff', color: '#fff' };
    const white: React.CSSProperties = { ...big, background: '#fff', color: '#1A1A1A' };
    body = (
      <>
        <div style={{ fontWeight: 700 }}>Упражнение {s.ei + 1} из {EX.length}{e.w.length > 1 ? ` · подход ${s.si + 1} из ${e.w.length}` : ''}</div>
        <button className="row a-in" onClick={() => openInfo(s.ei)} aria-label={`Об упражнении: ${e.name}`} style={{ width: '100%', background: 'rgba(0,0,0,.16)', borderRadius: 22, padding: '8px 14px 8px 8px', gap: 12, color: '#fff', textAlign: 'left' }}>
          <ExerciseArt kind={e.kind} name={e.name} size={64} />
          <div className="grow"><div className="display" style={{ fontSize: 18 }}>{e.name}</div><div style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>{e.muscles ? `${e.muscles} · ` : ''}план {schemeText({ sets: e.w.length, reps: String(e.reps) }, e.type)}</div></div>
          <span aria-hidden="true" style={{ fontWeight: 800, fontSize: 22 }}>›</span>
        </button>
        <div className={tRunning ? 'a-pulse' : undefined} role="timer" aria-label={`Осталось ${mmss(tLeft)}`} style={{ alignSelf: 'center', width: 264, height: 264, borderRadius: '50%', background: `conic-gradient(#FFFFFF ${deg}deg, rgba(255,255,255,.22) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .3s' }}>
          <div style={{ width: 228, height: 228, borderRadius: '50%', background: 'var(--hero)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <span className="display num" style={{ fontSize: 64, lineHeight: 1 }}>{mmss(Math.ceil(tLeft))}</span>
            <span style={{ fontWeight: 700, fontSize: 16, opacity: 0.85 }}>{tRunning ? 'идёт' : tElapsed > 0 ? 'пауза' : `из ${durText(tPlan)}`}</span>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {tRunning ? (
            <><button className="display" style={outline} onClick={tPause}>Пауза</button><button className="display" style={white} onClick={tDone}>Готово</button></>
          ) : tElapsed > 0 ? (
            <><button className="display" style={outline} onClick={tDone}>Готово</button><button className="display" style={white} onClick={tStart}>Продолжить</button></>
          ) : (
            <><button className="display" style={outline} onClick={skipEx} aria-label="Пропустить упражнение">Пропустить</button><button className="display" style={white} onClick={tStart}>Старт</button></>
          )}
        </div>
      </>
    );
  } else if (s.screen === 'set' || editing) {
    body = (
      <>
        <div className="row" style={{ gap: 8, minWidth: 0 }}>
          <span className="grow ell" style={{ fontWeight: 700 }}>Упражнение {s.ei + 1} из {EX.length} · подход {s.si + 1} из {e.w.length}</span>
          {editing ? <span style={{ flex: 'none', background: '#fff', color: '#C2410C', borderRadius: 10, padding: '3px 8px', fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap' }}>✓ сделан</span> : null}
        </div>
        <button className="row a-in" onClick={() => openInfo(s.ei)} aria-label={`Об упражнении: ${e.name}`} style={{ width: '100%', background: 'rgba(0,0,0,.16)', borderRadius: 22, padding: '8px 14px 8px 8px', gap: 12, color: '#fff', textAlign: 'left' }}>
          <ExerciseArt kind={e.kind} name={e.name} size={64} />
          <div className="grow"><div className="display" style={{ fontSize: 18 }}>{e.name}</div><div style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>{e.muscles ? `${e.muscles} · ` : ''}план {schemeText({ sets: e.w.length, reps: String(e.reps) }, e.type)}</div></div>
          <span aria-hidden="true" style={{ fontWeight: 800, fontSize: 22 }}>›</span>
        </button>
        <div className="col" style={{ gap: 8 }}>
          <div className="between">
            <label htmlFor="fw" style={{ fontWeight: 700 }}>{e.type === 'time' ? 'Вес, кг (если есть)' : 'Вес, кг'}</label>
            <div className="row" style={{ gap: 6 }}>
              {[1, 2.5, 5].map((n) => (
                <button key={n} onClick={() => setS((st) => ({ ...st, step: n }))} style={{ height: 32, padding: '0 10px', borderRadius: 16, fontWeight: 800, fontSize: 13, background: s.step === n ? '#fff' : 'rgba(255,255,255,.16)', color: s.step === n ? 'var(--hero)' : '#fff' }}>шаг {show(n)}</button>
              ))}
            </div>
          </div>
          {calib ? <div style={{ fontSize: 14, fontWeight: 700, opacity: 0.9 }}>Калибровка: подберите вес, с которым сделаете {e.reps} повторов. Дальше программа поставит его сама.</div> : null}
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
            const v = editing && j === s.si ? `${show(w)} × ${r} · правка` : l ? `${show(l.w)} × ${l.r} ✓` : j === s.si ? `${show(w)} × ${r} · сейчас` : `${pw == null ? '—' : show(pw)} × ${e.reps}`;
            return <div key={j} className="between" style={{ padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.2)', fontWeight: 700, opacity: l || j === s.si ? 1 : 0.55 }}><span>Подход {j + 1}</span><span>{v}</span></div>;
          })}
        </div>
        <div style={{ flex: 1 }} />
        {editing ? (
          <button onClick={saveEdit} className="display" style={{ height: 64, borderRadius: 22, background: '#fff', color: '#1A1A1A', fontSize: 19 }}>Сохранить</button>
        ) : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button onClick={skipEx} aria-label="Пропустить упражнение" className="display" style={{ height: 64, borderRadius: 22, border: '2px solid #fff', color: '#fff', fontSize: 18 }}>Пропустить</button>
          <button onClick={() => done()} className="display" style={{ height: 64, borderRadius: 22, background: '#fff', color: '#1A1A1A', fontSize: 18 }}>Сделал</button>
        </div>}
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
          <div style={{ width: 228, height: 228, borderRadius: '50%', background: 'var(--hero)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span className="display num" style={{ fontSize: 64 }}>{mmss(left)}</span>
            <span style={{ fontWeight: 700, fontSize: 16, opacity: 0.85 }}>из {mmss(s.total)}</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button onClick={() => adjustRest(-15)} style={{ height: 54, borderRadius: 18, border: '2px solid #fff', color: '#fff', fontWeight: 800 }}>−15 с</button>
          <button onClick={() => adjustRest(15)} style={{ height: 54, borderRadius: 18, border: '2px solid #fff', color: '#fff', fontWeight: 800 }}>+15 с</button>
        </div>
        <button className="row a-in" onClick={() => openInfo(s.ei)} aria-label={`Об упражнении: ${ne.name}`} style={{ width: '100%', background: 'rgba(0,0,0,.18)', borderRadius: 22, padding: '10px 14px 10px 10px', gap: 12, color: '#fff', textAlign: 'left' }}>
          <ExerciseArt kind={ne.kind} name={ne.name} size={64} phase="start" />
          <div className="grow">
            <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.85 }}>{startedEx || s.si > 0 ? `Дальше · подход ${s.si + 1} из ${ne.w.length}` : `Дальше · упражнение ${s.ei + 1} из ${EX.length}`}</div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{ne.name}</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{pw == null ? '' : `${showKg(pw)} кг × `}{ne.reps}</div>
          </div>
          <span aria-hidden="true" style={{ fontWeight: 800, fontSize: 22 }}>›</span>
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={endRest} className="display" style={{ height: 72, borderRadius: 22, background: '#fff', color: '#1A1A1A', fontSize: 19 }}>Пропустить отдых</button>
      </>
    );
  } else {
    const missing = EX.map((x, i) => ({ x, i })).filter((o) => s.log[o.i].length < o.x.w.length);
    body = (
      <>
        <h1 className="display" style={{ fontSize: 24 }}>Не все упражнения сделаны</h1>
        {missing.map(({ x, i }) => (
          <button key={i} className="row a-in" onClick={() => {
            enqueue({ method: 'PATCH', path: path(i), body: { skipped: false } });
            goTo({ screen: 'set', skipped: s.skipped.filter((k) => k !== i), ...at(i, s.log[i].length, s.log) });
          }} style={{ background: '#fff', color: '#1A1A1A', borderRadius: 22, padding: 10, gap: 12, textAlign: 'left' }}>
            <ExerciseArt kind={x.kind} name={x.name} size={56} />
            <div className="grow"><b>{x.name}</b><div style={{ color: '#6E6A64', fontSize: 13, fontWeight: 700 }}>{s.log[i].length ? `сделано ${s.log[i].length} из ${x.w.length}` : <>{schemeText({ sets: x.w.length, reps: String(x.reps) }, x.type)}{x.w.some((v) => v != null) ? ` · ${[...new Set(x.w.filter((v) => v != null).map((v) => showKg(v)))].join(' → ')} кг` : ''}</>}</div></div>
            <b style={{ color: 'var(--hero)' }}>Вернуться ›</b>
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => { complete(); goTo({ screen: 'done' }); }} style={{ height: 64, borderRadius: 22, border: '2px solid #fff', color: '#fff', fontWeight: 800, fontSize: 18 }}>Завершить</button>
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
              <button onClick={() => setS((st) => ({ ...st, menu: false, sheet: 'plan' }))} style={{ minHeight: 52, textAlign: 'left', fontWeight: 700, borderBottom: '1px solid var(--line)' }}>План тренировки</button>
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
      {/* The day's plan: view only, the workout keeps its program order. */}
      <Sheet open={s.sheet === 'plan'} onClose={() => setS((st) => ({ ...st, sheet: null }))} label="План тренировки">
        <b style={{ fontSize: 18 }}>План тренировки</b>
        <div className="col" style={{ gap: 0 }}>
          {EX.map((x, i) => {
            const d = s.log[i].length, cur = i === s.ei && (s.screen === 'set' || s.screen === 'rest'), sk = s.skipped.includes(i);
            const st = d >= x.w.length ? `✓ ${d} из ${x.w.length}` : cur ? 'сейчас' : sk ? 'пропущено' : `${d} из ${x.w.length}`;
            const col = d >= x.w.length ? 'var(--goodT)' : cur ? 'var(--acc)' : 'var(--muted)';
            const kg = [...new Set(x.w.filter((v) => v != null).map((v) => showKg(v)))];
            return (
              <button key={i} className="row" onClick={() => openInfo(i, true)} style={{ minHeight: 68, padding: '8px 0', gap: 12, textAlign: 'left', borderTop: i ? '1px solid var(--line)' : 0 }}>
                <ExerciseArt kind={x.kind} name={x.name} size={48} />
                <span className="grow col" style={{ gap: 2, minWidth: 0 }}><b style={{ lineHeight: 1.25 }}>{i + 1}. {x.name}</b><span className="sub" style={{ fontSize: 13 }}>{schemeText({ sets: x.w.length, reps: String(x.reps) }, x.type)}{kg.length ? ` · ${kg.join(' → ')} кг` : ''}</span></span>
                <b style={{ flex: 'none', fontSize: 14, color: col }}>{st}</b>
                <span className="muted" aria-hidden="true" style={{ fontWeight: 800 }}>›</span>
              </button>
            );
          })}
        </div>
      </Sheet>
      <Sheet open={s.sheet === 'info'} onClose={() => setS((st) => ({ ...st, sheet: null }))} label={EX[s.infoEi ?? 0]?.name ?? 'Упражнение'}>
        {s.infoBack ? <button className="link" onClick={() => setS((st) => ({ ...st, sheet: 'plan' }))} style={{ alignSelf: 'flex-start', minHeight: 44 }}>‹ План</button> : null}
        {(() => {
          const i = s.infoEi ?? 0, we = workout.exercises[i];
          return we ? <ExerciseInfo e={we.exerciseId != null ? exById.get(we.exerciseId) : undefined} name={we.name} kind={we.kind} /> : null;
        })()}
      </Sheet>
    </div>
  );
}
