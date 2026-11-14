import { fail } from './http.js';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDay(value) {
  if (typeof value !== 'string' || !DAY_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function day(value, field) {
  if (!isDay(value)) fail(400, 'invalid_date', field);
  return value;
}

export function str(value, field, { min = 0, max = 200, optional = false } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return null;
  if (typeof value !== 'string') fail(400, 'invalid_string', field);
  const v = value.trim();
  if (v.length < min || v.length > max) fail(400, 'invalid_length', field);
  return v;
}

export function num(value, field, { min = -Infinity, max = Infinity, int = false, optional = false } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return null;
  // Strings must be plain decimals («12», «82,5»): "" or spaces are not 0, "0x10" is not 16.
  if (typeof value === 'string' && !/^\s*-?\d+([.,]\d+)?\s*$/.test(value)) fail(400, 'invalid_number', field);
  const n = typeof value === 'string' ? Number(value.trim().replace(',', '.')) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max || (int && !Number.isInteger(n))) {
    fail(400, 'invalid_number', field);
  }
  return n;
}

export function oneOf(value, field, options) {
  if (!options.includes(value)) fail(400, 'invalid_option', field);
  return value;
}

export function arr(value, field, { max = 1000 } = {}) {
  if (!Array.isArray(value) || value.length > max) fail(400, 'invalid_array', field);
  return value;
}

export function macros(value, field) {
  const a = arr(value, field, { max: 3 });
  if (a.length !== 3) fail(400, 'invalid_array', field);
  return a.map((x) => num(x, field, { min: 0, max: 1000, int: true }));
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
