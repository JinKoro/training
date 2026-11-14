import { describe, expect, it } from 'vitest';
import { FOOD_CATS, guessSub, SUB_INFO } from '../../src/lib/categories';
import { KIND_MUSCLES } from '../../src/lib/kindMuscles';
import { MUSCLE_RU } from '../../src/lib/calc';

describe('FOOD_CATS / SUB_INFO', () => {
  it('sub ids unique and indexed', () => {
    const ids = FOOD_CATS.flatMap((c) => c.subs.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(SUB_INFO.potato).toEqual({ name: 'Картофель', cat: 'veg', catName: 'Овощи и зелень' });
    expect(SUB_INFO.other.cat).toBe('other');
  });
});

describe('guessSub', () => {
  it.each([
    ['Картофель молодой', 'potato'],
    ['Курица филе', 'chicken'],
    ['Курага', 'dried_fruit'], // "кур" vs longer "курага" at the same place
    ['Куркума молотая', 'spices'],
    ['Печень трески', 'canned_fish'],
    ['Печень говяжья', 'offal'],
    ['Масло сливочное 82%', 'butter'],
    ['Масло оливковое', 'oil'],
    ['Сыр Российский', 'cheese'],
    ['Сыр', 'cheese'],
    ['Сырок глазированный', 'curd_snack'],
    ['Сырники', 'pancakes'],
    ['Конфета', 'candy'],
    ['Рис басмати', 'rice'],
    ['Нутелла', 'spread'],
    ['Протеиновый батончик', 'protein_bar'],
    ['Нектарин', 'fruit_other'],
    ['Кефир 1%', 'kefir'],
    ['Гречка ядрица', 'buckwheat'],
    ['Перец чёрный молотый', 'spices'],
    ['Перец болгарский', 'pepper'],
    ['Лук репчатый', 'onion_garlic'],
    ['Яблоко', 'apple_pear'],
    ['ТВОРОГ 5%', 'cottage'],
    ['Йогурт, клубника', 'yogurt'],
    ['Пиво светлое', 'beer'],
    ['Минеральная вода', 'water'],
    ['Red Bull', 'energy'],
    ['Морковь по-корейски', 'carrot_beet'],
  ])('%s → %s', (name, sub) => expect(guessSub(name)).toBe(sub));

  it('nothing → null', () => {
    expect(guessSub('')).toBeNull();
    expect(guessSub('xyz')).toBeNull();
  });
  it('keyword must start a word ("конфета" is not cheese "фета")', () => {
    expect(guessSub('Лук')).toBe('onion_garlic'); // "лук " needs a word end
    expect(guessSub('Лукум')).toBe('oriental');
  });
  it('earliest keyword wins (pinned)', () => {
    expect(guessSub('Яблоки сок')).toBe('apple_pear');
    expect(guessSub('Сок яблочный')).toBe('juice');
  });
  // BUG-ish (keyword prefix collisions, earliest match wins):
  it('«Сливочный сыр» is cheese, not plums («слив»)', () => expect(guessSub('Сливочный сыр')).toBe('cheese'));
  it('«Густой йогурт» is yogurt, not goose («гус»)', () => expect(guessSub('Густой йогурт')).toBe('yogurt'));
  it('«Рафаэлло» is candy, not coffee («раф»)', () => expect(guessSub('Рафаэлло')).not.toBe('coffee'));
  it('«Икра кабачковая» is canned veg, not caviar', () => expect(guessSub('Икра кабачковая')).not.toBe('caviar'));
  it('«Молоко овсяное» is a plant drink', () => expect(guessSub('Молоко овсяное')).toBe('plant'));
});

describe('KIND_MUSCLES', () => {
  const CHIPS = new Set(['chest', 'shoulders', 'biceps', 'abs', 'quads', 'calves', 'lats', 'triceps', 'glutes', 'hamstrings']);
  it('only form chips (folded muscles never appear), no duplicates, sorted, non-empty', () => {
    for (const [k, list] of Object.entries(KIND_MUSCLES)) {
      expect(list.length, k).toBeGreaterThan(0);
      expect(new Set(list).size, k).toBe(list.length);
      expect([...list].sort(), k).toEqual(list);
      for (const m of list) {
        expect(CHIPS.has(m), `${k}:${m}`).toBe(true);
        expect(MUSCLE_RU[m], m).toBeDefined();
      }
    }
  });
  it('pinned kinds', () => {
    expect(KIND_MUSCLES.bench).toEqual(['chest', 'shoulders', 'triceps']);
    expect(KIND_MUSCLES.wrist).toEqual(['biceps']); // forearms → biceps
    expect(KIND_MUSCLES.shrug).toEqual(['biceps', 'lats']); // traps → back
    expect(Object.keys(KIND_MUSCLES)).toHaveLength(84);
  });
});
