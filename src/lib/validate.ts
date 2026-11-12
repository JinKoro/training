import { ageFrom, today } from './dates';

export const numIn = (s: string) => {
  const t = String(s).replace(/\s/g, '').replace(',', '.');
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
};

export const vName = (s: string) => (!s.trim() ? 'Как тебя зовут?' : s.trim().length > 100 ? 'Хватит и 100 символов' : null);
export const vEmail = (s: string) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim()) ? null : 'Похоже, в почте опечатка');
export const vPassword = (s: string) => (s.length < 8 ? 'Не меньше 8 символов' : s.length > 128 ? 'Не длиннее 128 символов' : null);
export const vWeight = (s: string) => {
  const n = numIn(s);
  return Number.isNaN(n) ? 'Только число, например 82,5' : n < 30 ? 'Меньше 30 кг? Проверь вес' : n > 300 ? 'Медведей не тренируем' : null;
};
export const vHeight = (s: string) => {
  const n = numIn(s);
  return Number.isNaN(n) ? 'Только число в сантиметрах' : n < 100 ? 'Меньше 100 см? Проверь рост' : n > 300 ? 'Дядя Стёпа, это вы?' : null;
};
export const vSteps = (s: string) => {
  const t = String(s).replace(/\s/g, '');
  return !/^\d+$/.test(t) ? 'Только целое число' : Number(t) > 150000 ? 'Столько можно пройти только без сна' : null;
};

/** "ДД.ММ.ГГГГ" -> "YYYY-MM-DD" or null */
export function parseBirth(s: string): string | null {
  const m = String(s).trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  if (d.getDate() !== +m[1] || d.getMonth() !== +m[2] - 1) return null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
export const birthToInput = (iso: string | null) => (iso ? iso.split('-').reverse().join('.') : '');

export function vBirth(s: string) {
  const iso = parseBirth(s);
  if (!iso) return 'Формат ДД.ММ.ГГГГ';
  if (iso > today()) return 'Ты ещё не родился';
  const a = ageFrom(iso);
  if (a < 12) return 'Приложение с 12 лет';
  if (a > 120) return 'Тебе уже вряд ли нужны тренировки';
  return null;
}

export const years = (a: number) =>
  `${a} ${a % 10 === 1 && a % 100 !== 11 ? 'год' : [2, 3, 4].includes(a % 10) && ![12, 13, 14].includes(a % 100) ? 'года' : 'лет'}`;

/** Masks digits into ДД.ММ.ГГГГ while typing. */
export function maskBirth(s: string) {
  const d = s.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('.');
}

export const vGrams = (s: string) => (/^\d{1,4}$/.test(String(s).trim()) && Number(s) <= 1000 ? null : 'Только целое число');
