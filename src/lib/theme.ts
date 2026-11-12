import { createContext, useContext, useEffect, useState } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

const KEY = 'podhod-theme';
const media = () => window.matchMedia('(prefers-color-scheme: light)');

export function readStoredPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch { /* ignore */ }
  return 'system';
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
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#F3F5F8' : '#171B21');
  }, [theme]);
  return theme;
}

export const ThemeContext = createContext<Theme>('dark');
export const useTheme = () => useContext(ThemeContext);
