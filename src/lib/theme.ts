import { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

const KEY = 'podhod-theme';
const media = () => window.matchMedia('(prefers-color-scheme: light)');

export function readStoredPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch { /* ignore */ }
  return 'light';
}

export function storePref(p: ThemePref) {
  try { localStorage.setItem(KEY, p); } catch { /* ignore */ }
}

/** Resolves the preference to a concrete theme and applies it to <html>. */
export function useResolvedTheme(pref: ThemePref): Theme {
  const [system, setSystem] = useState<Theme>(() => (media().matches ? 'light' : 'dark'));
  useEffect(() => {
    const m = media();
    const on = () => setSystem(m.matches ? 'light' : 'dark');
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  const theme = pref === 'system' ? system : pref;
  useLayoutEffect(() => {
    // Buttons animate their background (press feedback); without this they would fade into the new theme
    // 0.15 s after everything else and look like they lag behind the switch.
    const root = document.documentElement;
    root.classList.add('theme-switch');
    root.dataset.theme = theme;
    void root.offsetHeight; // apply the new colours with transitions off
    const id = requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switch')));
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#F6F5F2' : '#26272A');
    return () => { cancelAnimationFrame(id); root.classList.remove('theme-switch'); };
  }, [theme]);
  return theme;
}

export const ThemeContext = createContext<Theme>('light');
export const useTheme = () => useContext(ThemeContext);
