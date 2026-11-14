import { describe, expect, it } from 'vitest';
import {
  blockOf, buildPlan, dayMinutes, LEVEL_RU, restOf, schemeOf, templateById, templateDay, templatesFor, TEMPLATES, weightFor, type Template,
} from '../../src/lib/templates';
import { parseReps } from '../../src/lib/calc';
import type { Exercise } from '../../src/lib/types';
import { ex } from './helpers';

const ALL_NAMES = [...new Set(TEMPLATES.flatMap((t) => t.days.flat().map((e) => e[0])))];
const byName = new Map<string, Exercise>(ALL_NAMES.map((n, i) => [n.toLowerCase(), ex(i + 1, { name: n })]));
const idOf = (n: string) => byName.get(n.toLowerCase())!.id;
const nameOf = new Map(ALL_NAMES.map((n) => [idOf(n), n]));
const t = (id: string) => templateById(id)!;
const repsTop = (s: string) => parseReps(s).max;

const LOWER = new Set([
  'Жим ногами, стандартная', 'Жим ногами, узкая постановка', 'Ягодичный мост на полу', 'Ягодичный мост со штангой', 'Гоблет-приседания',
  'Сгибания ног лёжа', 'Сгибания ног сидя', 'Отведение ноги в кроссовере', 'Разгибания ног в тренажёре', 'Выпады назад', 'Выпады с гантелями',
  'Румынская тяга с гантелями', 'Румынская тяга со штангой', 'Болгарские сплит-приседания', 'Разведение ног в тренажёре',
  'Приседания со штангой', 'Зашагивания на скамью',
]);

describe('catalogue', () => {
  it('six templates, 3 levels per sex', () => {
    expect(TEMPLATES.map((x) => x.id).sort()).toEqual(['f0', 'f1', 'f2', 'm0', 'm1', 'm2']);
    expect(templatesFor('m').map((x) => x.id)).toEqual(['m0', 'm1', 'm2']);
    expect(templatesFor('f').map((x) => x.id)).toEqual(['f0', 'f1', 'f2']);
    expect(templatesFor(null).map((x) => x.id)).toEqual(['m0', 'm1', 'm2']);
    expect(templateById('zz')).toBeUndefined();
    expect(LEVEL_RU).toHaveLength(3);
  });
  it('every template has 3 days, a load per week, blocks covering every week, lifts present in the days', () => {
    for (const x of TEMPLATES) {
      expect(x.days).toHaveLength(3);
      expect(x.load).toHaveLength(x.weeks);
      for (let w = 1; w <= x.weeks; w++) expect(x.blocks.some((b) => w >= b.from && w <= b.to)).toBe(true);
      const mains = new Set(x.days.flat().filter((e) => e[1] === 'm').map((e) => e[0]));
      for (const l of x.lifts) expect(mains.has(l)).toBe(true);
    }
  });
  it('exercises per template (pinned)', () => {
    expect(t('m0').days.map((d) => d.length)).toEqual([4, 5, 5]);
    expect(t('m1').days.map((d) => d.length)).toEqual([6, 5, 6]);
    expect(t('m2').days.map((d) => d.length)).toEqual([6, 6, 7]);
    expect(t('f0').days.map((d) => d.length)).toEqual([4, 4, 4]);
    expect(t('f1').days.map((d) => d.length)).toEqual([5, 5, 6]);
    expect(t('f2').days.map((d) => d.length)).toEqual([6, 7, 7]);
  });
  it('women: abs every session', () => {
    for (const x of templatesFor('f')) for (const d of x.days) expect(d.some((e) => e[1] === 'p')).toBe(true);
  });
  it('women: roughly 70 % lower body (non-abs exercises)', () => {
    for (const x of templatesFor('f')) {
      const nonAbs = x.days.flat().filter((e) => e[1] !== 'p');
      const share = nonAbs.filter((e) => LOWER.has(e[0])).length / nonAbs.length;
      expect(share).toBeGreaterThanOrEqual(0.6);
      expect(share).toBeLessThanOrEqual(0.8);
    }
  });
  it('load: deload 0.7, last week heaviest, grows inside each block', () => {
    for (const x of TEMPLATES) {
      const deload = x.blocks.find((b) => b.name === 'Разгрузка')!;
      expect(x.load[deload.from - 1]).toBe(0.7);
      expect(Math.max(...x.load)).toBe(x.load[x.weeks - 1]);
      for (const b of x.blocks) for (let w = b.from + 1; w <= b.to; w++) expect(x.load[w - 1]).toBeGreaterThanOrEqual(x.load[w - 2]);
    }
  });
});

describe('blockOf / schemeOf', () => {
  it('blocks by week; beyond the end → last block', () => {
    expect(blockOf(t('m0'), 1).name).toBe('Адаптация');
    expect(blockOf(t('m0'), 3).name).toBe('Объём');
    expect(blockOf(t('m0'), 10).name).toBe('Сила');
    expect(blockOf(t('m0'), 11).name).toBe('Разгрузка');
    expect(blockOf(t('m0'), 12).name).toBe('Пик');
    expect(blockOf(t('m0'), 13).name).toBe('Закрепление');
    expect(blockOf(t('m0'), 20).name).toBe('Закрепление');
    expect(blockOf(t('f0'), 9).name).toBe('Разгрузка');
  });
  it('main lifts follow block and level', () => {
    expect(schemeOf(t('m0'), 1, 'm', 'x')).toBe('3×12');
    expect(schemeOf(t('m2'), 12, 'm', 'x')).toBe('5×3');
    expect(schemeOf(t('f1'), 6, 'm', 'x')).toBe('4×10');
  });
  it('abs 3×15, hanging leg raise 3×12', () => {
    expect(schemeOf(t('m2'), 5, 'p', 'Скручивания')).toBe('3×15');
    expect(schemeOf(t('f0'), 5, 'p', 'Подъём ног в висе')).toBe('3×12');
  });
  it('men accessories follow blocks, never below 8 reps', () => {
    const seq = [1, 3, 7, 11, 12, 13].map((w) => schemeOf(t('m1'), w, 'a', 'x'));
    expect(seq).toEqual(['3×12–15', '3×10–12', '3×8–10', '2×12', '3×8', '3×10']);
    for (const x of templatesFor('m')) for (let w = 1; w <= x.weeks; w++) {
      const s = schemeOf(x, w, 'a', 'x');
      expect(parseReps(s.split('×')[1]).min).toBeGreaterThanOrEqual(8);
    }
  });
  it('women accessories use the block scheme', () => {
    expect(schemeOf(t('f0'), 1, 'a', 'x')).toBe('2×15');
  });
  it('women: reps only 8–15 for non-abs in every week', () => {
    for (const x of templatesFor('f')) for (let w = 1; w <= x.weeks; w++) for (let d = 0; d < 3; d++) {
      for (const r of templateDay(x, w, d)) if (r.kind !== 'p') {
        const { min, max } = parseReps(r.reps);
        expect(min).toBeGreaterThanOrEqual(8);
        expect(max).toBeLessThanOrEqual(15);
      }
    }
  });
});

describe('restOf', () => {
  it.each([
    ['m', '3×3', 180], ['m', '3×6', 180], ['m', '3×8', 180], ['m', '3×10', 150], ['m', '3×10–12', 150], ['m', '3×12', 150], ['m', '2×15', 120],
    ['a', '3×8', 120], ['a', '3×8–10', 120], ['a', '3×10', 120], ['a', '3×10–12', 90], ['a', '3×12–15', 90],
    ['p', '3×15', 60], ['p', '3×5', 60],
  ] as const)('%s %s → %i', (k, s, r) => expect(restOf(k, s)).toBe(r));
  it('unparseable scheme defaults to 10 reps', () => {
    expect(restOf('m', 'x')).toBe(150);
    expect(restOf('a', 'x')).toBe(120);
  });
  // fixed: topReps only understands "–" (en dash); "3×10-12" with a hyphen reads 10 instead of 12 (accessory rest 2:00 instead of 1:30)
  it('hyphen range is read like an en-dash range', () => expect(restOf('a', '3×10-12')).toBe(restOf('a', '3×10–12')));
});

describe('templateDay', () => {
  it('rows of m0 day A week 1', () => {
    expect(templateDay(t('m0'), 1, 0)).toEqual([
      { name: 'Жим штанги лёжа', kind: 'm', sets: 3, reps: '12', rest: 150, note: null },
      { name: 'Тяга верхнего блока к груди', kind: 'm', sets: 3, reps: '12', rest: 150, note: null },
      { name: 'Жим ногами, стандартная', kind: 'm', sets: 3, reps: '12', rest: 150, note: null },
      { name: 'Сгибания рук с гантелями', kind: 'a', sets: 3, reps: '12–15', rest: 90, note: null },
    ]);
  });
  it('dropset on the last accessory in Peak week, men level > 0 only', () => {
    expect(templateDay(t('m1'), 12, 0).at(-1)!.note).toBe('дропсет');
    expect(templateDay(t('m1'), 11, 0).at(-1)!.note).toBeNull();
    expect(templateDay(t('m0'), 12, 0).at(-1)!.note).toBeNull();
    expect(templateDay(t('m2'), 12, 1).at(-1)!.note).toBeNull(); // last is abs
    expect(templateDay(t('f2'), 10, 2).find((r) => r.name === 'Ягодичный мост на полу')!.note).toBe('на одной ноге');
  });
  it('dayMinutes', () => {
    expect(dayMinutes(templateDay(t('m0'), 1, 0))).toBe(Math.round((3 * 195 * 3 + 3 * 135) / 60));
    expect(dayMinutes([])).toBe(0);
  });
});

describe('weightFor', () => {
  it('Epley, rounded to 2.5', () => {
    expect(weightFor(100, 8, 8, 1)).toBe(100);
    expect(weightFor(100, 8, 12, 1)).toBe(90);
    expect(weightFor(100, 8, 5, 1)).toBe(107.5);
    expect(weightFor(100, 8, 8, 0.7)).toBe(70);
    expect(weightFor(60, 12, 10, 0.92)).toBe(57.5); // 60*1.4/1.3333*0.92 = 57.96
    expect(weightFor(0, 8, 8, 1)).toBe(0);
    expect(weightFor(-50, 8, 8, 1)).toBe(0);
  });
  it('result is always a multiple of 2.5', () => {
    for (let kg = 1; kg < 200; kg += 3.7) expect((weightFor(kg, 8, 10, 0.94) / 2.5) % 1).toBe(0);
  });
});

describe('buildPlan', () => {
  const m0 = t('m0');
  const weights = { 'Жим штанги лёжа': 80, 'Тяга верхнего блока к груди': 60, 'Жим ногами, стандартная': 150 };
  const plan = buildPlan(m0, [0, 2, 4], weights, byName);

  it('every week, days on chosen weekdays', () => {
    expect(Object.keys(plan)).toHaveLength(13);
    for (let w = 1; w <= 13; w++) expect(Object.keys(plan[w]).sort()).toEqual(['0', '2', '4']);
    expect(plan[1][2].map((r) => nameOf.get(r.exerciseId))).toEqual(m0.days[1].map((e) => e[0]));
  });
  it('kg only for asked main lifts; pct = weekly load; abs no pct', () => {
    for (let w = 1; w <= 13; w++) for (const wd of ['0', '2', '4']) for (const r of plan[w][wd]) {
      const n = nameOf.get(r.exerciseId)!;
      const kind = m0.days.flat().find((e) => e[0] === n)![1];
      if (kind === 'm' && n in weights) expect(r.kg).not.toBe(''); else expect(r.kg).toBe('');
      expect(r.pct).toBe(kind === 'p' ? null : Math.round(m0.load[w - 1] * 100));
    }
  });
  it('pinned weights week 1 / deload / week 13', () => {
    const bench = (w: number) => plan[w][0].find((r) => nameOf.get(r.exerciseId) === 'Жим штанги лёжа')!;
    expect(bench(1)).toMatchObject({ reps: '12', kg: '65', sets: 3, rest: 150, pct: 90 }); // 80*1.2667/1.4*0.9 = 65.1
    expect(bench(10)).toMatchObject({ reps: '8', kg: '80', pct: 100 });
    expect(bench(11)).toMatchObject({ sets: 2, reps: '10', pct: 70 });
    expect(bench(13)).toMatchObject({ reps: '8', kg: '85', pct: 106 });
  });
  it('week 13 heavier than week 10 at the same reps by 5–10 %', () => {
    for (const x of templatesFor('m')) {
      expect(blockOf(x, 13).scheme[x.level]).toBe(blockOf(x, 10).scheme[x.level]);
      const p = buildPlan(x, [0, 2, 4], { [x.lifts[0]]: 100 }, byName);
      const kg = (w: number) => Number(p[w][0].find((r) => nameOf.get(r.exerciseId) === x.lifts[0])!.kg.replace(',', '.'));
      const ratio = kg(13) / kg(10);
      expect(ratio).toBeGreaterThanOrEqual(1.05);
      expect(ratio).toBeLessThanOrEqual(1.1);
    }
  });
  it('deload week ≈ 70 % of the week before at its reps', () => {
    const p = buildPlan(m0, [0, 2, 4], { 'Жим штанги лёжа': 100 }, byName);
    const r = p[11][0].find((x) => nameOf.get(x.exerciseId) === 'Жим штанги лёжа')!;
    expect(r.kg).toBe(String(weightFor(100, 8, 10, 0.7)).replace('.', ','));
  });
  it('kg uses a comma decimal', () => {
    const p = buildPlan(m0, [0, 2, 4], { 'Жим штанги лёжа': 77 }, byName);
    expect(p[1][0][0].kg).toBe('62,5'); // 77*1.2667/1.4*0.9 = 62.7
  });
  it('accessory with a weight given gets no kg', () => {
    const p = buildPlan(m0, [0, 2, 4], { 'Сгибания рук с гантелями': 20 }, byName);
    expect(p[1][0].find((r) => nameOf.get(r.exerciseId) === 'Сгибания рук с гантелями')!.kg).toBe('');
  });
  it('zero / negative weights give no kg', () => {
    const p = buildPlan(m0, [0, 2, 4], { 'Жим штанги лёжа': 0, 'Жим ногами, стандартная': -10 }, byName);
    expect(p[1][0].every((r) => r.kg === '')).toBe(true);
  });
  it('exercises missing from the library are skipped; an all-missing day is dropped', () => {
    const only = new Map([['жим штанги лёжа', byName.get('жим штанги лёжа')!]]);
    const p = buildPlan(m0, [0, 2, 4], {}, only);
    expect(Object.keys(p[1])).toEqual(['0']);
    expect(p[1][0]).toHaveLength(1);
    expect(buildPlan(m0, [0, 2, 4], {}, new Map())[1]).toEqual({});
  });
  it('library lookup is case-insensitive via lowercase keys', () => {
    expect(plan[1][0][0].exerciseId).toBe(idOf('Жим штанги лёжа'));
  });
  it('fewer weekdays → only the first days', () => {
    const p = buildPlan(m0, [1, 3], {}, byName);
    expect(Object.keys(p[1]).sort()).toEqual(['1', '3']);
    expect(p[1][3]).toHaveLength(m0.days[1].length);
  });
  // questionable: more than 3 weekdays crashes (t.days[3] is undefined); UI passes sorted user choice without a visible cap here
  it('more than 3 weekdays throws (pinned)', () => {
    expect(() => buildPlan(m0, [0, 1, 2, 3], {}, byName)).toThrow();
  });
  it('a template longer than its load array uses factor 1', () => {
    const long: Template = { ...m0, weeks: 15 };
    const p = buildPlan(long, [0, 2, 4], { 'Жим штанги лёжа': 100 }, byName);
    expect(p[15][0][0].pct).toBe(100);
    expect(p[15][0][0].reps).toBe(p[13][0][0].reps);
  });
  it('women plan: 12 weeks, deload week 9 at 70 %, rests consistent', () => {
    const f = t('f1');
    const p = buildPlan(f, [0, 2, 4], { 'Ягодичный мост со штангой': 60 }, byName);
    expect(Object.keys(p)).toHaveLength(12);
    expect(p[9][0][0].pct).toBe(70);
    for (const r of p[1][0]) expect(repsTop(r.reps)).toBe(15);
  });
});
