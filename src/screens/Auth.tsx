import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useRoute } from '../lib/router';
import { vEmail, vName, vPassword } from '../lib/validate';
import { EnergyFlow, emptyEnergyForm, type EnergyForm, type EnergyResult } from './Energy';
import { ExerciseArt, FoodArt, Logo } from '../art';
import { Field } from '../ui';

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
        <div className="col" style={{ marginTop: 'auto', paddingTop: 32, gap: 8, textAlign: 'center' }}>
          <span className="muted">Нет аккаунта?</span>
          <a className="btn sec" href="#/register" style={{ height: 48, borderRadius: 14, fontSize: 15 }}>Зарегистрироваться</a>
        </div>
      ) : null}
    </form>
  );
}

function Register({ onAuthed, wide }: { onAuthed: (t: string) => void; wide?: boolean }) {
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ name: '', email: '', password: '', password2: '' });
  const [init] = useState<EnergyForm>(emptyEnergyForm);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverErr, setServerErr] = useState<{ field: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setF((p) => ({ ...p, [k]: e.target.value })); setTouched((t) => ({ ...t, [k]: true }));
    if (serverErr?.field === k) setServerErr(null);
  };
  const e1 = {
    name: vName(f.name), email: serverErr?.field === 'email' ? serverErr.text : vEmail(f.email), password: vPassword(f.password),
    password2: f.password2 !== f.password ? 'Пароли не совпадают' : null,
  };
  const show = (k: string, err: string | null) => (touched[k] ? err : null);
  const ok1 = !Object.values(e1).some(Boolean);

  const submit = async (r: EnergyResult) => {
    if (busy) return;
    setBusy(true); setServerErr(null);
    try {
      const { token } = await api<{ token: string }>('POST', '/auth/register', {
        email: f.email.trim(), password: f.password, name: f.name.trim(), ...r.profile, goal: r.goal, norms: r.norms,
      });
      onAuthed(token);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'email_taken') { setServerErr({ field: 'email', text: 'Эта почта уже занята' }); setStep(1); }
      else setServerErr({ field: 'form', text: err instanceof ApiError && err.code === 'network' ? 'Нет связи с сервером' : 'Не получилось создать аккаунт' });
    } finally { setBusy(false); }
  };

  // The body-data steps stay mounted after the first visit, so going back to step 1 keeps what was typed there.
  const [visited, setVisited] = useState(false);
  const flow = visited ? (
    <div className="col" style={{ flex: 1, display: step === 2 ? 'flex' : 'none' }}>
      <EnergyFlow mode="register" init={init} wide={!!wide} busy={busy} error={serverErr?.field === 'form' ? serverErr.text : null}
        onBack={() => setStep(1)} onDone={(r) => void submit(r)} />
    </div>
  ) : null;
  return (
    <>
    {flow}
    {step === 1 ? <form className="col" style={{ gap: 18, flex: 1 }} onSubmit={(e) => { e.preventDefault(); if (ok1) { setVisited(true); setStep(2); } else setTouched({ name: true, email: true, password: true, password2: true }); }}>
      <div className="between">
        {!wide ? <a className="link" href="#/login">‹ Вход</a> : <span />}
        <span className="muted" style={{ fontWeight: 700 }}>Шаг 1 из 4</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {[0, 1, 2, 3].map((i) => <i key={i} style={{ height: 5, borderRadius: 3, background: i === 0 ? 'var(--acc)' : 'var(--track)' }} />)}
      </div>
      <h1 className="h1" style={{ fontSize: 30 }}>Новый аккаунт</h1>
      <Field label="Имя" id="r-name" error={show('name', e1.name)}><input id="r-name" className="input" autoComplete="given-name" value={f.name} onChange={set('name')} aria-invalid={!!show('name', e1.name)} /></Field>
      <Field label="Почта" id="r-email" error={show('email', e1.email) ?? (serverErr?.field === 'email' ? serverErr.text : null)}><input id="r-email" className="input" type="email" autoComplete="email" value={f.email} onChange={set('email')} aria-invalid={!!show('email', e1.email)} /></Field>
      <Field label="Пароль" id="r-pass" error={show('password', e1.password)}><input id="r-pass" className="input" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} aria-invalid={!!show('password', e1.password)} /></Field>
      <Field label="Пароль ещё раз" id="r-pass2" error={show('password2', e1.password2)}><input id="r-pass2" className="input" type="password" autoComplete="new-password" value={f.password2} onChange={set('password2')} aria-invalid={!!show('password2', e1.password2)} /></Field>
      <div style={{ flex: 1 }} />
      <button className="btn big" disabled={!ok1}>Создать аккаунт</button>
    </form> : null}
    </>
  );
}
