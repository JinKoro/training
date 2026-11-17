import { useMemo, useState } from 'react';
import { useApp } from '../app-context';
import { api, ApiError, setToken } from '../lib/api';
import { activeProgram, fmt, hasNorm, kcal, programWeek, setNormFor, suggestNorms, timesPerWeek, weekRange, weekTrainingDays } from '../lib/calc';
import { ageFrom, today, WD_SHORT, weekDays, weekStart } from '../lib/dates';
import { useDays } from '../lib/hooks';
import { clearCache, invalidate } from '../lib/query';
import { go, onBackClick } from '../lib/router';
import type { Macros, Me, Sex } from '../lib/types';
import { birthToInput, maskBirth, numIn, parseBirth, vBirth, vFat, vHeight, vName, vPassword, vSteps, vWeight, years } from '../lib/validate';
import { EnergyFlow, energyFormFrom, type EnergyResult } from './Energy';
import { BodyFigure } from '../art/Body';
import { MeasuresCard } from './Measures';
import { Field, Screen, Sheet, errText, toast, PasswordInput } from '../ui';

type Pref = 'system' | 'light' | 'dark';

function ThemePicker({ size = 64 }: { size?: number }) {
  // The ring follows the local choice at once, not the account copy (that one arrives after the request).
  const { themePref: cur, setThemePref } = useApp();
  const opts: [Pref, string, string][] = [['system', 'Как в системе', 'linear-gradient(90deg,#F6F5F2 50%,#26272A 50%)'], ['light', 'Светлая', '#F6F5F2'], ['dark', 'Тёмная', '#212225']];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, maxWidth: 640 }}>
      {opts.map(([k, l, bg]) => (
        <button key={k} aria-pressed={cur === k} onClick={() => setThemePref(k)}
          className="card col" style={{ padding: 8, gap: 6, borderRadius: 20, minWidth: 0, border: `1px solid ${cur === k ? 'var(--acc)' : 'var(--track)'}`, boxShadow: cur === k ? '0 0 0 1px var(--acc)' : 'none' }}>
          <div style={{ height: size, borderRadius: 10, background: bg, padding: 8, display: 'flex', flexDirection: 'column', gap: 5, justifyContent: 'center' }}>
            <i style={{ width: '60%', height: 6, borderRadius: 3, background: k === 'light' ? '#1A1A1A' : k === 'dark' ? '#F4F4F5' : '#8A857E' }} />
            <i style={{ width: '40%', height: 10, borderRadius: 4, background: '#FF5A1F' }} />
            <i style={{ width: '80%', height: 3, borderRadius: 2, background: '#8A857E' }} />
          </div>
          <b style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{l}</b>
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
  const n = currentNorms(me);
  const name = me.profile.name ?? '';
  // Rows like the rest of the app: bold label, muted bold value (they used to be regular weight and stood out)
  const row = (href: string, label: string, value: string, warn?: boolean) => (
    <a href={href} style={{ fontWeight: 700 }}><span className="grow" style={warn ? { color: 'var(--warnT)' } : undefined}>{label}</span><span className="muted">{value}</span></a>
  );
  const head = (
    <div className="row" style={{ gap: 14 }}>
      <span className="display" style={{ width: 60, height: 60, borderRadius: 30, background: 'var(--hero)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flex: 'none' }}>{name.charAt(0).toUpperCase()}</span>
      <div className="grow"><div className="display ell" style={{ fontSize: 22 }}>{name}</div><div className="muted ell" style={{ fontSize: 14 }}>{me.user.email}</div></div>
      <button className="btn sec small" style={{ height: wide ? 44 : 40 }} onClick={() => void logout()}>Выйти</button>
    </div>
  );
  const theme = <><span className="label">Тема</span><ThemePicker size={wide ? 72 : 64} /><ThisWeek hasProgram={!!activeProgram(programs)} /></>;
  const menu = (
    <>
      <span className="label">Питание</span>
      <div className="list">
        {!hasNorm(me) ? row('#/profile/recalc', 'Калории в день', 'Рассчитать ›')
          : n.training ? <>{row('#/profile/norms', 'Тренировочный день', `${fmt(kcal(n.training))} ккал ›`)}{row('#/profile/norms', 'День отдыха', `${fmt(kcal(n.rest))} ккал ›`)}</>
          : <>{row('#/profile/norms', 'Обычный день', `${fmt(kcal(n.rest))} ккал ›`)}{row('#/profile/norms', 'День тренировки', 'Не задано ›')}</>}
        {row('#/profile/body', 'Данные и замеры', '›')}
      </div>
      <span className="label">Безопасность</span>
      <div className="list">
        {row('#/profile/password', 'Пароль', 'Сменить ›')}
        {row('#/profile/delete', 'Удалить аккаунт', '›', true)}
      </div>
    </>
  );
  if (wide) {
    return (
      <div className="page">
        <h1 className="h1">Профиль</h1>
        <div style={{ maxWidth: 1000 }}>{head}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 24, maxWidth: 1000, alignItems: 'start' }}>
          <div className="col" style={{ gap: 14 }}>{theme}</div>
          <div className="col" style={{ gap: 14 }}>{menu}</div>
        </div>
      </div>
    );
  }
  return <Screen>{head}{theme}{menu}</Screen>;
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
function recalcOffer(me: Me, body: { weight?: number; steps?: number; bodyFat?: number; sex?: Sex }): Offer | null {
  const p = me.profile;
  const sex = body.sex ?? p.sex, fat = body.bodyFat ?? p.bodyFat, weight = body.weight ?? p.weight, steps = body.steps ?? p.steps ?? 0;
  // Any formula input changed: weight, steps, body fat or sex.
  if (weight === p.weight && steps === (p.steps ?? 0) && fat === p.bodyFat && sex === p.sex) return null;
  if (!sex || fat == null || !weight) return null;
  const mode = p.trainingMode ?? 'time';
  const norms = suggestNorms({ sex, weight, bodyFat: fat, steps, trainingMode: mode, trainingMin: p.trainingMin ?? 60, trainingKcal: p.trainingKcal ?? 0 }, me.user.goal);
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
      <button className="btn big" style={{ background: 'var(--hero)', color: '#fff' }} disabled={busy} onClick={onRecalc}>Пересчитать</button>
      <button className="btn big sec" onClick={onLater}>Не сейчас</button>
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
  // Body data may be empty (skipped at sign-up): an empty field is left as it is, only a filled one is checked and saved.
  const opt = (s: string, v: (x: string) => string | null) => (s.trim() ? v(s) : null);
  const errs: Record<string, string | null> = { name: vName(f.name), weight: opt(f.weight, vWeight), height: opt(f.height, vHeight), birth: opt(f.birth, vBirth), steps: opt(f.steps, vSteps), fat: opt(f.fat, vFat) };
  const valid = !Object.values(errs).some(Boolean);
  const dirty = JSON.stringify(f) !== JSON.stringify(init);
  const set = (k: Exclude<keyof typeof f, 'sex'>) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: k === 'birth' ? maskBirth(e.target.value) : e.target.value }));
  const body = () => ({
    name: f.name.trim(),
    ...(f.weight.trim() ? { weight: numIn(f.weight) } : {}), ...(f.height.trim() ? { height: numIn(f.height) } : {}),
    ...(f.birth.trim() ? { birthDate: parseBirth(f.birth) } : {}), ...(f.steps.trim() ? { steps: Number(f.steps.replace(/\s/g, '')) } : {}),
    ...(f.sex ? { sex: f.sex } : {}), ...(f.fat.trim() ? { bodyFat: numIn(f.fat) } : {}),
  });
  const iso = parseBirth(f.birth);
  const age = iso && !errs.birth ? years(ageFrom(iso)) : null;
  return { f, set, errs, valid, dirty, body, age, setF };
}

export function ProfileEditScreen() {
  const { me, wide } = useApp();
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
      if (o) { setOffer(o); setBusy(false); } else go('profile', 'body');
    } catch (e) { toast(errText(e)); setBusy(false); }
  };
  const recalc = async () => {
    if (!offer || busy) return;
    setBusy(true);
    try { await api('PUT', '/me/norms', offer.norms); await invalidate('/me'); toast('Калории пересчитаны'); go('profile', 'body'); } catch (e) { toast(errText(e)); setBusy(false); }
  };
  const { programs } = useApp();
  const inp = (k: Exclude<keyof typeof f, 'sex'>, label: string, mode: 'text' | 'decimal' | 'numeric', aside?: string | null) => (
    <Field label={label} id={`pe-${k}`} aside={aside} error={errs[k]}>
      <input id={`pe-${k}`} className="input" inputMode={mode} value={f[k]} onChange={set(k)} aria-invalid={!!errs[k]} style={{ height: 50, borderRadius: 12, background: 'var(--bg)' }} placeholder={k === 'birth' ? 'ДД.ММ.ГГГГ' : undefined} />
    </Field>
  );
  const sex: Sex = f.sex || 'm';
  const fatN = numIn(f.fat);
  // the figure nearest to the typed value lights up, as at sign-up
  const near = f.fat.trim() && Number.isFinite(fatN) ? FAT_LEVELS[sex].reduce((b, x) => (Math.abs(x - fatN) < Math.abs(b - fatN) ? x : b)) : null;
  const prog = activeProgram(programs);
  const card: React.CSSProperties = { gap: 12, padding: '14px 14px 16px' };
  const cards = (
    <>
      <section className="card col a-in" style={card}>
        <span className="label">Общая информация</span>
        <Field label="Почта"><div className="input ro" style={{ height: 50, borderRadius: 12 }}>{me.user.email}</div></Field>
        {inp('name', 'Имя', 'text')}
        {inp('birth', 'Дата рождения', 'numeric', age)}
        <div className="field"><span style={{ fontWeight: 700 }}>Пол</span>{sexSeg(f.sex, (v) => setF((p) => ({ ...p, sex: v })))}</div>
      </section>
      <section className="card col a-in" style={card}>
        <span className="label">Тело</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'start' }}>{inp('weight', 'Вес, кг', 'decimal')}{inp('height', 'Рост, см', 'numeric')}</div>
        <div className="field">
          <span style={{ fontWeight: 700 }}>Процент жира</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 4 }}>
            {FAT_LEVELS[sex].map((pct) => {
              const on = pct === near;
              return (
                <button key={pct} type="button" aria-pressed={on} aria-label={`${pct} процентов`} onClick={() => setF((p) => ({ ...p, fat: String(pct) }))}
                  style={{ borderRadius: 14, padding: '6px 0 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 0,
                    background: on ? 'var(--pick)' : 'transparent', border: `2px solid ${on ? 'var(--acc)' : 'transparent'}` }}>
                  <BodyFigure sex={sex} fat={pct} size={64} selected={on} />
                  <span style={{ fontWeight: 800, fontSize: 12, color: on ? 'var(--acc)' : 'var(--muted)' }}>{pct}%</span>
                </button>
              );
            })}
          </div>
          {inp('fat', 'Или свой процент', 'decimal')}
        </div>
      </section>
      <section className="card col a-in" style={card}>
        <span className="label">Физическая активность</span>
        {inp('steps', 'Шаги в день', 'numeric')}
        {/* read-only: what the user trains by now (changed in Спорт, not here) */}
        <div className="field"><span style={{ fontWeight: 700 }}>Тренировки</span>
          <div className="input ro" style={{ height: 'auto', minHeight: 50, borderRadius: 12, padding: '8px 14px', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', color: 'var(--ink)' }}>
            {prog ? <><b className="ell" style={{ maxWidth: '100%' }}>{prog.name}</b><span className="sub">{timesPerWeek(prog.weekdays.length)} · {prog.weekdays.map((d) => WD_SHORT[d]).join(', ')}</span></> : <b>Без программы</b>}
          </div>
        </div>
      </section>
    </>
  );
  if (wide) {
    return (
      <div className="page">
        <a className="link" href="#/profile/body" style={{ fontWeight: 800 }}>‹ Данные и замеры</a>
        <div className="between" style={{ maxWidth: 1000 }}>
          <h1 className="h1">Данные и замеры</h1>
          <div className="row" style={{ gap: 10 }}>
            <a className="btn sec small" href="#/profile/body" onClick={onBackClick}>Отмена</a>
            <button className="btn small" disabled={!valid || busy} onClick={() => void save()}>Сохранить</button>
          </div>
        </div>
        <div className="desk-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, maxWidth: 1000, alignItems: 'start' }}>{cards}</div>
        <RecalcSheet offer={offer} busy={busy} onRecalc={() => void recalc()} onLater={() => go('profile', 'body')} />
      </div>
    );
  }
  return (
    <Screen className="modal">
      <div className="navbar">
        <a className="link" href="#/profile/body" onClick={onBackClick}>Отмена</a><b>Данные и замеры</b>
        <button className="link" disabled={!valid || busy} onClick={save} style={{ color: valid ? 'var(--acc)' : 'var(--muted)' }}>Сохранить</button>
      </div>
      {cards}
      <RecalcSheet offer={offer} busy={busy} onRecalc={() => void recalc()} onLater={() => go('profile', 'body')} />
    </Screen>
  );
}

const FAT_LEVELS: Record<Sex, number[]> = { m: [10, 15, 20, 25, 30, 35], f: [15, 20, 25, 30, 35, 40] };
const fmt1 = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

/** «Данные и замеры»: the sign-up figure (sex + body fat) with the numbers on it; «Изменить» opens the form. */
export function BodyScreen() {
  const { me, wide } = useApp();
  const p = me.profile;
  const sex: Sex = p.sex ?? 'm';
  const fat = p.bodyFat ?? null;
  const fig = wide ? 420 : 400;
  const age = p.birthDate ? years(ageFrom(p.birthDate)) : null;
  const lean = p.weight != null && fat != null ? p.weight * (1 - fat / 100) : null;
  const marks: { top: string; v: string; l: string; hot?: boolean }[] = [
    { top: '24%', v: p.weight == null ? '—' : `${fmt1(p.weight)} кг`, l: lean == null ? 'вес' : `сухая ${fmt1(lean)} кг` },
    { top: '47%', v: fat == null ? '—' : `${fmt1(fat)} %`, l: 'жира', hot: true },
    { top: '90%', v: p.steps == null ? '—' : fmt(p.steps), l: 'шагов в день' },
  ];
  const card = (
    <section className="card col a-in" style={{ alignItems: 'center', gap: 16, padding: '22px 16px 20px', borderRadius: 24, alignSelf: wide ? 'flex-start' : 'stretch', width: wide ? 560 : 'auto' }}>
      <div className="row" style={{ alignItems: 'stretch', justifyContent: 'center', gap: 8, height: fig, maxWidth: '100%' }}>
        <div className="body-fade" style={{ width: 44, flex: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', padding: '2px 0' }}>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.05 }}><b className="display" style={{ fontSize: 22 }}>{p.height ?? '—'}</b><span className="sub" style={{ fontSize: 12 }}>см</span></span>
          {Array.from({ length: 9 }, (_, i) => <span key={i} style={{ width: i % 4 === 0 ? 16 : 9, height: 2, borderRadius: 1, background: 'var(--track)' }} />)}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}><BodyFigure sex={sex} fat={fat ?? (sex === 'f' ? 25 : 20)} size={fig} /></div>
        <div style={{ position: 'relative', width: 96, flex: 'none' }}>
          {marks.map((m) => (
            <div key={m.l} style={{ position: 'absolute', left: 0, top: m.top, transform: 'translateY(-50%)' }}>
              <span className="body-slide" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 14, borderTop: '2px dashed var(--track)', marginLeft: -18, flex: 'none' }} />
                <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, padding: '5px 9px', borderRadius: 14, background: m.hot ? 'var(--acc)' : 'var(--sub)', color: m.hot ? 'var(--onAcc)' : 'var(--ink)' }}>
                  <b className="display" style={{ fontSize: 18, whiteSpace: 'nowrap' }}>{m.v}</b><span style={{ fontSize: 11, fontWeight: 700, opacity: 0.8, whiteSpace: 'nowrap' }}>{m.l}</span>
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="col" style={{ alignItems: 'center', gap: 2, textAlign: 'center' }}>
        <b className="display" style={{ fontSize: 22 }}>{p.name ?? ''}</b>
        <span className="muted" style={{ fontWeight: 700 }}>{[p.sex === 'f' ? 'Женщина' : p.sex === 'm' ? 'Мужчина' : null, age].filter(Boolean).join(' · ')}</span>
      </div>
    </section>
  );
  if (wide) {
    return (
      <div className="page">
        <div className="between"><h1 className="h1">Данные и замеры</h1><a className="btn sec small" href="#/profile/edit">Изменить</a></div>
        <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}><div style={{ flex: 'none' }}>{card}</div><MeasuresCard /></div>
      </div>
    );
  }
  return (
    <Screen className="modal">
      <div className="navbar"><a className="link" href="#/profile">‹ Профиль</a><b>Данные и замеры</b><a className="link" href="#/profile/edit">Изменить</a></div>
      {card}
      <MeasuresCard />
    </Screen>
  );
}

const MN = ['Белки, г', 'Жиры, г', 'Углев., г'];
const MC = ['var(--chart)', 'var(--warn)', 'var(--good)'];
const okG = (s: string) => /^\d{1,4}$/.test(s.trim()) && Number(s) <= 1000;

function useNormsForm() {
  const { me } = useApp();
  const cur = currentNorms(me);
  // No calories yet (skipped at sign-up): empty fields, not zeros.
  const init = { training: cur.training ? cur.training.map(String) : ['', '', ''], rest: hasNorm(me) ? cur.rest.map(String) : ['', '', ''] };
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

/** Training days of this week's program week (days without exercises are rest days); before/after the program: its weekdays. */
const budgetDays = (p: ReturnType<typeof activeProgram>): number[] => {
  if (!p) return [];
  const w = programWeek(p, today());
  return w === null ? p.weekdays : weekTrainingDays(p, w);
};

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
  const days = budgetDays(activeProgram(programs));
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
      <div className="between"><a className="link" href="#/profile">‹ Профиль</a><button className="link" disabled={!nf.valid || busy} onClick={save} style={{ color: nf.valid ? 'var(--acc)' : '#6E6A64' }}>Сохранить</button></div>
      <h1 className="h1" style={{ fontSize: 26 }}>План питания</h1>
      {order.map((t) => {
        const m = nf.macros(t);
        return (
          <div key={t} className="card col" style={{ borderRadius: 22, gap: 10 }}>
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
      <div className="between" style={{ background: 'var(--hero)', color: '#fff', borderRadius: 22, padding: 14, gap: 12 }}>
        <div><b>Бюджет этой недели</b><div style={{ fontSize: 13, opacity: 0.9 }}>{wb.text}</div></div>
        <b className="display" style={{ fontSize: 20, whiteSpace: 'nowrap' }}>{fmt(wb.B)} ккал</b>
      </div>
      <a className="btn sec" style={{ height: 48, borderRadius: 18, fontSize: 15 }} href="#/profile/recalc">Пересчитать по формуле</a>
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
      <PasswordInput id={`pw-${k}`} autoComplete={ac} value={f[k]} invalid={!!err} style={{ background: wide ? 'var(--bg)' : 'var(--card)' }}
        onChange={(v) => { setF((p) => ({ ...p, [k]: v })); if (k === 'cur') setBad(false); }} />
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

export function DeleteAccountScreen() {
  const { wide } = useApp();
  const [pass, setPass] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const del = async () => {
    if (!pass || busy) return;
    setBusy(true); setErr(null);
    try {
      await api('DELETE', '/me', { password: pass });
      setToken(null); clearCache(); location.hash = '#/login'; location.reload();
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'bad_password' ? 'Неверный пароль' : errText(e));
      setBusy(false);
    }
  };
  const body = (
    <div className="col" style={{ gap: 14, maxWidth: wide ? 520 : undefined }}>
      <section className="card col a-in" style={{ gap: 12 }}>
        <div className="col" style={{ gap: 6 }}><b style={{ color: 'var(--warnT)' }}>Удалится навсегда</b><span className="muted" style={{ lineHeight: 1.45 }}>Профиль и план питания, дневник еды, блюда, тренировки, программы и свои упражнения. Вернуть их будет нельзя.</span></div>
        <div style={{ height: 1, background: 'var(--line)' }} />
        <div className="col" style={{ gap: 6 }}><b>Останется</b><span className="muted" style={{ lineHeight: 1.45 }}>Продукты, которые вы добавили в общую библиотеку, — без вашего имени.</span></div>
      </section>
      <section className="card col a-in" style={{ gap: 12 }}>
        <Field label="Пароль для подтверждения" id="del-pass" error={err}>
          <PasswordInput id="del-pass" autoComplete="current-password" value={pass} onChange={(v) => { setPass(v); setErr(null); }} invalid={!!err} />
        </Field>
        <button className="btn big" disabled={!pass || busy} onClick={() => void del()} style={pass ? { background: 'var(--warn)', color: '#fff' } : undefined}>Удалить аккаунт навсегда</button>
        <a className="btn sec" href="#/profile" onClick={onBackClick}>Отмена</a>
      </section>
    </div>
  );
  if (wide) return <div className="page"><h1 className="h1">Удаление аккаунта</h1>{body}</div>;
  return (
    <Screen className="modal">
      <div className="navbar"><a className="link" href="#/profile">‹ Профиль</a><b>Удаление аккаунта</b><span style={{ width: 76 }} /></div>
      {body}
    </Screen>
  );
}
