import { useMemo, useState } from 'react';
import { useApp } from '../app-context';
import { api } from '../lib/api';
import { mmss, programProgress, timesPerWeek, weeksText } from '../lib/calc';
import { addDays, dayMonth, today, weekStart, weekdayIdx, WD_CAP, WD_LONG, WD_SHORT } from '../lib/dates';
import { invalidate } from '../lib/query';
import { go } from '../lib/router';
import { blockOf, buildPlan, dayMinutes, LEVEL_RU, templateById, templateDay, templatesFor, weightFor, type Level } from '../lib/templates';
import type { Program } from '../lib/types';
import { Screen, Sheet, errText, toast } from '../ui';

/** One-colour level tag: three dots, as many lit as the level. */
export function LevelTag({ level, big }: { level: Level; big?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--btn)', color: 'var(--ink)', borderRadius: 8, padding: big ? '4px 10px' : '3px 8px', fontSize: big ? 13 : 12, fontWeight: 800, flex: 'none' }}>
      <span style={{ display: 'inline-flex', gap: 2 }}>
        {[0, 1, 2].map((i) => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i <= level ? 'var(--acc)' : 'var(--muted)', opacity: i <= level ? 1 : 0.35 }} />)}
      </span>
      {LEVEL_RU[level]}
    </span>
  );
}

/** «Готовые программы» in Спорт: the programs for the account's sex. */
export function TemplatesBlock() {
  const { me } = useApp();
  const list = templatesFor(me.profile.sex);
  return (
    <>
      <span className="label">Готовые программы</span>
      <div className="list a-in">
        {list.map((t) => (
          <a key={t.id} href={`#/template/${t.id}`}>
            <div className="grow">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><b>{t.name}</b><LevelTag level={t.level} /></span>
              <div className="sub">{weeksText(t.weeks)} · {timesPerWeek(t.days.length)}</div>
            </div>
            <span className="muted">›</span>
          </a>
        ))}
      </div>
    </>
  );
}

const loadColor = (load: number) => (load < 0.3 ? 'var(--track)' : 'var(--chart)');

export function TemplateScreen({ id }: { id: string }) {
  const { wide } = useApp();
  const t = templateById(id);
  const [wk, setWk] = useState(1);
  if (!t) return <Screen className="modal"><a className="link" href="#/sport">‹ Спорт</a><div className="empty">Программа не найдена</div></Screen>;
  const b = blockOf(t, wk);
  const info = (
    <div className="col" style={{ gap: 14, minWidth: 0 }}>
      <span style={{ alignSelf: 'flex-start' }}><LevelTag level={t.level} big /></span>
      <h1 className="display a-h" style={{ fontSize: wide ? 30 : 26, lineHeight: 1.15, margin: 0 }}>{t.name}</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        {[[String(t.weeks), 'недель'], [String(t.days.length), 'раза в неделю']].map(([v, l]) => (
          <div key={l} className="card col a-in" style={{ borderRadius: 16, padding: 12, gap: 2 }}><b className="display" style={{ fontSize: 18 }}>{v}</b><span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>{l}</span></div>
        ))}
      </div>
      <div className="card col a-in" style={{ borderRadius: 20, gap: 12 }}>
        <b>Нагрузка по неделям</b>
        <div aria-hidden="true" style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 64 }}>
          {Array.from({ length: t.weeks }, (_, i) => blockOf(t, i + 1)).map((x, i) => (
            <span key={i} className="a-bar" style={{ flex: 1, height: Math.round(x.load * 64), borderRadius: 4, background: loadColor(x.load) }} />
          ))}
        </div>
        <div className="col" style={{ gap: 0 }}>
          {t.blocks.map((x, i) => (
            <div key={x.name} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, borderTop: i ? '1px solid var(--line)' : 0 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: loadColor(x.load), flex: 'none' }} />
              <span className="grow col" style={{ gap: 0, minWidth: 0 }}><b>{x.name}</b><span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>{x.from === x.to ? `неделя ${x.from}` : `недели ${x.from}–${x.to}`}</span></span>
              <span className="muted" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{x.scheme[t.level]}</span>
            </div>
          ))}
        </div>
      </div>
      {wide ? <button className="btn big blue" onClick={() => go('template', t.id, 'start')}>Начать программу</button> : null}
    </div>
  );
  const weeks = (
    <div className="col" style={{ gap: 12, minWidth: 0, paddingBottom: wide ? 0 : 84 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${t.weeks}, minmax(0, 1fr))`, gap: 3 }}>
        {Array.from({ length: t.weeks }, (_, i) => i + 1).map((n) => (
          <button key={n} aria-label={`Неделя ${n}`} aria-pressed={n === wk} onClick={() => setWk(n)} style={{
            height: 44, borderRadius: 7, fontSize: 12, fontWeight: 800,
            background: n === wk ? 'var(--acc)' : blockOf(t, n).load < 0.3 ? 'var(--sub)' : 'var(--card)', color: n === wk ? 'var(--onAcc)' : 'var(--ink)',
          }}>{n}</button>
        ))}
      </div>
      <div className="between"><b style={{ fontSize: 18 }}>Неделя {wk}</b><span className="muted" style={{ fontWeight: 700 }}>{b.name}</span></div>
      {t.days.map((_, d) => {
        const rows = templateDay(t, wk, d);
        return (
          <div key={d} className="card col a-in" style={{ borderRadius: 18, gap: 6 }}>
            <div className="between"><b>{WD_CAP[[0, 2, 4][d] ?? d]}</b><span className="muted">{rows.length} упр. · ~ {dayMinutes(rows)} мин</span></div>
            {rows.map((r, i) => (
              <div key={i} className="col" style={{ fontSize: 14, gap: 2 }}>
                <div className="between" style={{ gap: 8 }}>
                  <span className="ell" style={{ minWidth: 0 }}>{r.name}</span>
                  <span className="muted" style={{ whiteSpace: 'nowrap', flex: 'none' }}>{r.sets}×{r.reps} · {mmss(r.rest)}</span>
                </div>
                {r.note ? <span className="muted" style={{ fontSize: 13 }}>{r.note}</span> : null}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
  return (
    <Screen className="modal">
      <a className="link" href="#/sport">‹ Спорт</a>
      {wide ? <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.3fr)', gap: 28, alignItems: 'start' }}>{info}{weeks}</div> : <>{info}{weeks}</>}
      {!wide ? <div className="fixed-bottom"><button className="btn big blue" onClick={() => go('template', t.id, 'start')}>Начать программу</button></div> : null}
    </Screen>
  );
}

const num = (s: string) => { const v = s.replace(/\s/g, '').replace(',', '.'); return /^\d+(\.\d+)?$/.test(v) ? Number(v) : NaN; };
const kgText = (n: number) => String(n).replace('.', ',');

/** First training date from today on the chosen weekdays; the program starts on that week's Monday. */
function firstDay(days: number[]) {
  const d0 = today();
  for (let i = 0; i < 14; i++) { const d = addDays(d0, i); if (days.includes(weekdayIdx(d))) return d; }
  return d0;
}

export function TemplateStartScreen({ id }: { id: string }) {
  const { wide, exercises, programs } = useApp();
  const t = templateById(id);
  const [days, setDays] = useState<number[]>([0, 2, 4]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [skip, setSkip] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const byName = useMemo(() => new Map(exercises.filter((e) => !e.own).map((e) => [e.name.toLowerCase(), e])), [exercises]);
  const current: Program | undefined = programs.find((p) => p.active && !programProgress(p).finished);
  if (!t) return <Screen className="modal"><a className="link" href="#/sport">‹ Спорт</a><div className="empty">Программа не найдена</div></Screen>;
  const need = t.days.length, ok = days.length === need;
  const first = ok ? firstDay(days) : null;
  const scheme1 = t.blocks[0].scheme[t.level], reps1 = Number(scheme1.split('×')[1].split('–').pop());
  const lifts = t.lifts.map((n) => {
    const v = vals[n] ?? '', x = num(v), bad = v.trim() !== '' && !(x > 0 && x <= 500);
    return { n, v, x, bad, unknown: !!skip[n], hint: !bad && x > 0 ? `Неделя 1 · ${scheme1} · ${kgText(weightFor(x, t.askReps, reps1, t.blocks[0].factor))} кг` : '' };
  });
  const canGo = ok && !lifts.some((l) => l.bad && !l.unknown) && !busy;

  const start = async () => {
    if (!first) return;
    setBusy(true);
    try {
      const weights = Object.fromEntries(lifts.filter((l) => !l.unknown && l.x > 0).map((l) => [l.n, l.x]));
      const weekdays = [...days].sort();
      const body = { name: t.name, weekdays, weeks: t.weeks, plan: buildPlan(t, weekdays, weights, byName), startDate: weekStart(first) };
      await api('POST', '/programs', body);
      await invalidate('/programs');
      toast(`Программа «${t.name}» начата`);
      go('sport');
    } catch (e) { toast(errText(e)); setBusy(false); }
  };
  const go1 = () => (current ? setConfirm(true) : void start());
  const button = <button className="btn big blue" disabled={!canGo} onClick={go1}>Начать</button>;

  return (
    <Screen className="modal">
      <div className="col" style={{ gap: 14, width: '100%', maxWidth: wide ? 560 : undefined, paddingBottom: wide ? 0 : 96 }}>
        <a className="link" href={`#/template/${t.id}`}>‹ {t.name}</a>
        <h1 className="display a-h" style={{ fontSize: wide ? 30 : 26, lineHeight: 1.15, margin: 0 }}>Старт программы</h1>
        <div className="col" style={{ gap: 8 }}>
          <b>Дни тренировок</b>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
            {WD_SHORT.map((n, i) => {
              const on = days.includes(i);
              return <button key={n} aria-pressed={on} onClick={() => setDays(on ? days.filter((x) => x !== i) : [...days, i])} style={{ height: 44, borderRadius: 11, fontWeight: 800, background: on ? 'var(--acc)' : 'var(--card)', color: on ? 'var(--onAcc)' : 'var(--ink)' }}>{n}</button>;
            })}
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: ok ? 'var(--muted)' : 'var(--warnT)' }}>
            {first ? `Первая тренировка — ${WD_LONG[weekdayIdx(first)]}, ${dayMonth(first)}` : days.length < need ? `Выберите ещё ${need - days.length} ${need - days.length === 1 ? 'день' : 'дня'}` : `Нужно ${need} дня, уберите лишний`}
          </span>
        </div>
        <div className="col" style={{ gap: 4 }}>
          <b>Рабочие веса</b>
          <span className="muted" style={{ fontSize: 14, fontWeight: 700 }}>Сколько килограммов вы поднимаете на {t.askReps} повторов. Остальное программа посчитает сама.</span>
        </div>
        {lifts.map((l, i) => (
          <div key={l.n} className="card col a-in" style={{ borderRadius: 18, gap: 8, padding: '12px 14px' }}>
            <label htmlFor={`lift${i}`} style={{ fontWeight: 800 }}>{l.n}</label>
            {!l.unknown ? (
              <>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex' }}>
                    <input id={`lift${i}`} className="input" inputMode="decimal" aria-invalid={l.bad} placeholder="0" value={l.v} style={{ height: 50, paddingRight: 44, background: 'var(--sub)' }}
                      onChange={(e) => setVals({ ...vals, [l.n]: e.target.value.replace(/[^\d.,]/g, '') })} />
                    <span className="muted" style={{ position: 'absolute', right: 14, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontWeight: 700 }}>кг</span>
                  </span>
                  <button className="btn sec small" style={{ height: 50 }} onClick={() => setSkip({ ...skip, [l.n]: true })}>Не знаю</button>
                </div>
                {l.hint ? <span className="muted" style={{ fontSize: 14, fontWeight: 700 }}>{l.hint}</span> : null}
                {l.bad ? <span style={{ color: 'var(--warnT)', fontSize: 14, fontWeight: 700 }}>Число, например 47,5</span> : null}
              </>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="grow muted" style={{ fontWeight: 700 }}>Подберём на первой тренировке</span>
                <button className="btn sec small" onClick={() => setSkip({ ...skip, [l.n]: false })}>Ввести</button>
              </div>
            )}
          </div>
        ))}
        {wide ? button : null}
      </div>
      {!wide ? <div className="fixed-bottom">{button}</div> : null}
      <Sheet open={confirm} onClose={() => setConfirm(false)} label="Начать программу">
        <b className="display" style={{ fontSize: 20, lineHeight: 1.2 }}>Начать «{t.name}»?</b>
        <span className="muted">«{current?.name}» перестанет быть текущей и останется в «Мои программы».</span>
        <button className="btn blue" disabled={busy} onClick={() => void start()}>Начать</button>
        <button className="btn sec" onClick={() => setConfirm(false)}>Отмена</button>
      </Sheet>
    </Screen>
  );
}

