import { useMemo, useState } from 'react';
import { useApp } from '../app-context';
import { api } from '../lib/api';
import { planMinutes, programProgress, weeksText } from '../lib/calc';
import { WD_LONG, WD_SHORT } from '../lib/dates';
import { invalidate } from '../lib/query';
import { go } from '../lib/router';
import type { Plan, PlanRow, Program } from '../lib/types';
import { Screen, errText, toast } from '../ui';
import { ExercisePicker } from './ExercisePicker';
import { DeleteProgram } from './Sport';

interface Row { exerciseId: number; sets: string; reps: string; kg: string; rest?: number | null; note?: string | null }
type EPlan = Record<number, Record<number, Row[]>>;

const toEPlan = (p: Plan): EPlan => {
  const out: EPlan = {};
  for (const [w, days] of Object.entries(p)) {
    out[Number(w)] = {};
    for (const [d, rows] of Object.entries(days)) out[Number(w)][Number(d)] = rows.map((r) => ({ ...r, sets: String(r.sets), reps: r.reps, kg: r.kg ?? '' }));
  }
  return out;
};
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const fmtKg = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

const vSets = (s: string) => /^\d{1,2}$/.test(s) && Number(s) >= 1 && Number(s) <= 20;
const vReps = (s: string) => /^\d{1,3}([–-]\d{1,3})?$/.test(s.trim());
const vKg = (s: string) => s.trim() === '' || /^\d{1,4}([.,]\d{1,2})?(\s*\/\s*\d{1,4}([.,]\d{1,2})?)*$/.test(s.trim());

export function ProgramEditorScreen({ mode, id }: { mode: 'new' | 'edit'; id?: number }) {
  const { programs } = useApp();
  const p = mode === 'edit' ? programs.find((x) => x.id === id) : undefined;
  if (mode === 'edit' && !p) return <Screen className="modal"><a className="link" href="#/sport">‹ Спорт</a><div className="empty">Программа не найдена</div></Screen>;
  return <Editor key={p?.id ?? 'new'} mode={mode} program={p} />;
}

function Editor({ mode, program }: { mode: 'new' | 'edit'; program?: Program }) {
  const { wide, exById } = useApp();
  const [name, setName] = useState(program?.name ?? '');
  const [days, setDays] = useState<boolean[]>(() => Array.from({ length: 7 }, (_, i) => (program ? program.weekdays.includes(i) : [0, 2, 4].includes(i))));
  const [weeks, setWeeks] = useState(program?.weeks ?? 8);
  const [sel, setSel] = useState(() => (program ? Math.min(program.weeks, programProgress(program).currentWeek) : 1));
  const [day, setDay] = useState(0);
  const [fresh, setFresh] = useState<Record<number, true>>({});
  const [pick, setPick] = useState(false);
  const [plan, setPlan] = useState<EPlan>(() => (program ? toEPlan(program.plan) : {}));
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);

  const act = days.map((on, i) => (on ? i : -1)).filter((i) => i >= 0);
  const dayX = act.includes(day) ? day : act[0] ?? 0;
  const list = plan[sel]?.[dayX] ?? [];
  const weekFilled = (w: number) => act.some((d) => (plan[w]?.[d]?.length ?? 0) > 0);
  const filled = weekFilled(sel);
  const showEditor = filled || sel === 1 || !!fresh[sel];
  const otherFilled = Array.from({ length: weeks }, (_, i) => i + 1).filter((w) => w !== sel && weekFilled(w));

  const setRows = (fn: (rows: Row[]) => Row[]) => setPlan((p) => {
    const n = clone(p);
    n[sel] ??= {};
    n[sel][dayX] = fn(n[sel][dayX] ?? []);
    return n;
  });
  const forWeek = (fn: (r: Row) => Row) => setPlan((p) => {
    const n = clone(p);
    for (const d of act) if (n[sel]?.[d]) n[sel][d] = n[sel][d].map(fn);
    return n;
  });

  const invalidRows = useMemo(() => {
    for (const [w, ds] of Object.entries(plan)) {
      if (Number(w) > weeks) continue;
      for (const [d, rows] of Object.entries(ds)) {
        if (!act.includes(Number(d))) continue;
        if (rows.some((r) => !vSets(r.sets) || !vReps(r.reps) || !vKg(r.kg))) return true;
      }
    }
    return false;
  }, [plan, weeks, act]);
  const canSave = act.length > 0 && !invalidRows && !busy;
  const backHref = wide ? '#/sport' : mode === 'new' ? '#/sport' : `#/program/${program!.id}`;

  const defaultsFor = (exerciseId: number): Row => {
    for (let w = sel - 1; w >= 1; w--) {
      for (const d of Object.keys(plan[w] ?? {})) {
        const r = plan[w][Number(d)].find((x) => x.exerciseId === exerciseId);
        if (r) return { ...r };
      }
    }
    return { exerciseId, sets: '3', reps: '10', kg: '' };
  };

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    const out: Plan = {};
    for (let w = 1; w <= weeks; w++) {
      for (const d of act) {
        const rows = plan[w]?.[d];
        if (!rows?.length) continue;
        out[w] ??= {};
        out[w][d] = rows.map<PlanRow>((r) => ({ exerciseId: r.exerciseId, sets: Number(r.sets), reps: r.reps.trim().replace('-', '–'), kg: r.kg.trim().replace(/\s/g, ''), rest: r.rest ?? null, note: r.note ?? null }));
      }
    }
    const body = { name: name.trim() || `Программа на ${weeksText(weeks).replace('неделя', 'неделю')}`, weekdays: act, weeks, plan: out };
    try {
      const res = mode === 'new'
        ? await api<{ program: Program }>('POST', '/programs', body)
        : await api<{ program: Program }>('PUT', `/programs/${program!.id}`, body);
      invalidate('/programs');
      toast(mode === 'new' ? 'Программа создана' : 'Сохранено');
      if (wide) go('sport'); else go('program', res.program.id);
    } catch (e) { toast(errText(e)); setBusy(false); }
  };

  if (pick) {
    return (
      <Screen className="modal">
        <ExercisePicker subtitle={`Неделя ${sel} · ${WD_LONG[dayX]}`} existing={list.map((r) => r.exerciseId)} onBack={() => setPick(false)}
          onPick={(e) => { setRows((rows) => [...rows, defaultsFor(e.id)]); setFresh((f) => ({ ...f, [sel]: true })); setPick(false); }} />
      </Screen>
    );
  }

  const inp: React.CSSProperties = { height: 44, borderRadius: 10, border: '1px solid var(--track)', background: 'var(--bg)', textAlign: 'center', fontWeight: 800, width: '100%', minWidth: 0, outline: 'none', padding: 0 };
  const bad = (ok: boolean): React.CSSProperties => (ok ? {} : { borderColor: 'var(--warn)' });

  const settings = (
    <div className="col" style={{ gap: 14 }}>
      <div className="field">
        <label htmlFor="pe-name">Название</label>
        <input id="pe-name" className="input" style={{ height: 50, borderRadius: 12 }} value={name} placeholder={`Программа на ${weeksText(weeks).replace('неделя', 'неделю')}`} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </div>
      <div className="field">
        <span className="flabel">Дни тренировок</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
          {WD_SHORT.map((w, i) => (
            <button key={w} aria-pressed={days[i]} onClick={() => setDays((d) => d.map((v, k) => (k === i ? !v : v)))}
              style={{ height: 46, borderRadius: 10, fontWeight: 800, background: days[i] ? 'var(--acc)' : 'var(--card)', color: days[i] ? 'var(--onAcc)' : 'var(--ink)', border: '1px solid var(--cardBorder)' }}>{w}</button>
          ))}
        </div>
      </div>
      <div className="card between" style={{ borderRadius: 14, padding: '8px 12px' }}>
        <b>Недель в программе</b>
        <div className="row" style={{ gap: 6 }}>
          <button className="icon-btn" style={{ background: 'var(--bg)' }} aria-label="Меньше недель" onClick={() => { const w = Math.max(1, weeks - 1); setWeeks(w); setSel((s) => Math.min(s, w)); }}>−</button>
          <b className="num" style={{ minWidth: 28, textAlign: 'center' }}>{weeks}</b>
          <button className="icon-btn" style={{ background: 'var(--bg)' }} aria-label="Больше недель" onClick={() => setWeeks((w) => Math.min(52, w + 1))}>+</button>
        </div>
      </div>
      {wide && mode === 'edit' ? <button className="warn-link" style={{ alignSelf: 'flex-start' }} onClick={() => setDel(true)}>Удалить программу</button> : null}
    </div>
  );

  const weeksCol = (
    <div className="col" style={{ gap: 12 }}>
      <span className="label">Недели</span>
      <div className="chips">
        {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => {
          const isSel = w === sel, f = weekFilled(w);
          return <button key={w} aria-label={`Неделя ${w}`} aria-pressed={isSel} onClick={() => setSel(w)} style={{
            height: 40, minWidth: 40, borderRadius: 12, fontWeight: 800, flex: 'none', boxSizing: 'border-box',
            background: isSel ? 'var(--acc)' : f ? 'var(--btn)' : 'transparent', color: isSel ? 'var(--onAcc)' : 'var(--ink)',
            border: isSel || f ? 0 : '1px dashed var(--track)',
          }}>{w}</button>;
        })}
      </div>
      {act.length ? (
        <div className="chips">
          {act.map((d) => <button key={d} className="chip" aria-pressed={d === dayX} onClick={() => setDay(d)}>{WD_SHORT[d]}</button>)}
        </div>
      ) : <span className="muted">Выберите хотя бы один день</span>}
      {act.length ? (
        <>
          <div className="between"><b style={{ fontSize: 18 }}>Неделя {sel} · {WD_LONG[dayX]}</b><span className="muted" style={{ fontSize: 13 }}>{filled ? `${list.length} упр. · ~ ${planMinutes(list.map((r) => ({ ...r, sets: Number(r.sets) || 0 })), exById)} мин` : 'пусто'}</span></div>
          {!showEditor ? (
            <div className="card col" style={{ borderRadius: 16, gap: 12 }}>
              <b>Скопировать неделю</b>
              {otherFilled.length ? (
                <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                  {otherFilled.map((w) => <button key={w} onClick={() => setPlan((p) => ({ ...clone(p), [sel]: clone(p[w]) }))} style={{ height: 40, minWidth: 40, borderRadius: 12, background: 'var(--btn)', fontWeight: 800 }}>{w}</button>)}
                </div>
              ) : null}
              <button className="btn ghost" style={{ height: 48, borderRadius: 12 }} onClick={() => setFresh((f) => ({ ...f, [sel]: true }))}>Заполнить с нуля</button>
            </div>
          ) : (
            <>
              {filled ? (
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <button className="chip" style={{ border: '1px solid var(--track)', color: 'var(--acc)', background: 'transparent' }} onClick={() => forWeek((r) => {
                    const parts = r.kg.split('/').map((x) => Number(x.trim().replace(',', '.')));
                    if (!r.kg.trim() || parts.some((x) => !Number.isFinite(x)) || parts.every((x) => x <= 0)) return r;
                    return { ...r, kg: parts.map((x) => (x > 0 ? fmtKg(x + 2.5) : fmtKg(x))).join('/') };
                  })}>+2,5 кг всем</button>
                  <button className="chip" style={{ border: '1px solid var(--track)', color: 'var(--acc)', background: 'transparent' }} onClick={() => forWeek((r) => ({ ...r, sets: String(Math.min(20, (Number(r.sets) || 0) + 1)) }))}>+1 подход всем</button>
                </div>
              ) : null}
              {list.length ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 58px 70px 28px', gap: 6, padding: '0 8px 0 12px' }} className="sub">
                  <span /><span style={{ textAlign: 'center', fontSize: 12 }}>подх.</span><span style={{ textAlign: 'center', fontSize: 12 }}>повт.</span><span style={{ textAlign: 'center', fontSize: 12 }}>кг</span><span />
                </div>
              ) : null}
              {list.map((r, k) => {
                const e = exById.get(r.exerciseId);
                const set = (patch: Partial<Row>) => setRows((rows) => rows.map((x, i) => (i === k ? { ...x, ...patch } : x)));
                return (
                  <div key={`${r.exerciseId}-${k}`} className="a-in" style={{ display: 'grid', gridTemplateColumns: '1fr 50px 58px 70px 28px', gap: 6, alignItems: 'center', background: 'var(--card)', border: '1px solid var(--cardBorder)', borderRadius: 14, padding: '8px 8px 8px 12px' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, minWidth: 0 }}>{e?.name ?? 'Упражнение'}</span>
                    <input aria-label="Подходы" inputMode="numeric" style={{ ...inp, ...bad(vSets(r.sets)) }} value={r.sets} onChange={(ev) => set({ sets: ev.target.value.replace(/\D/g, '') })} />
                    <input aria-label={e?.type === 'time' ? 'Секунды' : 'Повторы'} placeholder={e?.type === 'time' ? 'сек' : undefined} style={{ ...inp, ...bad(vReps(r.reps)) }} value={r.reps} onChange={(ev) => set({ reps: ev.target.value.replace(/[^\d–-]/g, '') })} />
                    <input aria-label="Вес" inputMode="decimal" style={{ ...inp, ...bad(vKg(r.kg)) }} value={r.kg} onChange={(ev) => set({ kg: ev.target.value.replace(/[^\d.,/ ]/g, '') })} />
                    <button aria-label="Убрать упражнение" className="muted" style={{ height: 40 }} onClick={() => setRows((rows) => rows.filter((_, i) => i !== k))}>×</button>
                  </div>
                );
              })}
              <button className="btn ghost" style={{ height: 48, borderRadius: 12 }} onClick={() => setPick(true)}>+ Упражнение</button>
            </>
          )}
        </>
      ) : null}
    </div>
  );

  return (
    <Screen className="modal">
      <div className="navbar">
        <a className="link" href={backHref}>Отмена</a>
        <b>{mode === 'new' ? 'Новая программа' : 'Изменить программу'}</b>
        <button className="link" disabled={!canSave} onClick={save} style={{ color: canSave ? 'var(--acc)' : 'var(--muted)' }}>{mode === 'new' ? 'Создать' : 'Сохранить'}</button>
      </div>
      {wide ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.6fr)', gap: 22, alignItems: 'start' }}>{settings}{weeksCol}</div>
      ) : <>{settings}{weeksCol}</>}
      {mode === 'edit' && program ? <DeleteProgram p={program} open={del} onClose={() => setDel(false)} /> : null}
    </Screen>
  );
}
