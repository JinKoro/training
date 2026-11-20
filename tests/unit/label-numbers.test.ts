import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS worker module
import { fixLabelNumbers } from '../../worker/src/api.js';

describe('fixLabelNumbers (label photo sanity checks)', () => {
  it('turns a kJ figure read as kcal into kcal (Heinz ketchup: 450 kJ / 110 kcal)', () => {
    expect(fixLabelNumbers({ kcal: 450, protein: 1, fat: 0, carbs: 25 }).kcal).toBe(107.6);
  });
  it('keeps a kcal value that agrees with the macros', () => {
    expect(fixLabelNumbers({ kcal: 110, protein: 1, fat: 0.1, carbs: 25 })).toEqual({ kcal: 110, protein: 1, fat: 0.1, carbs: 25 });
    expect(fixLabelNumbers({ kcal: 620, protein: 0.3, fat: 67, carbs: 3 }).kcal).toBe(620);
  });
  it('fills empty nutrients with 0 when kcal is already explained (oil: only fat printed)', () => {
    expect(fixLabelNumbers({ kcal: 899, protein: null, fat: 99.9, carbs: null })).toEqual({ kcal: 899, protein: 0, fat: 99.9, carbs: 0 });
  });
  it('leaves empty nutrients empty when kcal is not explained', () => {
    expect(fixLabelNumbers({ kcal: 330, protein: 8, fat: 8.5, carbs: null })).toEqual({ kcal: 330, protein: 8, fat: 8.5, carbs: null });
  });
  it('drops an impossible kcal that is not a kJ figure', () => {
    expect(fixLabelNumbers({ kcal: 2130, protein: null, fat: null, carbs: null }).kcal).toBeNull();
  });
});
