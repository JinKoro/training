import { describe, it, expect } from 'vitest';
import { barHeights, deloads, loadNote, weekLoads, type LoadPlan } from '../../src/lib/load';

const row = (sets: number, reps: string, kg = '', pct: number | null = null, exerciseId = 1) => ({ exerciseId, sets, reps, kg, pct });

describe('weekLoads', () => {
  it('the heaviest week is 1; fewer sets and lighter weights make a deload; an empty week is 0', () => {
    const plan: LoadPlan = {
      1: { 0: [row(3, '10', '60')] },
      2: { 0: [row(4, '6', '75')] },
      3: { 0: [row(2, '8', '50')] },
      5: { 0: [row(4, '4', '82,5')] },
    };
    const l = weekLoads(plan, 5);
    expect(Math.max(...l)).toBe(1);
    expect(l[4]).toBe(1); // 82,5 × 4 is the peak
    expect(l[3]).toBe(0); // week 4: rest
    expect(l[2]).toBeLessThan(0.5); // 2 light sets
    expect(l[0]).toBeLessThan(l[1]); // more reps, less weight, fewer sets
  });

  it('reps are counted with the weight: 60 × 10 and 75 × 4 are close, not 60 vs 75', () => {
    const l = weekLoads({ 1: { 0: [row(3, '10', '60')] }, 2: { 0: [row(3, '4', '75')] } }, 2);
    expect(l[0]).toBeGreaterThan(0.9);
  });

  it('without weights (before calibration) fewer reps and a lower pct mean lighter', () => {
    const l = weekLoads({ 1: { 0: [row(3, '12')] }, 2: { 0: [row(3, '6')] }, 3: { 0: [row(3, '6', '', 70)] } }, 3);
    expect(l[1]).toBe(1);
    expect(l[0]).toBeLessThan(1);
    expect(l[2]).toBeCloseTo(0.7, 5);
  });

  it('several exercises and days; text sets from the editor; «60/62,5» takes the first weight', () => {
    const l = weekLoads({
      1: { 0: [row(3, '8–10', '60/62,5'), { exerciseId: 2, sets: '3', reps: '12', kg: '20' }], 2: [row(3, '8', '60')] },
      2: { 0: [row(3, '8', '65'), { exerciseId: 2, sets: '3', reps: '12', kg: '22,5' }], 2: [row(3, '8', '65')] },
    }, 2);
    expect(l[1]).toBe(1);
    expect(l[0]).toBeGreaterThan(0.85);
  });

  it('an empty program is all zeros', () => {
    expect(weekLoads({}, 3)).toEqual([0, 0, 0]);
  });
});

describe('deloads / barHeights', () => {
  it('a week much lighter than the typical one is a deload; the bars stretch over the program\'s own range', () => {
    const l = [0.82, 0.85, 0.88, 0.9, 0.47, 0, 1];
    expect(deloads(l)).toEqual([false, false, false, false, true, false, false]);
    const h = barHeights(l);
    expect(h[4]).toBeCloseTo(0.3, 5); // the lightest working week
    expect(h[6]).toBe(1);
    expect(h[5]).toBe(0); // rest
    expect(h[0]).toBeLessThan(h[3]);
    expect(barHeights([0.5, 0.5])).toEqual([1, 1]);
    expect(deloads([1, 0.3])).toEqual([false, false]); // too few weeks to tell
  });
});

describe('loadNote', () => {
  it('names deload and rest weeks; trailing empty weeks are not filled in yet', () => {
    expect(loadNote([0.7, 0.8, 0.3, 0, 1])).toBe('Неделя 3 — разгрузка, неделя 4 — отдых');
    expect(loadNote([0.7, 0, 0.2, 0, 1, 0.9, 0, 0])).toBe('Неделя 3 — разгрузка, недели 2, 4 — отдых');
    expect(loadNote([0.7, 1, 0, 0])).toBe('');
    expect(loadNote([0, 0])).toBe('');
  });
});
