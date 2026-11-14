import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addDays, ageFrom, dayMonth, diffDays, fmtNum, fromDay, isDayStr, parseNum, plural, toDay, today, WD_CAP, weekDays, weekdayIdx, weekStart,
} from '../../src/lib/dates';
import {
  birthToInput, intIn, maskBirth, numIn, parseBirth, vBirth, vEmail, vFat, vGrams, vHeight, vKcal, vMinutes, vName, vPassword, vSteps, vWeight, years,
} from '../../src/lib/validate';

describe('dates', () => {
  it('toDay / fromDay round-trip', () => {
    expect(toDay(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(fromDay('2026-03-29').getDate()).toBe(29);
    expect(toDay(fromDay('2024-02-29'))).toBe('2024-02-29');
  });
  it('addDays across months, years, leap day, DST', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-01-01', 0)).toBe('2026-01-01');
    expect(addDays('2026-01-01', 365)).toBe('2027-01-01');
  });
  it('diffDays is DST-free', () => {
    expect(diffDays('2026-03-30', '2026-03-29')).toBe(1);
    expect(diffDays('2026-10-26', '2026-10-25')).toBe(1);
    expect(diffDays('2026-04-01', '2026-03-01')).toBe(31);
    expect(diffDays('2026-01-01', '2027-01-01')).toBe(-365);
    expect(diffDays('2025-01-01', '2024-01-01')).toBe(366);
  });
  it('weekdayIdx Monday=0 … Sunday=6; weekStart is Monday', () => {
    expect(weekdayIdx('2026-11-02')).toBe(0);
    expect(weekdayIdx('2026-11-08')).toBe(6);
    expect(weekStart('2026-11-08')).toBe('2026-11-02'); // Sunday belongs to the week before
    expect(weekStart('2026-11-09')).toBe('2026-11-09');
    expect(weekStart('2027-01-01')).toBe('2026-12-28');
    expect(weekStart('2026-03-29')).toBe('2026-03-23');
  });
  it('weekDays', () => {
    expect(weekDays('2026-12-28')).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
  });
  it('dayMonth / WD_CAP', () => {
    expect(dayMonth('2026-03-08')).toBe('8 марта');
    expect(WD_CAP[6]).toBe('Воскресенье');
  });
  it('ageFrom incl. leap birthdays', () => {
    expect(ageFrom('2000-05-10', '2026-05-09')).toBe(25);
    expect(ageFrom('2000-05-10', '2026-05-10')).toBe(26);
    expect(ageFrom('2000-02-29', '2001-02-28')).toBe(0); // pinned: leap-day births age on 1 March
    expect(ageFrom('2000-02-29', '2001-03-01')).toBe(1);
    expect(ageFrom('2000-02-29', '2004-02-29')).toBe(4);
    expect(ageFrom('2000-12-31', '2001-01-01')).toBe(0);
  });
  it('today uses the local date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 14, 23, 59));
    expect(today()).toBe('2026-11-14');
    vi.useRealTimers();
  });
  it('plural', () => {
    const f: [string, string, string] = ['день', 'дня', 'дней'];
    expect([0, 1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111, 112, -1, -3].map((n) => plural(n, f))).toEqual([
      'дней', 'день', 'дня', 'дня', 'дней', 'дней', 'дней', 'дней', 'день', 'дня', 'дней', 'день', 'дней', 'дней', 'день', 'дня',
    ]);
  });
  it('fmtNum', () => {
    expect(fmtNum(5)).toBe('5');
    expect(fmtNum(82.5)).toBe('82,5');
    expect(fmtNum(82.04)).toBe('82');
    expect(fmtNum(100.04)).toBe('100');
    expect(fmtNum(1.25, 2)).toBe('1,25');
    expect(fmtNum(1.50001, 2)).toBe('1,5');
  });
  // fixed: with digits=0 the trailing-zero regex eats integer zeros: fmtNum(10.4, 0) → "1"
  it('fmtNum with 0 digits keeps integer zeros', () => expect(fmtNum(10.4, 0)).toBe('10'));
  it('fmtNum of a tiny value', () => expect(fmtNum(0.04)).toBe('0'));
  it('parseNum', () => {
    expect(parseNum('82,5')).toBe(82.5);
    expect(parseNum(' 7 ')).toBe(7);
    expect(parseNum('')).toBe(0); // pinned: empty → 0, not NaN
    expect(Number.isNaN(parseNum('abc'))).toBe(true);
  });
  it('isDayStr', () => {
    expect(isDayStr('2026-11-14')).toBe(true);
    expect(isDayStr(undefined)).toBe(false);
    expect(isDayStr('')).toBe(false);
    expect(isDayStr('2026-1-14')).toBe(false);
    expect(isDayStr('14.11.2026')).toBe(false);
  });
  // fixed: impossible dates pass because new Date(2026, 1, 30) rolls over to 2 March
  it('isDayStr rejects 2026-02-30', () => expect(isDayStr('2026-02-30')).toBe(false));
  it('isDayStr rejects month 13', () => expect(isDayStr('2026-13-01')).toBe(false));
});

describe('validate', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 14, 12)); });
  afterEach(() => vi.useRealTimers());

  it('numIn', () => {
    expect(numIn('82,5')).toBe(82.5);
    expect(numIn('1 000')).toBe(1000);
    expect(numIn('82.5')).toBe(82.5);
    expect(numIn('-5')).toBeNaN();
    expect(numIn('.5')).toBeNaN();
    expect(numIn('')).toBeNaN();
    expect(numIn('1,2,3')).toBeNaN();
  });
  it('vName / vEmail / vPassword', () => {
    expect(vName('  ')).toBe('Как вас зовут?');
    expect(vName('Ян')).toBeNull();
    expect(vName('a'.repeat(101))).toBe('Хватит и 100 символов');
    expect(vName(' ' + 'a'.repeat(100) + ' ')).toBeNull();
    expect(vEmail('a@b.ru')).toBeNull();
    expect(vEmail(' a@b.ru ')).toBeNull();
    expect(vEmail('a@b.r')).not.toBeNull();
    expect(vEmail('a b@c.ru')).not.toBeNull();
    expect(vEmail('ab.ru')).not.toBeNull();
    expect(vPassword('1234567')).not.toBeNull();
    expect(vPassword('12345678')).toBeNull();
    expect(vPassword('x'.repeat(128))).toBeNull();
    expect(vPassword('x'.repeat(129))).not.toBeNull();
  });
  it('vWeight / vHeight / vFat boundaries', () => {
    expect(vWeight('30')).toBeNull();
    expect(vWeight('29,9')).toBe('Меньше 30 кг? Проверьте вес');
    expect(vWeight('300')).toBeNull();
    expect(vWeight('300,1')).toBe('Медведей не тренируем');
    expect(vWeight('abc')).toBe('Только число, например 82,5');
    expect(vHeight('100')).toBeNull();
    expect(vHeight('99')).not.toBeNull();
    expect(vHeight('301')).not.toBeNull();
    expect(vFat('3')).toBeNull();
    expect(vFat('2,9')).not.toBeNull();
    expect(vFat('60')).toBeNull();
    expect(vFat('61')).not.toBeNull();
    expect(vFat('-5')).toBe('Число, например 18');
  });
  it('vSteps / vMinutes / vKcal / intIn', () => {
    expect(vSteps('10 000')).toBeNull();
    expect(vSteps('0')).toBeNull();
    expect(vSteps('150000')).toBeNull();
    expect(vSteps('150001')).not.toBeNull();
    expect(vSteps('1,5')).toBe('Только целое число');
    expect(vSteps('')).toBe('Только целое число');
    expect(vMinutes('10')).toBeNull();
    expect(vMinutes('9')).not.toBeNull();
    expect(vMinutes('300')).toBeNull();
    expect(vMinutes('301')).not.toBeNull();
    expect(vKcal('0')).toBeNull();
    expect(vKcal('3 000')).toBeNull();
    expect(vKcal('3001')).not.toBeNull();
    expect(intIn('1 500')).toBe(1500);
  });
  it('vGrams', () => {
    expect(vGrams('150')).toBeNull();
    expect(vGrams('1000')).toBeNull();
    expect(vGrams('1001')).not.toBeNull();
    expect(vGrams(' 50 ')).toBeNull();
    expect(vGrams('1,5')).not.toBeNull();
    expect(vGrams('0')).toBeNull(); // questionable: 0 g accepted
  });
  it('parseBirth', () => {
    expect(parseBirth('5.3.1990')).toBe('1990-03-05');
    expect(parseBirth(' 29.02.2000 ')).toBe('2000-02-29');
    expect(parseBirth('29.02.2001')).toBeNull();
    expect(parseBirth('31.04.2000')).toBeNull();
    expect(parseBirth('00.01.2000')).toBeNull();
    expect(parseBirth('01.13.2000')).toBeNull();
    expect(parseBirth('1990-03-05')).toBeNull();
    expect(parseBirth('')).toBeNull();
  });
  it('birthToInput / maskBirth', () => {
    expect(birthToInput('1990-03-05')).toBe('05.03.1990');
    expect(birthToInput(null)).toBe('');
    expect(maskBirth('05031990')).toBe('05.03.1990');
    expect(maskBirth('0503')).toBe('05.03');
    expect(maskBirth('05a03-19901234')).toBe('05.03.1990');
    expect(maskBirth('')).toBe('');
  });
  it('vBirth with today = 2026-11-14', () => {
    expect(vBirth('x')).toBe('Формат ДД.ММ.ГГГГ');
    expect(vBirth('15.11.2026')).toBe('Вы ещё не родились');
    expect(vBirth('14.11.2014')).toBeNull(); // exactly 12
    expect(vBirth('15.11.2014')).toBe('Приложение с 12 лет');
    expect(vBirth('14.11.1906')).toBeNull(); // exactly 120
    expect(vBirth('13.11.1905')).toBe('Вам уже вряд ли нужны тренировки');
  });
  it('years', () => {
    expect([1, 2, 5, 11, 12, 14, 21, 22, 25, 101, 111].map(years)).toEqual([
      '1 год', '2 года', '5 лет', '11 лет', '12 лет', '14 лет', '21 год', '22 года', '25 лет', '101 год', '111 лет',
    ]);
  });
});
