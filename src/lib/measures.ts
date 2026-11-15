import type { Sex } from './types';
import { diffDays, type Day } from './dates';

export type MetricKey = 'weight' | 'bodyFat' | 'neck' | 'chest' | 'shoulders' | 'waist' | 'belly' | 'hips' | 'thigh' | 'calf' | 'arm';
export interface MEntry { date: Day; metric: MetricKey; value: number }

export interface Metric {
  key: MetricKey; name: string; unit: string;
  /** Where to put the tape, by sex. */
  hint: Record<Sex, string>;
  /** A decrease is the good direction (shown green) — for women the thigh too. */
  downGood: Record<Sex, boolean>;
}

const both = (s: string) => ({ m: s, f: s });
const yes = { m: true, f: true }, no = { m: false, f: false };

export const METRICS: Metric[] = [
  { key: 'weight', name: 'Вес', unit: 'кг', hint: both(''), downGood: yes },
  { key: 'bodyFat', name: 'Процент жира', unit: '%', hint: both(''), downGood: yes },
  { key: 'neck', name: 'Шея', unit: 'см', hint: { m: 'под кадыком', f: 'под гортанью' }, downGood: no },
  { key: 'chest', name: 'Грудь', unit: 'см', hint: { m: 'по соскам', f: 'по самым выступающим точкам' }, downGood: no },
  { key: 'shoulders', name: 'Плечи', unit: 'см', hint: both('по самым широким точкам'), downGood: no },
  { key: 'waist', name: 'Талия', unit: 'см', hint: both('самое узкое место'), downGood: yes },
  { key: 'belly', name: 'Живот', unit: 'см', hint: both('по пупку'), downGood: yes },
  { key: 'hips', name: 'Ягодицы', unit: 'см', hint: both('самое широкое место'), downGood: yes },
  { key: 'thigh', name: 'Бедро', unit: 'см', hint: both('под ягодицей'), downGood: { m: false, f: true } },
  { key: 'calf', name: 'Голень', unit: 'см', hint: both('самое широкое место'), downGood: no },
  { key: 'arm', name: 'Рука', unit: 'см', hint: both('бицепс, расслабленный'), downGood: no },
];
export const metricOf = (k: string | undefined) => METRICS.find((m) => m.key === k);
export const CIRCS = METRICS.slice(2);

export const f1 = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

/** One metric's entries, oldest first. */
export const seriesOf = (all: MEntry[], k: MetricKey) => all.filter((e) => e.metric === k).sort((a, b) => (a.date < b.date ? -1 : 1));

/** «↓ 1,5» / «↑ 0,5» / «—»; null when there is nothing to compare with. */
export function change(d: number | null): string | null {
  if (d == null) return null;
  const r = Math.round(d * 10) / 10;
  return r === 0 ? '—' : `${r > 0 ? '↑' : '↓'} ${f1(Math.abs(r))}`;
}

/** The latest value and its change since the previous entry, per metric. */
export function latest(all: MEntry[]) {
  const out = {} as Record<MetricKey, { value: number; date: Day; delta: number | null } | undefined>;
  for (const m of METRICS) {
    const s = seriesOf(all, m.key);
    const last = s[s.length - 1];
    out[m.key] = last ? { value: last.value, date: last.date, delta: s.length > 1 ? last.value - s[s.length - 2].value : null } : undefined;
  }
  return out;
}

export const PERIODS: { n: string; days: number; label: string }[] = [
  { n: 'Месяц', days: 31, label: 'за месяц' }, { n: '3 мес', days: 92, label: 'за 3 месяца' },
  { n: 'Год', days: 366, label: 'за год' }, { n: 'Всё', days: Infinity, label: 'за всё время' },
];
export const inPeriod = (s: MEntry[], days: number, on: Day) => s.filter((e) => diffDays(on, e.date) <= days);
