import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { kcal, suggestNorms } from '../lib/calc';
import { ageFrom } from '../lib/dates';
import { useRoute } from '../lib/router';
import { maskBirth, numIn, parseBirth, vBirth, vEmail, vHeight, vName, vPassword, vSteps, vWeight, years } from '../lib/validate';
import { ExerciseArt, FoodArt, Logo } from '../art';
import { Field } from '../ui';

type Goal = 'lose' | 'keep' | 'gain';

export function AuthScreen({ wide, onAuthed }: { wide: boolean; onAuthed: (token: string) => void }) {
  const r = useRoute();
  const mode = r[0] === 'register' ? 'register' : 'login';
  if (!wide) return <div className="page modal" style={{ minHeight: '100dvh', paddingTop: 'calc(40px + var(--safe-top))' }}>{mode === 'login' ? <Login onAuthed={onAuthed} /> : <Register onAuthed={onAuthed} />}</div>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', minHeight: '100dvh' }}>
      <section style={{ flex: '1 1 520px', background: '#2438C9', color: '#fff', padding: 56, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 32 }}>
        <div className="row" style={{ gap: 12 }}><Logo /><span className="display" style={{ fontSize: 26 }}>Подход</span></div>
        <h1 className="display" style={{ fontSize: 46, lineHeight: 1.08, maxWidth: 560 }}>Тренировки и питание в одном месте</h1>
        <div className="row" style={{ gap: 12 }}>
          <ExerciseArt kind="bench" size={96} /><ExerciseArt kind="squat" size={96} /><FoodArt kind="dish" size={96} />
        </div>
      </section>
      <section style={{ flex: '1 1 480px', padding: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="col" style={{ width: '100%', maxWidth: 400, gap: 16 }}>
          <div className="seg">
            <button aria-pressed={mode === 'login'} onClick={() => { location.hash = '#/login'; }}>Вход</button>
            <button aria-pressed={mode === 'register'} onClick={() => { location.hash = '#/register'; }}>Регистрация</button>
          </div>
          {mode === 'login' ? <Login onAuthed={onAuthed} wide /> : <Register onAuthed={onAuthed} wide />}
        </div>
      </section>
    </div>
  );
}

function Login({ onAuthed, wide }: { onAuthed: (t: string) => void; wide?: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bad, setBad] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setBad(null);
    try {
      const { token } = await api<{ token: string }>('POST', '/auth/login', { email, password });
      onAuthed(token);
    } catch (err) {
      setBad(err instanceof ApiError && err.code === 'network' ? 'Нет связи с сервером' : 'Неверная почта или пароль');
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="col" style={{ gap: 14, flex: 1 }}>
      {!wide ? <div className="row" style={{ gap: 12, marginBottom: 24 }}><Logo /><span className="display" style={{ fontSize: 26 }}>Подход</span></div> : null}
      {!wide ? <h1 className="h1" style={{ fontSize: 34, marginBottom: 10 }}>Вход</h1> : null}
      <Field label="Почта" id="li-email">
        <input id="li-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!bad} required />
      </Field>
      <Field label="Пароль" id="li-pass" error={bad}>
        <input id="li-pass" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!bad} required />
      </Field>
      <button className="btn big" style={{ marginTop: 6 }} disabled={busy || !email || !password}>Войти</button>
      {!wide ? (
        <p style={{ textAlign: 'center', marginTop: 'auto', paddingTop: 32 }}>
          <span className="muted">Нет аккаунта? </span><a className="link" href="#/register">Зарегистрироваться</a>
        </p>
      ) : null}
    </form>
  );
}

function Register({ onAuthed, wide }: { onAuthed: (t: string) => void; wide?: boolean }) {
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ name: '', email: '', password: '', password2: '', birth: '', weight: '', height: '', steps: '' });
  const [goal, setGoal] = useState<Goal>('gain');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverErr, setServerErr] = useState<{ field: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = k === 'birth' ? maskBirth(e.target.value) : e.target.value;
    setF((p) => ({ ...p, [k]: v })); setTouched((t) => ({ ...t, [k]: true }));
    if (serverErr?.field === k) setServerErr(null);
  };
  const e1 = {
    name: vName(f.name), email: serverErr?.field === 'email' ? serverErr.text : vEmail(f.email), password: vPassword(f.password),
    password2: f.password2 !== f.password ? 'Пароли не совпадают' : null,
  };
  const e2 = { birth: vBirth(f.birth), weight: vWeight(f.weight), height: vHeight(f.height), steps: vSteps(f.steps) };
  const show = (k: string, err: string | null) => (touched[k] ? err : null);
  const ok1 = !Object.values(e1).some(Boolean);
  const ok2 = !Object.values(e2).some(Boolean);
  const w = numIn(f.weight);
  const norms = suggestNorms(Number.isNaN(w) ? 75 : w, goal);
  const birthIso = parseBirth(f.birth);

  const submit = async () => {
    if (!ok2 || busy) return;
    setBusy(true);
    try {
      const { token } = await api<{ token: string }>('POST', '/auth/register', {
        email: f.email.trim(), password: f.password, name: f.name.trim(), birthDate: birthIso,
        weight: numIn(f.weight), height: numIn(f.height), steps: Number(f.steps.replace(/\s/g, '')), goal, norms,
      });
      onAuthed(token);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'email_taken') { setServerErr({ field: 'email', text: 'Эта почта уже занята' }); setStep(1); }
      else setServerErr({ field: 'form', text: err instanceof ApiError && err.code === 'network' ? 'Нет связи с сервером' : 'Не получилось создать аккаунт' });
    } finally { setBusy(false); }
  };

  const head = (
    <>
      <div className="between">
        {step === 1 ? (!wide ? <a className="link" href="#/login">‹ Вход</a> : <span />) : <button className="link" onClick={() => setStep(1)}>‹ Назад</button>}
        <span className="muted" style={{ fontWeight: 700 }}>Шаг {step} из 2</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <i style={{ height: 5, borderRadius: 3, background: 'var(--acc)' }} />
        <i style={{ height: 5, borderRadius: 3, background: step === 2 ? 'var(--acc)' : 'var(--track)' }} />
      </div>
    </>
  );

  if (step === 1) {
    return (
      <form className="col" style={{ gap: 18, flex: 1 }} onSubmit={(e) => { e.preventDefault(); if (ok1) setStep(2); else setTouched({ name: true, email: true, password: true, password2: true }); }}>
        {head}
        <h1 className="h1" style={{ fontSize: 30 }}>Новый аккаунт</h1>
        <Field label="Имя" id="r-name" error={show('name', e1.name)}><input id="r-name" className="input" autoComplete="given-name" value={f.name} onChange={set('name')} aria-invalid={!!show('name', e1.name)} /></Field>
        <Field label="Почта" id="r-email" error={show('email', e1.email) ?? (serverErr?.field === 'email' ? serverErr.text : null)}><input id="r-email" className="input" type="email" autoComplete="email" value={f.email} onChange={set('email')} aria-invalid={!!show('email', e1.email)} /></Field>
        <Field label="Пароль" id="r-pass" error={show('password', e1.password)}><input id="r-pass" className="input" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} aria-invalid={!!show('password', e1.password)} /></Field>
        <Field label="Пароль ещё раз" id="r-pass2" error={show('password2', e1.password2)}><input id="r-pass2" className="input" type="password" autoComplete="new-password" value={f.password2} onChange={set('password2')} aria-invalid={!!show('password2', e1.password2)} /></Field>
        <div style={{ flex: 1 }} />
        <button className="btn big" disabled={!ok1}>Создать аккаунт</button>
      </form>
    );
  }

  const small = (k: 'birth' | 'weight' | 'height' | 'steps', label: string, mode: 'numeric' | 'decimal', aside?: string | null) => (
    <div className="field">
      <label htmlFor={`r-${k}`} className="sub" style={{ fontSize: 13 }}><span>{label}</span></label>
      <input id={`r-${k}`} className="input" inputMode={mode} placeholder={k === 'birth' ? 'ДД.ММ.ГГГГ' : undefined} style={{ height: 50, borderRadius: 12, fontFamily: 'var(--display)', fontWeight: 800, fontSize: 18 }}
        value={f[k]} onChange={set(k)} aria-invalid={!!show(k, e2[k])} />
      <span className={show(k, e2[k]) ? 'err' : 'sub'} style={{ fontSize: 12, minHeight: 15 }}>{show(k, e2[k]) ?? aside ?? ''}</span>
    </div>
  );

  return (
    <div className="col" style={{ gap: 14 }}>
      {head}
      <h1 className="h1">О себе и цель</h1>
      <div className="seg">
        {([['lose', 'Похудеть'], ['keep', 'Держать'], ['gain', 'Набрать']] as const).map(([k, l]) => (
          <button key={k} aria-pressed={goal === k} onClick={() => setGoal(k)}>{l}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {small('birth', 'Дата рождения', 'numeric', birthIso && !e2.birth ? years(ageFrom(birthIso)) : null)}
        {small('weight', 'Вес, кг', 'decimal')}
        {small('height', 'Рост, см', 'numeric')}
        {small('steps', 'Шагов в день', 'numeric')}
      </div>
      <div className="card col" style={{ gap: 12 }}>
        {(['training', 'rest'] as const).map((t) => (
          <div key={t} className="col" style={{ gap: 8 }}>
            <div className="between"><span className="muted" style={{ fontSize: 14 }}>{t === 'training' ? 'День тренировки' : 'День отдыха'}</span>
              <span><b className="display num" style={{ fontSize: 24 }}>{kcal(norms[t]).toLocaleString('ru-RU')}</b> <span className="muted">ккал</span></span></div>
            {(['Белки', 'Жиры', 'Углеводы'] as const).map((n, i) => {
              const k = kcal(norms[t]) || 1, share = [4, 9, 4][i] * norms[t][i] / k * 100;
              return (
                <div key={n} style={{ display: 'grid', gridTemplateColumns: '84px 1fr 56px', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 14 }}>{n}</span>
                  <div className="bar" style={{ height: 10 }}><i className="a-fill" style={{ width: `${share}%`, background: ['var(--chart)', 'var(--warn)', 'var(--good)'][i] }} /></div>
                  <b className="num" style={{ textAlign: 'right' }}>{norms[t][i]} г</b>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {serverErr?.field === 'form' ? <span className="err">{serverErr.text}</span> : null}
      <button className="btn big" disabled={!ok2 || busy} onClick={submit}>Дальше</button>
    </div>
  );
}
