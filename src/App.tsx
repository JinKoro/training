import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './lib/api';
import { clearCache, invalidate, useQuery } from './lib/query';
import { go, useRoute } from './lib/router';
import { ThemeContext, readStoredPref, storePref, useResolvedTheme, type ThemePref } from './lib/theme';
import type { Exercise, Me, Program } from './lib/types';
import { AppContext, useApp, type AppCtx } from './app-context';
import { Icon, Logo, LOGOUT_ICON_D, SIDEBAR_ITEMS, TAB_ICONS } from './art';
import { ErrorBox, Skeleton } from './ui';
import { AuthScreen } from './screens/Auth';
import { WeekScreen, WeekMacrosScreen } from './screens/Week';
import { CalendarScreen } from './screens/Calendar';
import { DayScreen } from './screens/Day';
import { WorkoutFlow } from './screens/WorkoutFlow';
import { SummaryScreen } from './screens/Summary';
import { WorkoutEditScreen, WorkoutsScreen } from './screens/WorkoutEdit';
import { SportScreen, ProgramScreen } from './screens/Sport';
import { ProgramEditorScreen } from './screens/ProgramEditor';
import { ExerciseFormScreen, LibraryScreen } from './screens/Exercises';
import { LogScreen } from './screens/Log';
import { FoodScreen } from './screens/Food';
import { AddFoodScreen, DishNewScreen, ItemScreen, ProductNewScreen, ScanScreen } from './screens/FoodAdd';
import { NormsScreen, PasswordScreen, ProfileEditScreen, ProfileScreen, RecalcScreen } from './screens/Profile';

function useWide() {
  const q = '(min-width: 900px)';
  const [wide, setWide] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

export default function App() {
  const [token, setTok] = useState(getToken());
  const [pref, setPref] = useState<ThemePref>(readStoredPref());
  const theme = useResolvedTheme(pref);
  const wide = useWide();

  useEffect(() => setUnauthorizedHandler(() => { clearCache(); setTok(null); }), []);

  const onAuthed = (t: string) => { setToken(t); clearCache(); setTok(t); go('week'); };

  return (
    <ThemeContext.Provider value={theme}>
      {token ? <Authed wide={wide} setPref={(p) => { setPref(p); storePref(p); }} onLogout={() => { setToken(null); clearCache(); setTok(null); go('login'); }} />
        : <AuthScreen wide={wide} onAuthed={onAuthed} />}
    </ThemeContext.Provider>
  );
}

function Authed({ wide, setPref, onLogout }: { wide: boolean; setPref: (p: ThemePref) => void; onLogout: () => void }) {
  const meQ = useQuery<Me>('/me');
  const exQ = useQuery<{ exercises: Exercise[] }>('/exercises');
  const prQ = useQuery<{ programs: Program[] }>('/programs');

  useEffect(() => { if (meQ.data) setPref(meQ.data.user.theme); }, [meQ.data?.user.theme]); // eslint-disable-line react-hooks/exhaustive-deps

  const logout = useCallback(async () => {
    try { await api('POST', '/auth/logout'); } catch { /* ignore */ }
    onLogout();
  }, [onLogout]);

  const ctx = useMemo<AppCtx | null>(() => {
    if (!meQ.data || !exQ.data || !prQ.data) return null;
    const exercises = exQ.data.exercises;
    return {
      me: meQ.data, wide, exercises, exById: new Map(exercises.map((e) => [e.id, e])), programs: prQ.data.programs,
      reloadMe: () => meQ.reload(), logout,
      setThemePref: (t) => {
        setPref(t);
        void api('PATCH', '/me', { theme: t }).then(() => invalidate('/me')).catch(() => {});
      },
    };
  }, [meQ.data, exQ.data, prQ.data, wide, logout]); // eslint-disable-line react-hooks/exhaustive-deps

  const err = meQ.error ?? exQ.error ?? prQ.error;
  if (!ctx) {
    return (
      <div className="page modal" style={{ paddingTop: 60 }}>
        {err ? <ErrorBox error={err} retry={() => { void meQ.reload(); void exQ.reload(); void prQ.reload(); }} /> : <Skeleton n={4} />}
      </div>
    );
  }
  return (
    <AppContext.Provider value={ctx}>
      <Shell />
    </AppContext.Provider>
  );
}

/** Which nav item is active for a route, and whether the tab bar is shown on phone. */
function navFor(r: string[]): { tab: string | null; side: string; bar: boolean } {
  const s = r[0] ?? 'week';
  if (s === 'week' || s === '') return { tab: 'week', side: 'week', bar: true };
  if (s === 'calendar') return { tab: 'week', side: 'calendar', bar: true };
  if (s === 'week-macros') return { tab: 'week', side: 'week', bar: false };
  if (s === 'sport') return { tab: 'plan', side: 'plan', bar: true };
  if (s === 'program') return { tab: 'plan', side: 'plan', bar: r[1] !== 'new' && r[2] !== 'edit' };
  if (s === 'exercises') return { tab: 'plan', side: 'library', bar: true };
  if (s === 'exercise') return { tab: 'plan', side: 'library', bar: false };
  if (s === 'log' || s === 'summary') return { tab: 'log', side: 'log', bar: s === 'log' };
  if (s === 'workouts' || s === 'workout-edit') return { tab: 'log', side: 'workout', bar: false };
  if (s === 'day') return { tab: 'week', side: 'workout', bar: false };
  if (s === 'food') return { tab: 'food', side: 'food', bar: r.length <= 2 };
  if (s === 'profile') return { tab: 'me', side: 'profile', bar: r.length === 1 };
  return { tab: null, side: '', bar: false };
}

function Shell() {
  const { wide } = useApp();
  const r = useRoute();
  const nav = navFor(r);
  const fullscreen = r[0] === 'workout';
  const content = <Routes r={r} />;
  if (fullscreen && wide) return content;
  if (fullscreen) return <div className="shell-m"><div className="scroller">{content}</div></div>;
  if (wide) {
    return (
      <div className="shell-d">
        <Sidebar active={nav.side} />
        <main>{content}</main>
      </div>
    );
  }
  return (
    <div className={`shell-m ${nav.bar ? 'has-bar' : ''}`}>
      <div className="scroller">{content}</div>
      {nav.bar ? <TabBar active={nav.tab} /> : null}
    </div>
  );
}


function Routes({ r }: { r: string[] }) {
  const [a, b, c, d, e] = r;
  switch (a) {
    case undefined: case '': case 'week': return <WeekScreen offset={Number(b) || 0} />;
    case 'week-macros': return <WeekMacrosScreen offset={Number(b) || 0} />;
    case 'calendar': return <CalendarScreen date={b} />;
    case 'day': return <DayScreen date={b} />;
    case 'workout': return <WorkoutFlow id={Number(b)} />;
    case 'summary': return <SummaryScreen id={Number(b)} back={c} />;
    case 'workout-edit': return <WorkoutEditScreen id={Number(b)} back={c} />;
    case 'workouts': return <WorkoutsScreen selected={Number(b) || null} />;
    case 'sport': return <SportScreen />;
    case 'program':
      if (b === 'new') return <ProgramEditorScreen mode="new" />;
      if (c === 'edit') return <ProgramEditorScreen mode="edit" id={Number(b)} />;
      return <ProgramScreen id={Number(b)} />;
    case 'exercises': return <LibraryScreen mine={b === 'mine'} selected={Number(c) || null} />;
    case 'exercise':
      if (b === 'new') return <ExerciseFormScreen />;
      return <ExerciseFormScreen id={Number(b)} />;
    case 'log': return <LogScreen />;
    case 'food':
      if (c === 'add') return <AddFoodScreen date={b} meal={d} />;
      if (c === 'item') return <ItemScreen date={b} type={d as 'product' | 'dish'} id={Number(e)} meal={r[5]} />;
      if (c === 'new-product') return <ProductNewScreen date={b} meal={d} barcode={e} />;
      if (c === 'dish') return <DishNewScreen date={b} meal={d} from={e} />;
      if (c === 'scan') return <ScanScreen date={b} meal={d} />;
      return <FoodScreen date={b} />;
    case 'profile':
      if (b === 'edit') return <ProfileEditScreen />;
      if (b === 'norms') return <NormsScreen />;
      if (b === 'recalc') return <RecalcScreen />;
      if (b === 'password') return <PasswordScreen />;
      return <ProfileScreen />;
    default: return <WeekScreen offset={0} />;
  }
}

const TABS: [string, string, string][] = [['week', 'Неделя', '#/week'], ['plan', 'Спорт', '#/sport'], ['food', 'Еда', '#/food'], ['log', 'Журнал', '#/log'], ['me', 'Профиль', '#/profile']];

function TabBar({ active }: { active: string | null }) {
  return (
    <nav className="tabbar" aria-label="Разделы">
      {TABS.map(([k, label, to]) => (
        <a key={k} href={to} aria-current={active === k ? 'page' : undefined}>
          <span><Icon html={(TAB_ICONS as Record<string, string>)[k]} /></span>{label}
        </a>
      ))}
    </nav>
  );
}

const SIDE_HREF: Record<string, string> = {
  week: '#/week', calendar: '#/calendar', workout: '#/workouts', plan: '#/sport', library: '#/exercises', log: '#/log', food: '#/food', profile: '#/profile',
};

function Sidebar({ active }: { active: string }) {
  const { me, logout } = useApp();
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('podhod-side') === '1'; } catch { return false; } });
  const toggle = () => setCollapsed((v) => { try { localStorage.setItem('podhod-side', v ? '0' : '1'); } catch { /* */ } return !v; });
  return (
    <nav className={`sidebar ${collapsed ? 'collapsed' : ''}`} aria-label="Разделы">
      <div className="between" style={{ padding: '0 4px 18px', flexDirection: collapsed ? 'column' : 'row' }}>
        {!collapsed ? <div className="row"><Logo size={32} /><span className="display" style={{ fontSize: 19 }}>Подход</span></div> : null}
        <button className="icon-btn" style={{ background: 'var(--sub)' }} onClick={toggle} aria-expanded={!collapsed} aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}>{collapsed ? '›' : '‹'}</button>
      </div>
      {(SIDEBAR_ITEMS as [string, string, string, string][]).map(([k, label, , d]) => (
        <a key={k} href={SIDE_HREF[k]} aria-current={active === k ? 'page' : undefined} title={collapsed ? label : undefined}>
          <Icon d={d} size={20} />{collapsed ? null : label}
        </a>
      ))}
      <div style={{ flex: 1 }} />
      <button className="side-btn muted" onClick={() => void logout()} title="Выйти">
        <Icon d={LOGOUT_ICON_D} size={20} />{collapsed ? null : `Выйти · ${me.profile.name ?? ''}`}
      </button>
    </nav>
  );
}
