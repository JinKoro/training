/** Dates are local calendar days encoded as "YYYY-MM-DD". Weeks start on Monday. */
export type Day = string;

const pad = (n: number) => String(n).padStart(2, '0');
export const toDay = (d: Date): Day => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromDay = (s: Day): Date => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const today = (): Day => toDay(new Date());
export const addDays = (s: Day, n: number): Day => { const d = fromDay(s); d.setDate(d.getDate() + n); return toDay(d); };
export const diffDays = (a: Day, b: Day): number => Math.round((fromDay(a).getTime() - fromDay(b).getTime()) / 86_400_000);
/** 0 = Monday … 6 = Sunday */
export const weekdayIdx = (s: Day): number => (fromDay(s).getDay() + 6) % 7;
export const weekStart = (s: Day): Day => addDays(s, -weekdayIdx(s));
export const weekDays = (start: Day): Day[] => Array.from({ length: 7 }, (_, i) => addDays(start, i));

export const WD_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const WD_LONG = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
export const WD_CAP = WD_LONG.map((w) => w[0].toUpperCase() + w.slice(1));
export const MONTH_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const MONTH_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

export const dayMonth = (s: Day) => { const d = fromDay(s); return `${d.getDate()} ${MONTH_GEN[d.getMonth()]}`; };

export function ageFrom(birth: Day, on: Day = today()): number {
  const b = fromDay(birth), t = fromDay(on);
  let age = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) age -= 1;
  return age;
}

/** Russian plural: plural(5, ['раз', 'раза', 'раз']) */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

export const fmtNum = (n: number, digits = 1) =>
  Number.isInteger(n) ? String(n) : digits <= 0 ? String(Math.round(n)) : n.toFixed(digits).replace(/\.?0+$/, '').replace('.', ',');
export const parseNum = (s: string): number => Number(String(s).replace(',', '.').trim());

/** A real calendar date in YYYY-MM-DD (2026-02-30 is not: Date would roll it over). */
export const isDayStr = (s: string | undefined): s is Day => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(fromDay(s).getTime()) && toDay(fromDay(s)) === s;
