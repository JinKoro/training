import { useMemo } from 'react';
import { useApp } from '../app-context';
import { activeProgram, buildDays, type DayInfo } from './calc';
import { useQuery } from './query';
import type { Entry, Workout } from './types';
import type { Day } from './dates';

/** Days of a date range with norms, food totals and workouts. */
export function useDays(days: Day[]): { days: DayInfo[] | null; error: unknown; reload: () => void; entries: Entry[]; workouts: Workout[] } {
  const { me, programs } = useApp();
  const from = days[0], to = days[days.length - 1];
  const wq = useQuery<{ workouts: Workout[] }>(`/workouts?from=${from}&to=${to}`);
  const dq = useQuery<{ entries: Entry[] }>(`/diary?from=${from}&to=${to}`);
  const program = activeProgram(programs);
  const built = useMemo(() => {
    if (!wq.data || !dq.data) return null;
    return buildDays(days, me, program, wq.data.workouts, dq.data.entries);
  }, [wq.data, dq.data, me, program, days.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  return {
    days: built, error: wq.error ?? dq.error,
    reload: () => { void wq.reload(); void dq.reload(); },
    entries: dq.data?.entries ?? [], workouts: wq.data?.workouts ?? [],
  };
}
