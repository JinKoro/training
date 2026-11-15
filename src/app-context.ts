import { createContext, useContext } from 'react';
import type { Exercise, Me, Program } from './lib/types';

export interface AppCtx {
  me: Me;
  wide: boolean;
  exercises: Exercise[];
  exById: Map<number, Exercise>;
  programs: Program[];
  reloadMe: () => Promise<void>;
  logout: () => Promise<void>;
  /** The theme choice as picked on this device right now (the account copy follows after the request). */
  themePref: 'system' | 'light' | 'dark';
  setThemePref: (t: 'system' | 'light' | 'dark') => void;
}

export const AppContext = createContext<AppCtx | null>(null);
export const useApp = () => {
  const v = useContext(AppContext);
  if (!v) throw new Error('AppContext missing');
  return v;
};
