import { useMemo, useState } from 'react';
import { useApp } from '../app-context';
import { api, ApiError } from '../lib/api';
import { activeProgram, fmt, kcal, setNormFor, suggestNorms, weekRange } from '../lib/calc';
import { ageFrom, today, WD_SHORT, weekDays, weekStart } from '../lib/dates';
import { useDays } from '../lib/hooks';
import { invalidate } from '../lib/query';
import { go } from '../lib/router';
import type { Macros, Me, Sex } from '../lib/types';
import { birthToInput, maskBirth, numIn, parseBirth, vBirth, vFat, vHeight, vName, vPassword, vSteps, vWeight, years } from '../lib/validate';
import { EnergyFlow, energyFormFrom, type EnergyResult } from './Energy';
import { Field, Screen, Sheet, errText, toast } from '../ui';

type Pref = 'system' | 'light' | 'dark';

function ThemePicker({ size = 64 }: { size?: number }) {
  const { me, setThemePref } = useApp();
  const cur = me.user.theme;
  const opts: [Pref, string, string][] = [['system', 'Как в системе', 'linear-gradient(90deg,#F3F5F8 50%,#171B21 50%)'], ['light', 'Светлая', '#F3F5F8'], ['dark', 'Тёмная', '#10141A']];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, maxWidth: 640 }}>
      {opts.map(([k, l, bg]) => (
        <button key={k} aria-pressed={cur === k} onClick={() => { setThemePref(k); void api('PATCH', '/me', { theme: k }).then(() => invalidate('/me')).catch(() => {}); }}
          className="card col" style={{ padding: 8, gap: 6, borderRadius: 16, border: cur === k ? '2px solid var(--acc)' : '1px solid var(--track)' }}>
          <div style={{ height: size, borderRadius: 10, background: bg, padding: 8, display: 'flex', flexDirection: 'column', gap: 5, justifyContent: 'center' }}>
            <i style={{ width: '60%', height: 6, borderRadius: 3, background: k === 'light' ? '#12151C' : k === 'dark' ? '#F3F5F7' : '#8A929E' }} />
            <i style={{ width: '40%', height: 10, borderRadius: 4, background: '#2438C9' }} />
            <i style={{ width: '80%', height: 3, borderRadius: 2, background: '#8A929E' }} />
          </div>
          <b style={{ fontSize: 13 }}>{l}</b>
        </button>
      ))}
    </div>
  );
}

const sexSeg = (cur: Sex | '', pick: (v: Sex) => void) => (
  <div className="seg">{([['m', 'Мужчина'], ['f', 'Женщина']] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={cur === k} onClick={() => pick(k)}>{l}</button>)}</div>
);

const currentNorms = (me: Me) => ({ training: setNormFor(me, today(), 'training'), rest: setNormFor(me, today(), 'rest') ?? ([0, 0, 0] as Macros) });

export function ProfileScreen() {
  const { me, logout, wide, programs } = useApp();
  if (wide) return <DesktopProfile />;
  const n = currentNorms(me);
  const name = me.profile.name ?? '';
  return (
    <Screen>
      <div className="row" style={{ gap: 14 }}>
        <span className="display" style={{ width: 60, height: 60, borderRadius: 30, background: '#2438C9', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flex: 'none' }}>{name.charAt(0).toUpperCase()}</span>
        <div className="grow"><div className="display ell" style={{ fontSize: 22 }}>{name}</div><div className="muted ell" style={{ fontSize: 14 }}>{me.user.email}</div></div>
        <button className="link" onClick={() => void logout()}>Выйти</button>
      </div>
      <span className="label">Тема</span>
      <ThemePicker />
      <ThisWeek hasProgram={!!activeProgram(programs)} />
      <span className="label">Питание</span>
      <div className="list">
        {n.training ? (
          <>
            <a href="#/profile/norms"><span className="grow">Тренировочный день</span><span className="muted">{fmt(kcal(n.training))} ккал ›</span></a>
            <a href="#/profile/norms"><span className="grow">День отдыха</span><span className="muted">{fmt(kcal(n.rest))} ккал ›</span></a>
          </>
        ) : (
          <>
            <a href="#/profile/norms"><span className="grow">Обычный день</span><span className="muted">{fmt(kcal(n.rest))} ккал ›</span></a>
            <a href="#/profile/norms"><span className="grow">День тренировки</span><span className="muted">Не задано ›</span></a>
          </>
        )}
        <a href="#/profile/edit"><span className="grow">Данные и замеры</span><span className="muted">›</span></a>
      </div>
      <span className="label">Безопасность</span>
      <div className="list"><a href="#/profile/password"><span className="grow">Пароль</span><span className="muted">Сменить ›</span></a></div>
    </Screen>
  );
}

function ThisWeek({ hasProgram }: { hasProgram: boolean }) {
  const start = weekStart(today());
  const days = useMemo(() => weekDays(start), [start]);
  const data = useDays(days);
  if (!data.days) return null;
  const planned = data.days.filter((d) => d.isTraining).length;
  const done = data.days.filter((d) => d.workout?.status === 'finished').length;
  const withFood = data.days.filter((d) => !d.isPlan && (d.kcal ?? 0) > 0);
  const avg = withFood.length ? Math.round(withFood.reduce((a, d) => a + (d.kcal ?? 0), 0) / withFood.length) : 0;
  return (
    <div className="card col a-in" style={{ gap: 10 }}>
      <div className="between"><b>Эта неделя</b><span className="muted">{weekRange(start)}</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {hasProgram
          ? <div><div className="display num" style={{ fontSize: 19 }}>{`${done} из ${planned}`}</div><div className="sub" style={{ fontSize: 12 }}>тренировки по плану</div></div>
          : <div><div className="display num" style={{ fontSize: 19 }}>{`${withFood.length} из 7`}</div><div className="sub" style={{ fontSize: 12 }}>дней с записанной едой</div></div>}
        <div><div className="display num" style={{ fontSize: 19 }}>{fmt(avg)}</div><div className="sub" style={{ fontSize: 12 }}>ккал в среднем за день</div></div>
      </div>
    </div>
  );
}

/**
 * After weight, steps or body fat change: the norms the formula now suggests, next to the current ones.
 * Null when nothing that drives the formula changed or the profile lacks what it needs (sex, body fat).
 */
type Offer = { rows: [string, Macros | null, Macros][]; norms: { training: Macros | null; rest: Macros } };
function recalcOffer(me: Me, body: { weight: number; steps: number; bodyFat?: number; sex?: Sex }): Offer | null {
  const p = me.profile;
  const sex = body.sex ?? p.sex, fat = body.bodyFat ?? p.bodyFat;
  if (body.weight === p.weight && body.steps === p.steps && fat === p.bodyFat) return null;
  if (!sex || fat == null || !body.weight) return null;
  const mode = p.trainingMode ?? 'time';
  const norms = suggestNorms({ sex, weight: body.weight, bodyFat: fat, steps: body.steps, trainingMode: mode, trainingMin: p.trainingMin ?? 60, trainingKcal: p.trainingKcal ?? 0 }, me.user.goal);
  const d = today();
  const rows: Offer['rows'] = [];
  if (norms.training) rows.push(['День тренировки', setNormFor(me, d, 'training'), norms.training]);
  rows.push(['День отдыха', setNormFor(me, d, 'rest'), norms.rest]);
  return { rows, norms };
}

/** «Пересчитать калории?» with old → new kcal per day type. */
function RecalcSheet({ offer, busy, onRecalc, onLater }: { offer: Offer | null; busy: boolean; onRecalc: () => void; onLater: () => void }) {
  return (
    <Sheet open={!!offer} onClose={onLater} label="Пересчитать калории?">
      <h2 className="display" style={{ fontSize: 20 }}>Пересчитать калории?</h2>
      <div className="col">
        {offer?.rows.map(([d, was, now]) => (
          <div key={d} className="between" style={{ minHeight: 48, borderBottom: '1px solid var(--line)', gap: 10 }}>
            <b style={{ fontWeight: 700 }}>{d}</b>
            <span className="row" style={{ gap: 8, alignItems: 'baseline', whiteSpace: 'nowrap' }}>
              <span className="muted" style={{ fontWeight: 700 }}>{was ? fmt(kcal(was)) : '—'}</span><span className="muted">→</span>
              <b className="display" style={{ fontSize: 17 }}>{fmt(kcal(now))}</b><span className="muted" style={{ fontWeight: 700 }}>ккал</span>
            </span>
          </div>
        ))}
      </div>
      <button className="btn big" style={{ background: '#2438C9', color: '#fff' }} disabled={busy} onClick={onRecalc}>Пересчитать</button>
      <button className="link" style={{ alignSelf: 'center' }} onClick={onLater}>Не сейчас</button>
    </Sheet>
  );
}

function useProfileForm() {
  const { me } = useApp();
  const init = {
    name: me.profile.name ?? '', weight: me.profile.weight == null ? '' : String(me.profile.weight).replace('.', ','),
    height: me.profile.height == null ? '' : String(me.profile.height), birth: birthToInput(me.profile.birthDate), steps: me.profile.steps == null ? '' : String(me.profile.steps),
    fat: me.profile.bodyFat == null ? '' : String(me.profile.bodyFat).replace('.', ','), sex: (me.profile.sex ?? '') as Sex | '',
  };
  const [f, setF] = useState(init);
  const errs: Record<string, string | null> = { name: vName(f.name), weight: vWeight(f.weight), height: vHeight(f.height), birth: vBirth(f.birth), steps: vSteps(f.steps), fat: f.fat.trim() ? vFat(f.fat) : null };
  const valid = !Object.values(errs).some(Boolean);
  const dirty = JSON.stringify(f) !== JSON.stringify(init);
  const set = (k: Exclude<keyof typeof f, 'sex'>) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: k === 'birth' ? maskBirth(e.target.value) : e.target.value }));
  const body = () => ({
    name: f.name.trim(), weight: numIn(f.weight), height: numIn(f.height), birthDate: parseBirth(f.birth), steps: Number(f.steps.replace(/\s/g, '')),
    ...(f.sex ? { sex: f.sex } : {}), ...(f.fat.trim() ? { bodyFat: numIn(f.fat) } : {}),
  });
  const iso = parseBirth(f.birth);
  const age = iso && !errs.birth ? years(ageFrom(iso)) : null;
  return { f, set, errs, valid, dirty, body, age, setF };
}

export function ProfileEditScreen() {
  const { me } = useApp();
  const { f, set, errs, valid, body, age, setF } = useProfileForm();
  const [busy, setBusy] = useState(false);
  const [offer, setOffer] = useState<Offer | null>(null);
  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const b = body();
    const o = recalcOffer(me, b);
    try {
      await api('PUT', '/me/profile', b);
      await invalidate('/me');
      if (o) { setOffer(o); setBusy(false); } else go('profile');
    } catch (e) { toast(errText(e)); setBusy(false); }
  };
  const recalc = async () => {
    if (!offer || busy) return;
    setBusy(true);
    try { await api('PUT', '/me/norms', offer.norms); await invalidate('/me'); toast('Калории пересчитаны'); go('profile'); } catch (e) { toast(errText(e)); setBusy(false); }
  };
  const inp = (k: Exclude<keyof typeof f, 'sex'>, label: string, mode: 'text' | 'decimal' | 'numeric', aside?: string | null) => (
    <Field label={label} id={`pe-${k}`} aside={aside} error={errs[k]}>
      <input id={`pe-${k}`} className="input" inputMode={mode} value={f[k]} onChange={set(k)} aria-invalid={!!errs[k]} style={{ height: 50, borderRadius: 12 }} placeholder={k === 'birth' ? 'ДД.ММ.ГГГГ' : undefined} />
    </Field>
  );
  return (
    <Screen className="modal">
      <div className="navbar">
        <a className="link" href="#/profile">Отмена</a><b>Данные и замеры</b>
        <button className="link" disabled={!valid || busy} onClick={save} style={{ color: valid ? 'var(--acc)' : '#5A6371' }}>Сохранить</button>
      </div>
      <span className="display" style={{ alignSelf: 'center', width: 84, height: 84, borderRadius: 42, background: '#2438C9', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>{(f.name || '?').charAt(0).toUpperCase()}</span>
      <Field label="Почта"><div className="input ro" style={{ height: 50, borderRadius: 12 }}>{me.user.email}</div></Field>
      {inp('name', 'Имя', 'text')}
      {inp('weight', 'Вес, кг', 'decimal')}
      {inp('height', 'Рост, см', 'numeric')}
      {inp('birth', 'Дата рождения', 'numeric', age)}
      {inp('steps', 'Шагов в день, в среднем', 'numeric')}
      {inp('fat', 'Процент жира', 'decimal')}
      <div className="field"><span className="sub" style={{ fontSize: 13 }}>Пол</span>{sexSeg(f.sex, (v) => setF((p) => ({ ...p, sex: v })))}</div>
      <RecalcSheet offer={offer} busy={busy} onRecalc={() => void recalc()} onLater={() => go('profile')} />
    </Screen>
  );
}

const MN = ['Белки, г', 'Жиры, г', 'Углев., г'];
const MC = ['var(--chart)', 'var(--warn)', 'var(--good)'];
const okG = (s: string) => /^\d{1,4}$/.test(s.trim()) && Number(s) <= 1000;

function useNormsForm() {
  const { me } = useApp();
  const cur = currentNorms(me);
  const init = { training: cur.training ? cur.training.map(String) : ['', '', ''], rest: cur.rest.map(String) };
  const [v, setV] = useState(init);
  // The form follows the saved norms when they change (a recalculation, a save elsewhere), not only on mount.
  const key = JSON.stringify(init);
  const [seen, setSeen] = useState(key);
  if (seen !== key) { setSeen(key); setV(init); }
  const trainingEmpty = v.training.every((x) => !x.trim());
  const valid = v.rest.every(okG) && (trainingEmpty || v.training.every(okG));
  const dirty = JSON.stringify(v) !== JSON.stringify(init);
  /** Training-day norm left blank = "not set" (null); those days use the rest-day norm. */
  const macros = (t: 'training' | 'rest'): Macros | null => (t === 'training' && trainingEmpty ? null : (v[t].map((x) => Number(x) || 0) as Macros));
  const body = () => ({ training: macros('training'), rest: macros('rest')! });
  return { v, setV, valid, dirty, macros, body, trainingEmpty, startedEmpty: !cur.training };
}

const weekBudget = (training: Macros | null, rest: Macros, days: number[]) => {
  const t = training ?? rest;
  return {
    B: kcal(t) * days.length + kcal(rest) * (7 - days.length),
    text: days.length ? `${days.length} ${days.length === 1 ? 'тренировка' : days.length < 5 ? 'тренировки' : 'тренировок'}: ${days.map((d) => WD_SHORT[d]).join(', ')}` : 'Тренировок в плане нет, все 7 дней обычные.',
  };
};

const setGrams = (setV: ReturnType<typeof useNormsForm>['setV'], t: 'training' | 'rest', i: number, val: string) =>
  setV((p) => ({ ...p, [t]: p[t].map((x, k) => (k === i ? val.replace(/\D/g, '') : x)) }));

export function NormsScreen() {
  const { programs } = useApp();
  const nf = useNormsForm();
  const [busy, setBusy] = useState(false);
  const days = activeProgram(programs)?.weekdays ?? [];
  const wb = weekBudget(nf.macros('training'), nf.macros('rest')!, days);
  const save = async () => {
    if (!nf.valid || busy) return;
    setBusy(true);
    try { await api('PUT', '/me/norms', nf.body()); await invalidate('/me'); go('profile'); } catch (e) { toast(errText(e)); setBusy(false); }
  };
  // Without a training norm the everyday norm leads; the order is fixed on open so typing does not reshuffle the cards.
  const order = nf.startedEmpty ? (['rest', 'training'] as const) : (['training', 'rest'] as const);
  const title = (t: 'training' | 'rest') => (t === 'training' ? 'День тренировки' : nf.startedEmpty ? 'Обычный день' : 'День отдыха');
  const hint = (t: 'training' | 'rest') => (t === 'training' ? (nf.trainingEmpty ? 'если не задано — как обычный день' : 'когда есть тренировка') : nf.startedEmpty ? 'дни без тренировки' : 'все остальные дни');
  return (
    <Screen className="modal">
      <div className="between"><a className="link" href="#/profile">‹ Профиль</a><button className="link" disabled={!nf.valid || busy} onClick={save} style={{ color: nf.valid ? 'var(--acc)' : '#5A6371' }}>Сохранить</button></div>
      <h1 className="h1" style={{ fontSize: 26 }}>Нормы питания</h1>
      {order.map((t) => {
        const m = nf.macros(t);
        return (
          <div key={t} className="card col" style={{ borderRadius: 18, gap: 10 }}>
            <div className="between" style={{ alignItems: 'baseline' }}>
              <span className="col" style={{ minWidth: 0 }}><b style={{ fontSize: 17 }}>{title(t)}</b><span className="sub" style={{ fontSize: 13 }}>{hint(t)}</span></span>
              {m ? <span><b className="display num" style={{ fontSize: 22 }}>{fmt(kcal(m))}</b> <span className="muted" style={{ fontSize: 14 }}>ккал</span></span> : <b className="display" style={{ fontSize: 16, whiteSpace: 'nowrap', flex: 'none' }}>Не задано</b>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {MN.map((l, i) => (
                <div key={l} className="field">
                  <label htmlFor={`nm-${t}-${i}`} className="sub" style={{ fontSize: 13 }}><span>{l}</span></label>
                  <input id={`nm-${t}-${i}`} inputMode="numeric" placeholder="—" aria-invalid={!(t === 'training' && nf.trainingEmpty) && !okG(nf.v[t][i])} value={nf.v[t][i]} onChange={(e) => setGrams(nf.setV, t, i, e.target.value)}
                    className="input" style={{ height: 46, borderRadius: 10, background: 'var(--bg)', borderTop: `3px solid ${MC[i]}`, textAlign: 'center', fontWeight: 800, fontSize: 16 }} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div className="between" style={{ background: '#2438C9', color: '#fff', borderRadius: 18, padding: 14, gap: 12 }}>
        <div><b>Бюджет этой недели</b><div style={{ fontSize: 13, opacity: 0.9 }}>{wb.text}</div></div>
        <b className="display" style={{ fontSize: 20, whiteSpace: 'nowrap' }}>{fmt(wb.B)} ккал</b>
      </div>
      <a className="link" href="#/profile/recalc">Пересчитать по формуле ›</a>
    </Screen>
  );
}

/** Profile recalculation: the same three body-data steps as registration, saved as new profile data and norms from today. */
export function RecalcScreen() {
  const { me, wide } = useApp();
  const [busy, setBusy] = useState(false);
  const [init] = useState(() => energyFormFrom(me));
  const save = async (r: EnergyResult) => {
    if (busy) return;
    setBusy(true);
    try { await api('PUT', '/me/profile', { ...r.profile, goal: r.goal, norms: r.norms }); await invalidate('/me'); go('profile', 'norms'); }
    catch (e) { toast(errText(e)); setBusy(false); }
  };
  return (
    <Screen className="modal">
      <EnergyFlow mode="recalc" init={init} wide={wide} busy={busy} onBack={() => go('profile', 'norms')} onDone={(r) => void save(r)} />
    </Screen>
  );
}

function PasswordForm({ onDone, wide }: { onDone: () => void; wide?: boolean }) {
  const [f, setF] = useState({ cur: '', next: '', next2: '' });
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);
  const eNext = f.next ? vPassword(f.next) : null;
  const e2 = f.next2 && f.next2 !== f.next ? 'Пароли не совпадают' : null;
  const valid = f.cur && f.next && !vPassword(f.next) && f.next === f.next2;
  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try { await api('POST', '/me/password', { current: f.cur, next: f.next }); toast('Пароль изменён'); onDone(); }
    catch (e) { if (e instanceof ApiError && e.code === 'bad_password') setBad(true); else toast(errText(e)); }
    finally { setBusy(false); }
  };
  const inp = (k: keyof typeof f, label: string, ac: string, err: string | null) => (
    <Field label={label} id={`pw-${k}`} error={err}>
      <input id={`pw-${k}`} type="password" autoComplete={ac} className="input" value={f[k]} aria-invalid={!!err} style={{ background: wide ? 'var(--bg)' : 'var(--card)' }}
        onChange={(e) => { setF((p) => ({ ...p, [k]: e.target.value })); if (k === 'cur') setBad(false); }} />
    </Field>
  );
  return (
    <div className="col" style={{ gap: 14 }}>
      {inp('cur', 'Текущий пароль', 'current-password', bad ? 'Неверный пароль' : null)}
      {inp('next', 'Новый пароль', 'new-password', eNext)}
      {inp('next2', 'Новый пароль ещё раз', 'new-password', e2)}
      <button className="btn" style={{ height: wide ? 52 : 58 }} disabled={!valid || busy} onClick={save}>{wide ? 'Сохранить пароль' : 'Сохранить'}</button>
    </div>
  );
}

export function PasswordScreen() {
  const { wide } = useApp();
  if (wide) {
    return (
      <Screen>
        <a className="link" href="#/profile">‹ Профиль</a>
        <div className="card col a-in" style={{ borderRadius: 22, padding: 24, maxWidth: 480, gap: 16 }}>
          <h1 className="display" style={{ fontSize: 26 }}>Смена пароля</h1>
          <PasswordForm wide onDone={() => go('profile')} />
        </div>
      </Screen>
    );
  }
  return (
    <Screen className="modal">
      <a className="link" href="#/profile">‹ Профиль</a>
      <h1 className="h1" style={{ fontSize: 26 }}>Смена пароля</h1>
      <PasswordForm onDone={() => go('profile')} />
    </Screen>
  );
}

function DesktopProfile() {
  const { me, programs } = useApp();
  const pf = useProfileForm();
  const nf = useNormsForm();
  const [state, setState] = useState<'idle' | 'saved'>('idle');
  const [busy, setBusy] = useState(false);
  const dirty = pf.dirty || nf.dirty;
  const valid = pf.valid && nf.valid;
  const wb = weekBudget(nf.macros('training'), nf.macros('rest')!, activeProgram(programs)?.weekdays ?? []);
  const save = async () => {
    if (!valid || !dirty || busy) return;
    setBusy(true);
    try {
      const b = pf.body();
      // Norms typed by hand in the same save win: no offer then.
      const o = nf.dirty ? null : recalcOffer(me, b);
      await api('PUT', '/me/profile', { ...b, ...(nf.dirty ? { norms: nf.body() } : {}) });
      await invalidate('/me');
      setState('saved');
      setOffer(o);
    } catch (e) { toast(errText(e)); } finally { setBusy(false); }
  };
  const [offer, setOffer] = useState<Offer | null>(null);
  const recalc = async () => {
    if (!offer || busy) return;
    setBusy(true);
    try {
      await api('PUT', '/me/norms', offer.norms);
      await invalidate('/me');
      setOffer(null);
      toast('Калории пересчитаны');
    } catch (e) { toast(errText(e)); } finally { setBusy(false); }
  };
  const label = !valid ? 'Исправьте ошибки в данных' : state === 'saved' && !dirty ? 'Сохранено ✓' : 'Сохранить изменения';
  const btnStyle: React.CSSProperties = state === 'saved' && !dirty && valid ? { background: 'var(--good)', color: '#fff' } : {};
  const markDirty = <T,>(fn: (e: T) => void) => (e: T) => { fn(e); setState('idle'); };
  const section = (title: string, body: React.ReactNode) => (
    <div className="card a-in desk-sec" style={{ display: 'flex', flexWrap: 'wrap', gap: 24, padding: '20px 24px' }}>
      <b style={{ flex: '0 1 260px', fontSize: 18 }}>{title}</b>
      <div style={{ flex: '1 1 480px', minWidth: 0 }}>{body}</div>
    </div>
  );
  const pInp = (k: 'name' | 'weight' | 'height' | 'birth' | 'steps' | 'fat', l: string, mode: 'text' | 'decimal' | 'numeric') => (
    <div className="field">
      <label htmlFor={`dp-${k}`} className="sub" style={{ fontSize: 13, fontWeight: 800 }}><span>{k === 'birth' && pf.age ? `${l} · ${pf.age}` : l}</span></label>
      <input id={`dp-${k}`} className="input" inputMode={mode} value={pf.f[k]} onChange={markDirty(pf.set(k))} aria-invalid={!!pf.errs[k]} style={{ height: 46, borderRadius: 10 }} />
      <span className="err" style={{ fontSize: 13, minHeight: 16 }}>{pf.errs[k] ?? ''}</span>
    </div>
  );
  return (
    <Screen>
      <div className="between">
        <h1 className="h1 a-h" style={{ fontSize: 30 }}>Профиль</h1>
        <button className="btn small" style={{ height: 48, borderRadius: 14, ...btnStyle }} disabled={!valid || (!dirty && state !== 'saved') || busy} onClick={save}>{label}</button>
      </div>
      <div className="col" style={{ maxWidth: 1100, gap: 14 }}>
        {section('Личные данные', (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            <div className="field"><span className="sub" style={{ fontSize: 13, fontWeight: 800 }}>Почта</span><div className="input ro" style={{ height: 46, borderRadius: 10 }}>{me.user.email}</div></div>
            {pInp('name', 'Имя', 'text')}{pInp('weight', 'Вес, кг', 'decimal')}{pInp('height', 'Рост, см', 'numeric')}{pInp('birth', 'Дата рождения', 'numeric')}{pInp('steps', 'Шагов в день', 'numeric')}{pInp('fat', 'Процент жира', 'decimal')}
            <div className="field"><span className="sub" style={{ fontSize: 13, fontWeight: 800 }}>Пол</span>{sexSeg(pf.f.sex, (v) => { pf.setF((p) => ({ ...p, sex: v })); setState('idle'); })}</div>
          </div>
        ))}
        {section('Нормы питания', (
          <div className="col" style={{ gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px,1.2fr) repeat(4, minmax(70px,1fr))', gap: 8, alignItems: 'center' }}>
              <span />{['Ккал', 'Белки, г', 'Жиры, г', 'Углеводы, г'].map((h) => <span key={h} className="sub" style={{ fontSize: 12, fontWeight: 800 }}>{h}</span>)}
              {(['training', 'rest'] as const).map((t) => [
                <b key={`${t}l`}>{t === 'training' ? 'День тренировки' : 'День отдыха'}</b>,
                <div key={`${t}k`} className="input ro display" style={{ height: 46, borderRadius: 10, fontSize: 15 }}>{(() => { const m = nf.macros(t); return m ? fmt(kcal(m)) : 'Не задано'; })()}</div>,
                ...[0, 1, 2].map((i) => (
                  <input key={`${t}${i}`} aria-label={`${t === 'training' ? 'День тренировки' : 'День отдыха'}, ${['Белки, г', 'Жиры, г', 'Углеводы, г'][i]}`} inputMode="numeric" className="input"
                    placeholder="—" aria-invalid={!(t === 'training' && nf.trainingEmpty) && !okG(nf.v[t][i])} value={nf.v[t][i]} style={{ height: 46, borderRadius: 10, borderLeft: `4px solid ${MC[i]}`, fontWeight: 800 }}
                    onChange={(e) => { setGrams(nf.setV, t, i, e.target.value); setState('idle'); }} />
                )),
              ])}
            </div>
            <div className="between" style={{ flexWrap: 'wrap' }}>
              <span className="muted">Бюджет недели <b style={{ color: 'var(--ink)' }}>{fmt(wb.B)} ккал</b> · {wb.text}</span>
              <a className="link" href="#/profile/recalc">Пересчитать по формуле ›</a>
            </div>
          </div>
        ))}
        {section('Тема', <ThemePicker size={72} />)}
        {section('Безопасность', <a className="btn small outline" href="#/profile/password">Сменить пароль</a>)}
      </div>
      <RecalcSheet offer={offer} busy={busy} onRecalc={() => void recalc()} onLater={() => setOffer(null)} />
    </Screen>
  );
}

