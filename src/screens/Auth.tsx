import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useRoute } from '../lib/router';
import { vEmail, vName, vPassword } from '../lib/validate';
import { EnergyFlow, emptyEnergyForm, type EnergyForm, type EnergyResult } from './Energy';
import { ExerciseArt, FoodArt, Logo } from '../art';
import { Beta, Field, PasswordInput } from '../ui';

const standalone = () => (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches;

/** Login hint: install to the home screen (phone, in the browser) or there is a phone version (desktop). */
function InstallHint({ wide }: { wide?: boolean }) {
  if (!wide && standalone()) return null;
  return (
    <div className="card row" style={{ gap: 12, alignItems: 'flex-start', borderRadius: 20, padding: '12px 14px' }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}><path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" /></svg>
      <span style={{ fontSize: 14, lineHeight: 1.4, textAlign: 'left' }}>
        {wide
          ? <><b>Есть версия для телефона.</b> <span className="muted">Откройте этот адрес в Safari на iPhone и нажмите «Поделиться» → «На экран „Домой“».</span></>
          : <><b>Установите на экран «Домой».</b> <span className="muted">В Safari нажмите «Поделиться» → «На экран „Домой“». Приложение откроется на весь экран, а таймер отдыха будет присылать уведомления.</span></>}
      </span>
    </div>
  );
}

export function AuthScreen({ wide, onAuthed }: { wide: boolean; onAuthed: (token: string) => void }) {
  const r = useRoute();
  const mode = r[0] === 'register' ? 'register' : 'login';
  if (!wide) return <div className="page modal" style={{ minHeight: '100dvh', paddingTop: 'calc(40px + var(--safe-top))' }}>{mode === 'login' ? <Login onAuthed={onAuthed} /> : <Register onAuthed={onAuthed} />}</div>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', minHeight: '100dvh' }}>
      <section style={{ flex: '1 1 520px', background: 'var(--hero)', color: '#fff', padding: 56, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 32 }}>
        <div className="row" style={{ gap: 12 }}><Logo /><span className="display" style={{ fontSize: 26 }}>Подход</span><Beta color="#fff" /></div>
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
      {!wide ? <div className="row" style={{ gap: 12, marginBottom: 24 }}><Logo /><span className="display" style={{ fontSize: 26 }}>Подход</span><Beta /></div> : null}
      {!wide ? <h1 className="h1" style={{ fontSize: 34, marginBottom: 10 }}>Вход</h1> : null}
      <Field label="Почта" id="li-email">
        <input id="li-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!bad} required />
      </Field>
      <Field label="Пароль" id="li-pass" error={bad}>
        <PasswordInput id="li-pass" autoComplete="current-password" value={password} onChange={setPassword} invalid={!!bad} required />
      </Field>
      <button className="btn big" style={{ marginTop: 6 }} disabled={busy || !email || !password}>Войти</button>
      {wide ? <div style={{ marginTop: 8 }}><InstallHint wide /></div> : null}
      {!wide ? (
        <div className="col" style={{ marginTop: 'auto', paddingTop: 32, gap: 8, textAlign: 'center' }}>
          <div style={{ marginBottom: 6 }}><InstallHint /></div>
          <span className="muted">Нет аккаунта?</span>
          <a className="btn sec" href="#/register" style={{ height: 48, borderRadius: 18, fontSize: 15 }}>Зарегистрироваться</a>
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
      <Field label="Пароль" id="r-pass" error={show('password', e1.password)}><PasswordInput id="r-pass" autoComplete="new-password" value={f.password} onChange={(v) => set('password')({ target: { value: v } } as React.ChangeEvent<HTMLInputElement>)} invalid={!!show('password', e1.password)} /></Field>
      <Field label="Пароль ещё раз" id="r-pass2" error={show('password2', e1.password2)}><PasswordInput id="r-pass2" autoComplete="new-password" value={f.password2} onChange={(v) => set('password2')({ target: { value: v } } as React.ChangeEvent<HTMLInputElement>)} invalid={!!show('password2', e1.password2)} /></Field>
      <div style={{ flex: 1 }} />
      <button className="btn big" disabled={!ok1}>Создать аккаунт</button>
    </form> : null}
    </>
  );
}
