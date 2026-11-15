import { useMemo, useState } from 'react';
import { useApp } from '../app-context';
import { api } from '../lib/api';
import { dayMonth, fromDay, isDayStr, MONTH_GEN, today, addDays, type Day } from '../lib/dates';
import { CIRCS, METRICS, PERIODS, change, f1, inPeriod, latest, metricOf, seriesOf, type MEntry, type Metric, type MetricKey } from '../lib/measures';
import { invalidate, useQuery } from '../lib/query';
import { go } from '../lib/router';
import type { Sex } from '../lib/types';
import { numIn, vFat, vWeight } from '../lib/validate';
import { ErrorBox, Field, Screen, Sheet, Skeleton, errText, menuRow, toast } from '../ui';

const PATH = '/me/measurements';
type Res = { entries: MEntry[] };
const useEntries = () => useQuery<Res>(PATH);

const vCirc = (s: string) => {
  const n = numIn(s);
  return Number.isNaN(n) ? 'Только число' : n < 10 || n > 250 ? 'От 10 до 250 см' : null;
};
const vFor = (k: MetricKey) => (k === 'weight' ? vWeight : k === 'bodyFat' ? vFat : vCirc);
const dateText = (d: Day) => dayMonth(d) + (fromDay(d).getFullYear() !== fromDay(today()).getFullYear() ? ` ${fromDay(d).getFullYear()}` : '');
const deltaColor = (m: Metric, sex: Sex, d: number | null) => (d != null && Math.round(d * 10) < 0 && m.downGood[sex] ? 'var(--goodT)' : 'var(--muted)');

/** «Замеры тела» under the figure: the latest value of each metric and the change since the previous entry; a row opens its chart. */
export function MeasuresCard() {
  const { me, wide } = useApp();
  const q = useEntries();
  const sex: Sex = me.profile.sex ?? 'm';
  const last = useMemo(() => latest(q.data?.entries ?? []), [q.data]);
  const lastDate = (q.data?.entries ?? []).reduce<Day | null>((a, e) => (!a || e.date > a ? e.date : a), null);
  return (
    <section className="card col a-in" style={{ flex: wide ? 1 : 'none', minWidth: 0, gap: 6, borderRadius: 24, padding: '16px 16px 14px', alignSelf: wide ? 'flex-start' : 'stretch' }}>
      <div className="between" style={{ alignItems: 'baseline', gap: 8 }}>
        <b className="display" style={{ fontSize: 18 }}>Замеры тела</b>
        {lastDate ? <span className="sub">{dateText(lastDate)}</span> : null}
      </div>
      {q.error ? <ErrorBox error={q.error} retry={q.reload} /> : !q.data ? <Skeleton n={4} /> : (
        <div className="col">
          {METRICS.map((m) => {
            const l = last[m.key];
            return (
              <a key={m.key} href={`#/profile/chart/${m.key}`} aria-label={m.name}
                style={{ minHeight: 50, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink)', borderTop: '1px solid var(--line)' }}>
                <span className="col" style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 700 }}>{m.name}</span>
                  {m.hint[sex] ? <span className="muted" style={{ fontSize: 12 }}>{m.hint[sex]}</span> : null}
                </span>
                <b className="display" style={{ fontSize: 17, whiteSpace: 'nowrap' }}>{l ? `${f1(l.value)} ${m.unit}` : '—'}</b>
                <span style={{ minWidth: 52, textAlign: 'right', fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', color: deltaColor(m, sex, l?.delta ?? null) }}>{change(l?.delta ?? null) ?? ''}</span>
                <span className="muted">›</span>
              </a>
            );
          })}
        </div>
      )}
      <a className="btn" href="#/profile/measure" style={{ marginTop: 6, height: 52, borderRadius: 18, fontSize: 16 }}>Внести замеры</a>
    </section>
  );
}

/** «Внести замеры»: a date, weight and fat, then the circumferences; only the filled fields are saved. */
export function MeasureScreen() {
  const { me, wide } = useApp();
  const q = useEntries();
  const sex: Sex = me.profile.sex ?? 'm';
  const t = today();
  const [pick, setPick] = useState<0 | 1 | 2>(0);
  const [other, setOther] = useState(addDays(t, -2));
  const [v, setV] = useState<Partial<Record<MetricKey, string>>>({});
  const [busy, setBusy] = useState(false);
  const date = pick === 0 ? t : pick === 1 ? addDays(t, -1) : other;
  const last = useMemo(() => latest(q.data?.entries ?? []), [q.data]);
  const errs = Object.fromEntries(METRICS.map((m) => [m.key, v[m.key]?.trim() ? vFor(m.key)(v[m.key]!) : null])) as Record<MetricKey, string | null>;
  const filled = METRICS.filter((m) => v[m.key]?.trim());
  const dateOk = isDayStr(date) && date <= t;
  const valid = filled.length > 0 && !filled.some((m) => errs[m.key]) && dateOk;
  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await api('PUT', `${PATH}/${date}`, { values: Object.fromEntries(filled.map((m) => [m.key, numIn(v[m.key]!)])) });
      await invalidate('/me');
      toast('Замеры сохранены');
      go('profile', 'body');
    } catch (e) { toast(errText(e)); setBusy(false); }
  };
  const input = (m: Metric) => (
    <Field key={m.key} id={`ms-${m.key}`} label={m.key === 'weight' ? 'Вес, кг' : m.name} error={errs[m.key]}>
      <input id={`ms-${m.key}`} className="input" inputMode="decimal" value={v[m.key] ?? ''} aria-invalid={!!errs[m.key]}
        placeholder={last[m.key] ? f1(last[m.key]!.value) : undefined}
        onChange={(e) => { const x = e.target.value; setV((p) => ({ ...p, [m.key]: x })); }}
        style={{ height: 50, borderRadius: 12, background: 'var(--bg)', fontWeight: 800 }} />
      {m.hint[sex] ? <span className="muted" style={{ fontSize: 12 }}>{m.hint[sex]}</span> : null}
    </Field>
  );
  const body = (
    <div className="col" style={{ gap: 14, maxWidth: wide ? 760 : 'none' }}>
      <section className="card col a-in" style={{ gap: 12, padding: '14px 16px 16px' }}>
        <span className="label">Дата</span>
        <div className="seg" role="group" aria-label="Дата" style={{ background: 'var(--bg)', boxShadow: 'none' }}>
          {(['Сегодня', 'Вчера', 'Другая'] as const).map((n, i) => (
            <button key={n} type="button" aria-pressed={pick === i} onClick={() => setPick(i as 0 | 1 | 2)} style={{ height: 40, fontSize: 14, minWidth: 0 }}>{n}</button>
          ))}
        </div>
        {pick === 2 ? (
          <Field id="ms-date" label="Дата замера" error={dateOk ? null : 'Не позже сегодняшнего дня'}>
            {/* iOS gives a date input its own min width; reset so it fits the card */}
            <input id="ms-date" type="date" className="input" value={other} max={t} onChange={(e) => setOther(e.target.value)}
              style={{ height: 50, borderRadius: 12, background: 'var(--bg)', display: 'block', minWidth: 0, width: '100%', WebkitAppearance: 'none', appearance: 'none', fontWeight: 800, lineHeight: '50px' }} />
          </Field>
        ) : null}
        {dateOk ? <span className="sub">Замер за {dayMonth(date)}</span> : null}
      </section>
      <section className="card col a-in" style={{ gap: 12, padding: '14px 16px 16px' }}>
        <span className="label">Вес</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'start' }}>{input(METRICS[0])}{input(METRICS[1])}</div>
      </section>
      <section className="card col a-in" style={{ gap: 12, padding: '14px 16px 16px' }}>
        <span className="label">Обхваты, см</span>
        <div style={{ display: 'grid', gridTemplateColumns: wide ? '1fr 1fr 1fr' : '1fr 1fr', gap: '12px 10px', alignItems: 'start' }}>{CIRCS.map(input)}</div>
        <span className="muted" style={{ fontSize: 13, lineHeight: 1.4 }}>Заполните только то, что померили. Мерьте утром, до еды, сантиметр прилегает плотно, но не стягивает. В полях — прошлые значения.</span>
      </section>
    </div>
  );
  if (wide) {
    return (
      <div className="page">
        <div className="between">
          <h1 className="h1">Внести замеры</h1>
          <div className="row" style={{ gap: 10 }}>
            <a className="btn sec small" href="#/profile/body">Отмена</a>
            <button className="btn small" disabled={!valid || busy} onClick={() => void save()}>Сохранить</button>
          </div>
        </div>
        {body}
      </div>
    );
  }
  return (
    <Screen className="modal">
      <div className="navbar">
        <a className="link" href="#/profile/body">Отмена</a><b>Замеры</b>
        <button className="link" disabled={!valid || busy} onClick={() => void save()} style={{ color: valid ? 'var(--acc)' : 'var(--muted)' }}>Сохранить</button>
      </div>
      {body}
    </Screen>
  );
}

const MON_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const shortDate = (d: Day) => `${fromDay(d).getDate()} ${MONTH_GEN[fromDay(d).getMonth()].slice(0, 3)}`;

/** The line of one metric: grid, area, line, dots; labels are HTML over the SVG so they keep their size. */
function Chart({ pts, wide, name }: { pts: MEntry[]; wide: boolean; name: string }) {
  const W = wide ? 720 : 340, H = 220, L = 44, R = W - 10, T = 14, B = 196;
  const vs = pts.map((p) => p.value);
  const lo = Math.floor(Math.min(...vs)) - 1, hi = Math.ceil(Math.max(...vs)) + 1;
  const t0 = fromDay(pts[0].date).getTime(), t1 = fromDay(pts[pts.length - 1].date).getTime();
  const X = (d: Day) => (t1 === t0 ? (L + R) / 2 : L + (R - L) * ((fromDay(d).getTime() - t0) / (t1 - t0)));
  const Y = (v: number) => B - (B - T) * ((v - lo) / (hi - lo));
  const P = pts.map((p) => [X(p.date), Y(p.value)] as const);
  const line = P.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(' ');
  const area = `${line} L${P[P.length - 1][0].toFixed(1)} ${B} L${P[0][0].toFixed(1)} ${B} Z`;
  const step = Math.max(1, Math.round((hi - lo) / 3));
  const gv: number[] = [];
  for (let v = lo; v <= hi; v += step) gv.push(v);
  const months: { k: number; d: Day }[] = [];
  for (const p of pts) { const k = fromDay(p.date).getFullYear() * 12 + fromDay(p.date).getMonth(); if (!months.some((m) => m.k === k)) months.push({ k, d: p.date }); }
  const gx = months.length > 1 ? months.map((m) => ({ x: X(m.d), t: MON_SHORT[m.k % 12] })) : [...new Map([pts[0], pts[pts.length - 1]].map((p) => [p.date, { x: X(p.date), t: shortDate(p.date) }])).values()];
  const pc = (n: number, of: number) => `${(n / of) * 100}%`;
  return (
    <section className="card a-in" role="img" aria-label={`${name}: ${pts.map((p) => f1(p.value)).join(', ')}`} style={{ padding: '16px 12px 10px 8px' }}>
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} aria-hidden="true">
          <path d={gv.map((v) => `M${L} ${Y(v).toFixed(1)} H${R}`).join(' ')} stroke="var(--line)" strokeWidth={1} fill="none" />
          {P.length > 1 ? <path d={area} fill="var(--acc)" opacity={0.1} /> : null}
          {P.length > 1 ? <path d={line} fill="none" stroke="var(--acc)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" /> : null}
          {P.slice(0, -1).map((q, i) => <circle key={i} cx={q[0]} cy={q[1]} r={4} fill="var(--card)" stroke="var(--acc)" strokeWidth={2.5} />)}
          <circle cx={P[P.length - 1][0]} cy={P[P.length - 1][1]} r={6} fill="var(--acc)" />
        </svg>
        {gv.map((v) => <span key={v} className="muted" style={{ position: 'absolute', left: 0, width: 34, textAlign: 'right', top: pc(Y(v), H), transform: 'translateY(-50%)', fontSize: 12, fontWeight: 700 }}>{v}</span>)}
        {gx.map((g, i) => <span key={i} className="muted" style={{ position: 'absolute', bottom: 0, left: pc(g.x, W), transform: 'translateX(-50%)', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{g.t}</span>)}
      </div>
    </section>
  );
}

/** One metric over time: the latest value, change over the period, the line, the entries (edit / delete via ⋯). */
export function MetricChartScreen({ metric }: { metric: string }) {
  const { me, wide } = useApp();
  const m = metricOf(metric);
  const q = useEntries();
  const [per, setPer] = useState(1);
  const [menu, setMenu] = useState<MEntry | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sex: Sex = me.profile.sex ?? 'm';
  if (!m) { go('profile', 'body'); return null; }
  const all = seriesOf(q.data?.entries ?? [], m.key);
  const pts = inPeriod(all, PERIODS[per].days, today());
  const d = pts.length > 1 ? pts[pts.length - 1].value - pts[0].value : null;
  const run = async (f: () => Promise<unknown>, done: string) => {
    if (busy) return;
    setBusy(true);
    try { await f(); await invalidate('/me'); toast(done); setMenu(null); setEdit(null); } catch (e) { toast(errText(e)); }
    setBusy(false);
  };
  const editErr = edit != null && edit.trim() ? vFor(m.key)(edit) : edit != null ? 'Введите число' : null;
  const close = () => { setMenu(null); setEdit(null); };
  const rows = all.slice().reverse();
  const content = q.error ? <ErrorBox error={q.error} retry={q.reload} /> : !q.data ? <Skeleton n={3} /> : !all.length ? (
    <section className="card col a-in" style={{ gap: 12, alignItems: 'flex-start' }}>
      <b>Записей пока нет</b>
      <span className="muted">Внесите первый замер — здесь появится график.</span>
      <a className="btn small" href="#/profile/measure">Внести замеры</a>
    </section>
  ) : (
    <div className="col" style={{ gap: 14, maxWidth: wide ? 760 : 'none' }}>
      <div className="col a-in" style={{ gap: 2 }}>
        <span className="row" style={{ alignItems: 'baseline', gap: 6 }}><b className="display" style={{ fontSize: 44, lineHeight: 1.1 }}>{f1(all[all.length - 1].value)}</b><span style={{ fontSize: 18 }}>{m.unit}</span></span>
        <span style={{ fontWeight: 800, color: deltaColor(m, sex, d) }}>
          {pts.length < 2 ? `Одна запись ${PERIODS[per].label}` : Math.round((d ?? 0) * 10) === 0 ? `Без изменений ${PERIODS[per].label}` : `${change(d)} ${m.unit} ${PERIODS[per].label}`}
        </span>
      </div>
      <div className="seg">{PERIODS.map((p, i) => <button key={p.n} type="button" aria-pressed={per === i} onClick={() => setPer(i)} style={{ height: 40, fontSize: 14 }}>{p.n}</button>)}</div>
      {pts.length ? <Chart pts={pts} wide={wide} name={m.name} /> : <section className="card muted">За этот период записей нет</section>}
      <section className="card a-in" style={{ padding: '6px 16px' }}>
        {rows.map((e, i) => {
          const prev = rows[i + 1];
          const ch = prev ? e.value - prev.value : null;
          return (
            <div key={e.date} className="row" style={{ minHeight: 50, alignItems: 'center', gap: 10, borderTop: i ? '1px solid var(--line)' : 0 }}>
              <span style={{ flex: 1, fontWeight: 700 }}>{dateText(e.date)}</span>
              <b style={{ whiteSpace: 'nowrap' }}>{f1(e.value)} {m.unit}</b>
              <span style={{ minWidth: 52, textAlign: 'right', fontSize: 13, fontWeight: 800, color: deltaColor(m, sex, ch) }}>{change(ch) ?? ''}</span>
              <button type="button" aria-label={`Запись ${dateText(e.date)}`} onClick={() => setMenu(e)}
                style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--btn)', fontWeight: 800 }}>⋯</button>
            </div>
          );
        })}
      </section>
    </div>
  );
  const sheet = (
    <Sheet open={!!menu} onClose={close} label={menu ? `${m.name}, ${dateText(menu.date)}` : ''}>
      {menu && edit == null ? (
        <div className="col">
          <b className="display" style={{ fontSize: 20, marginBottom: 6 }}>{m.name}, {dateText(menu.date)}</b>
          <button style={menuRow} onClick={() => setEdit(f1(menu.value))}>Изменить</button>
          <button style={{ ...menuRow, color: 'var(--warnT)' }} disabled={busy} onClick={() => void run(() => api('DELETE', `${PATH}/${menu.date}/${m.key}`), 'Запись удалена')}>Удалить</button>
        </div>
      ) : menu ? (
        <div className="col" style={{ gap: 14 }}>
          <b className="display" style={{ fontSize: 20 }}>{m.name}, {dateText(menu.date)}</b>
          <Field id="ms-edit" label={`${m.name}, ${m.unit}`} error={editErr}>
            <input id="ms-edit" className="input" inputMode="decimal" autoFocus value={edit ?? ''} aria-invalid={!!editErr} onChange={(e) => setEdit(e.target.value)} />
          </Field>
          <button className="btn" disabled={!!editErr || busy} onClick={() => void run(() => api('PUT', `${PATH}/${menu.date}`, { values: { [m.key]: numIn(edit!) } }), 'Сохранено')}>Сохранить</button>
        </div>
      ) : null}
    </Sheet>
  );
  if (wide) {
    return (
      <div className="page">
        <a className="link" href="#/profile/body" style={{ fontWeight: 800 }}>‹ Данные и замеры</a>
        <h1 className="h1">{m.name}</h1>
        {content}{sheet}
      </div>
    );
  }
  return (
    <Screen className="modal">
      <div className="navbar"><a className="link" href="#/profile/body">‹ Замеры</a><b>{m.name}</b><span style={{ width: 76 }} /></div>
      {content}{sheet}
    </Screen>
  );
}
