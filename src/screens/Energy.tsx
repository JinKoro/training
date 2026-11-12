import { useState } from 'react';
import { BodyFigure } from '../art/Body';
import { energy, fmt, kcal, suggestNorms, type EnergyInput } from '../lib/calc';
import { ageFrom } from '../lib/dates';
import type { Goal, Macros, Me, Sex, TrainingMode } from '../lib/types';
import { birthToInput, intIn, maskBirth, numIn, parseBirth, vBirth, vFat, vHeight, vKcal, vMinutes, vSteps, vWeight, years } from '../lib/validate';

export interface EnergyForm {
  sex: Sex; birth: string; weight: string; height: string; fat: string; steps: string;
  tmode: TrainingMode; min: string; own: string; goal: Goal;
}

export interface EnergyResult {
  profile: {
    sex: Sex; birthDate: string; weight: number; height: number; bodyFat: number; steps: number;
    trainingMode: TrainingMode; trainingMin: number | null; trainingKcal: number | null;
  };
  goal: Goal;
  norms: { training: Macros | null; rest: Macros };
}

export const emptyEnergyForm = (): EnergyForm => ({ sex: 'm', birth: '', weight: '', height: '', fat: '', steps: '', tmode: 'time', min: '60', own: '', goal: 'keep' });

export function energyFormFrom(me: Me): EnergyForm {
  const p = me.profile;
  const s = (v: number | null) => (v == null ? '' : String(v).replace('.', ','));
  return {
    sex: p.sex ?? 'm', birth: birthToInput(p.birthDate), weight: s(p.weight), height: s(p.height), fat: s(p.bodyFat), steps: s(p.steps),
    tmode: p.trainingMode ?? 'time', min: p.trainingMin == null ? '60' : String(p.trainingMin), own: s(p.trainingKcal), goal: me.user.goal,
  };
}

const LEVELS: Record<Sex, number[]> = { m: [10, 15, 20, 25, 30, 35], f: [15, 20, 25, 30, 35, 40] };
const GOALS: [Goal, string, string][] = [['lose', 'Похудеть', '−10 %'], ['keep', 'Держать', ''], ['gain', 'Набрать', '+10 %']];
const TMODES: [TrainingMode, string][] = [['none', 'Нет'], ['time', 'По времени'], ['kcal', 'Свои ккал']];
const NOTE: React.CSSProperties = { fontSize: 14, lineHeight: 1.4 };

/**
 * Body data -> body fat -> expenditure and suggested calories.
 * Registration uses it as steps 2-4 of 4; the profile uses it as its own 3-step recalculation.
 */
export function EnergyFlow({ mode, init, wide, busy, error, onBack, onDone }: {
  mode: 'register' | 'recalc'; init: EnergyForm; wide: boolean; busy: boolean; error?: string | null;
  onBack: () => void; onDone: (r: EnergyResult) => void;
}) {
  const reg = mode === 'register';
  const [step, setStep] = useState(0);
  const [f, setF] = useState(init);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const set = (k: keyof EnergyForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = k === 'birth' ? maskBirth(e.target.value) : e.target.value;
    setF((p) => ({ ...p, [k]: v })); setTouched((t) => ({ ...t, [k]: true }));
  };
  const errs: Record<string, string | null> = {
    birth: vBirth(f.birth), weight: vWeight(f.weight), height: vHeight(f.height), fat: vFat(f.fat), steps: vSteps(f.steps),
    min: f.tmode === 'time' ? vMinutes(f.min) : null, own: f.tmode === 'kcal' ? vKcal(f.own) : null,
  };
  const keys = [['birth', 'weight', 'height'], ['fat'], ['steps', 'min', 'own']][step];
  const okStep = keys.every((k) => !errs[k]);
  const show = (k: string) => (touched[k] ? errs[k] : null);

  const w = numIn(f.weight), fat = numIn(f.fat);
  const input: EnergyInput = {
    sex: f.sex, weight: Number.isNaN(w) ? 0 : w, bodyFat: Number.isNaN(fat) ? 0 : fat, steps: errs.steps ? 0 : intIn(f.steps),
    trainingMode: f.tmode, trainingMin: errs.min ? 0 : intIn(f.min), trainingKcal: errs.own ? 0 : intIn(f.own),
  };
  const en = energy(input);
  const norms = suggestNorms(input, f.goal);

  const next = () => {
    if (!okStep) { setTouched((t) => ({ ...t, ...Object.fromEntries(keys.map((k) => [k, true])) })); return; }
    if (step < 2) { setStep(step + 1); document.querySelector('.scroller')?.scrollTo(0, 0); return; }
    onDone({
      profile: {
        sex: f.sex, birthDate: parseBirth(f.birth)!, weight: w, height: numIn(f.height), bodyFat: fat, steps: intIn(f.steps),
        trainingMode: f.tmode, trainingMin: f.tmode === 'time' ? intIn(f.min) : null, trainingKcal: f.tmode === 'kcal' ? intIn(f.own) : null,
      },
      goal: f.goal, norms,
    });
  };

  const total = reg ? 4 : 3, no = reg ? step + 2 : step + 1;
  const seg = <T extends string>(opts: [T, string][], cur: T, pick: (v: T) => void) => (
    <div className="seg">{opts.map(([k, l]) => <button key={k} type="button" aria-pressed={cur === k} onClick={() => pick(k)}>{l}</button>)}</div>
  );
  const inp = (k: keyof EnergyForm, label: string, im: 'numeric' | 'decimal', aside?: string | null) => (
    <div className="field" style={{ minWidth: 0 }}>
      <label htmlFor={`en-${k}`} className="sub" style={{ fontSize: 13 }}><span>{label}</span></label>
      <input id={`en-${k}`} className="input" inputMode={im} placeholder={k === 'birth' ? 'ДД.ММ.ГГГГ' : undefined} value={f[k]} onChange={set(k)} aria-invalid={!!show(k)}
        style={{ height: 50, borderRadius: 12, fontFamily: 'var(--display)', fontWeight: 800, fontSize: 18 }} />
      <span className={show(k) ? 'err' : 'sub'} style={{ fontSize: 12, minHeight: 15 }}>{show(k) ?? aside ?? ''}</span>
    </div>
  );
  const birthIso = parseBirth(f.birth);
  const near = LEVELS[f.sex].reduce((b, x, i, a) => (Math.abs(x - fat) < Math.abs(a[b] - fat) ? i : b), 0);
  const profileNote = reg ? <span className="muted" style={NOTE}>Всё это можно будет изменить в профиле.</span> : null;

  const parts = [
    { n: 'Базовый обмен', sub: `370 + 21,6 × ${fmt1(en.lean)} кг сухой массы`, v: en.bmr, c: 'var(--chart)' },
    { n: 'Переваривание еды', sub: '17 % от базового', v: en.tef, c: 'var(--dig)' },
    { n: 'Шаги', sub: `${fmt(input.steps)} × ${fmt(en.per1000)} ккал на 1 000 шагов`, v: en.steps, c: 'var(--good)' },
    ...(f.tmode === 'none' ? [] : [{
      n: 'Тренировка', sub: `${f.tmode === 'time' ? `0,07 × ${fmt1(input.weight)} кг × ${fmt(input.trainingMin)} мин` : 'с часов'} · только в дни тренировок`, v: en.training, c: 'var(--warn)', plus: true,
    }]),
  ];
  const days = norms.training
    ? [{ n: 'День тренировки', m: norms.training }, { n: 'День отдыха', m: norms.rest }]
    : [{ n: 'В день', m: norms.rest }];

  return (
    <div className="col" style={{ gap: 14, flex: 1, width: '100%', maxWidth: wide ? (step === 2 ? 880 : 560) : undefined, alignSelf: 'center' }}>
      <div className="between">
        <button type="button" className="link" onClick={() => (step === 0 ? onBack() : setStep(step - 1))}>{step === 0 && !reg ? '‹ Нормы' : '‹ Назад'}</button>
        <span className="muted" style={{ fontWeight: 700 }}>Шаг {no} из {total}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${total}, 1fr)`, gap: 6 }}>
        {Array.from({ length: total }, (_, i) => <i key={i} style={{ height: 5, borderRadius: 3, background: i < no ? 'var(--acc)' : 'var(--track)' }} />)}
      </div>
      <h1 className="h1 a-h">{['О себе', 'Процент жира', 'Расход и норма'][step]}</h1>

      {step === 0 ? (
        <>
          {seg([['m', 'Мужчина'], ['f', 'Женщина']], f.sex, (v) => setF((p) => ({ ...p, sex: v })))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {inp('birth', 'Дата рождения', 'numeric', birthIso && !errs.birth ? years(ageFrom(birthIso)) : null)}
            {inp('weight', 'Вес, кг', 'decimal')}
            {inp('height', 'Рост, см', 'numeric')}
          </div>
          {profileNote}
        </>
      ) : null}

      {step === 1 ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${wide ? 6 : 3}, 1fr)`, gap: 8 }}>
            {LEVELS[f.sex].map((pct, i) => {
              const on = i === near && !Number.isNaN(fat);
              return (
                <button key={pct} type="button" className="a-pop" aria-pressed={on} aria-label={`${pct} процентов`} onClick={() => { setF((p) => ({ ...p, fat: String(pct) })); setTouched((t) => ({ ...t, fat: true })); }}
                  style={{ background: on ? 'var(--pick)' : 'var(--card)', border: `2px solid ${on ? 'var(--acc)' : 'transparent'}`, borderRadius: 16, padding: '10px 4px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <BodyFigure sex={f.sex} fat={pct} size={wide ? 110 : 96} selected={on} />
                  <span className="display" style={{ fontSize: 16, color: on ? 'var(--acc)' : 'var(--ink)' }}>{pct}%</span>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'start' }}>
            {inp('fat', 'Мой процент', 'decimal')}
            <div className="col" style={{ gap: 4, paddingTop: 21 }}>
              <span className="display num" style={{ fontSize: 18 }}>{errs.fat || errs.weight ? '—' : `${fmt1(en.lean)} кг`}</span>
              <span className="sub" style={{ fontSize: 13 }}>сухая масса</span>
            </div>
          </div>
          <span className="muted" style={NOTE}>Точнее процент жира покажет биоимпедансный анализ: умные весы, фитнес-клуб или клиника. Ещё можно сравнить себя с фото в интернете.</span>
          {profileNote}
        </>
      ) : null}

      {step === 2 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
          <div className="col" style={{ flex: '1 1 300px', minWidth: 0, gap: 12 }}>
            {inp('steps', 'Шагов в день', 'numeric')}
            <div className="col" style={{ gap: 6 }}><span className="sub" style={{ fontSize: 13 }}>Тренировка</span>{seg(TMODES, f.tmode, (v) => setF((p) => ({ ...p, tmode: v })))}</div>
            {f.tmode === 'time' ? inp('min', 'Минут за тренировку', 'numeric') : f.tmode === 'kcal' ? inp('own', 'Ккал за тренировку (с часов)', 'numeric') : null}
            <div className="col" style={{ gap: 6 }}><span className="sub" style={{ fontSize: 13 }}>Цель</span>{seg(GOALS.map(([k, l]) => [k, l] as [Goal, string]), f.goal, (v) => setF((p) => ({ ...p, goal: v })))}</div>
          </div>
          <div className="col" style={{ flex: '1 1 340px', minWidth: 0, gap: 12 }}>
            <div className="card col a-in" style={{ gap: 12, borderRadius: 20 }}>
              <div className="between"><b style={{ fontSize: 17 }}>Расход в день</b><span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>ккал</span></div>
              <div style={{ display: 'flex', gap: 2, height: 12, borderRadius: 6, overflow: 'hidden' }}>
                {parts.map((p) => <i key={p.n} className="a-fill" style={{ flex: `${Math.max(p.v, 1)} 1 0`, background: p.c }} />)}
              </div>
              {parts.map((p) => (
                <div key={p.n} style={{ display: 'grid', gridTemplateColumns: '12px 1fr auto', gap: 10, alignItems: 'start' }}>
                  <i style={{ width: 12, height: 12, borderRadius: 4, background: p.c, marginTop: 4 }} />
                  <span className="col" style={{ gap: 2, minWidth: 0 }}><b>{p.n}</b><span className="muted" style={{ fontSize: 13, lineHeight: 1.3 }}>{p.sub}</span></span>
                  <b className="display num" style={{ fontSize: 16, whiteSpace: 'nowrap' }}>{'plus' in p ? '+' : ''}{fmt(p.v)}</b>
                </div>
              ))}
              <div style={{ height: 1, background: 'var(--line)' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {(f.tmode === 'none' ? [['В день', en.rest]] : [['День отдыха', en.rest], ['День тренировки', en.train]]).map(([n, v]) => (
                  <div key={n} className="col" style={{ gap: 2 }}><span className="sub" style={{ fontSize: 13 }}>{n}</span><b className="display num" style={{ fontSize: 20 }}>{fmt(v as number)}</b></div>
                ))}
              </div>
            </div>
            <div className="col a-in" style={{ background: 'var(--blue)', color: '#fff', borderRadius: 20, padding: 16, gap: 12 }}>
              <div className="between"><b style={{ fontSize: 17 }}>Предлагаемые калории</b><span style={{ fontSize: 13, fontWeight: 700, opacity: 0.85 }}>{GOALS.find((g) => g[0] === f.goal)![2]}</span></div>
              {days.map((d) => (
                <div key={d.n} className="col" style={{ gap: 6 }}>
                  <div className="between"><span style={{ fontWeight: 700 }}>{d.n}</span><b className="display num" style={{ fontSize: 20 }}>{fmt(kcal(d.m))} ккал</b></div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {(['Б', 'Ж', 'У'] as const).map((l, i) => (
                      <span key={l} style={{ background: 'rgba(255,255,255,.12)', borderTop: `3px solid ${['#4F8FE6', '#E2703A', '#2FA57D'][i]}`, borderRadius: 8, padding: '6px 8px', fontWeight: 800, fontSize: 14 }}>{l} {d.m[i]}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {reg ? <span className="muted" style={NOTE}>Желаемые калории можно будет поменять в профиле.</span> : null}
          </div>
        </div>
      ) : null}

      <div style={{ flex: 1 }} />
      {error ? <span className="err">{error}</span> : null}
      <button type="button" className="btn big" disabled={!okStep || busy} onClick={next}>{step < 2 ? 'Дальше' : reg ? 'Готово' : 'Сохранить'}</button>
    </div>
  );
}

const fmt1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');
