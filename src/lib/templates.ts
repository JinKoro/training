/**
 * Ready-made programs. Men: the 13-week program from the owner's sheet «Занятия», at three levels. Women: a 12-week
 * full-body program (8–15 reps, ~70 % lower body, abs every session). Starting one creates the user's own copy
 * (POST /programs); the template itself never changes.
 */
import type { Exercise, Plan, PlanRow, Sex } from './types';

export type Level = 0 | 1 | 2;
export const LEVEL_RU = ['новичок', 'любитель', 'продвинутый'] as const;

/** m = main lift (follows the block), a = accessory, p = abs. */
type Kind = 'm' | 'a' | 'p';
type Ex = [name: string, kind: Kind, note?: string];
interface Block { name: string; from: number; to: number; load: number; scheme: [string, string, string]; factor: number }

export interface Template {
  id: string; sex: Sex; level: Level; name: string; weeks: number;
  blocks: Block[]; days: Ex[][]; lifts: string[]; askReps: number;
}

// factor: share of the e1RM-based working weight used in the block (adaptation and deload are lighter).
const MEN_BLOCKS: Block[] = [
  { name: 'Адаптация', from: 1, to: 2, load: 0.42, scheme: ['3×12', '3×10–12', '3×10–12'], factor: 0.85 },
  { name: 'Объём', from: 3, to: 6, load: 0.62, scheme: ['3×10', '3×8', '4×8'], factor: 0.92 },
  { name: 'Сила', from: 7, to: 10, load: 0.84, scheme: ['3×8', '3×6', '4×6'], factor: 0.92 },
  { name: 'Разгрузка', from: 11, to: 11, load: 0.28, scheme: ['2×10', '3×10', '3×10'], factor: 0.7 },
  { name: 'Пик', from: 12, to: 12, load: 1, scheme: ['3×6', '4×4', '5×3'], factor: 0.92 },
  { name: 'Закрепление', from: 13, to: 13, load: 0.78, scheme: ['3×8', '3×6', '4×6'], factor: 0.92 },
];
const WOMEN_BLOCKS: Block[] = [
  { name: 'Адаптация', from: 1, to: 2, load: 0.4, scheme: ['2×15', '3×15', '3×15'], factor: 0.85 },
  { name: 'Объём', from: 3, to: 5, load: 0.6, scheme: ['3×12', '3×12', '4×12'], factor: 0.92 },
  { name: 'Нагрузка', from: 6, to: 8, load: 0.8, scheme: ['3×10', '4×10', '4×10'], factor: 0.92 },
  { name: 'Разгрузка', from: 9, to: 9, load: 0.28, scheme: ['2×12', '2×12', '3×12'], factor: 0.7 },
  { name: 'Пик', from: 10, to: 11, load: 1, scheme: ['3×8', '4×8', '5×8'], factor: 0.92 },
  { name: 'Закрепление', from: 12, to: 12, load: 0.72, scheme: ['3×10', '3×12', '4×10'], factor: 0.92 },
];

// Names are base library exercises (matched by name at start).
const MEN_DAYS: Ex[][][] = [
  [
    [['Жим штанги лёжа', 'm'], ['Тяга верхнего блока к груди', 'm'], ['Жим ногами, стандартная', 'm'], ['Сгибания рук с гантелями', 'a']],
    [['Жим гантелей на наклонной скамье', 'm'], ['Тяга горизонтального блока', 'm'], ['Разгибания ног в тренажёре', 'a'], ['Сгибания ног сидя', 'a'], ['Подъём ног лёжа', 'p']],
    [['Жим ногами, стандартная', 'm'], ['Тяга верхнего блока к груди', 'm'], ['Махи в стороны', 'a'], ['Разгибания на блоке', 'a'], ['Гиперэкстензия', 'a']],
  ],
  [
    [['Жим штанги лёжа', 'm'], ['Тяга верхнего блока к груди', 'm'], ['Разгибания ног в тренажёре', 'a'], ['Жим гантелей сидя', 'm'], ['Сгибания ног сидя', 'a'], ['Сгибания рук с гантелями', 'a']],
    [['Жим гантелей на наклонной скамье', 'm'], ['Тяга горизонтального блока', 'm'], ['Махи в стороны', 'a'], ['Жим ногами, узкая постановка', 'm'], ['Гиперэкстензия', 'a']],
    [['Жим ногами, стандартная', 'm'], ['Тяга верхнего блока к груди', 'm'], ['Разведение рук в бабочке', 'a'], ['Тяга горизонтального блока', 'm'], ['Разгибания на блоке', 'a'], ['Обратное разведение рук (задние дельты)', 'a']],
  ],
  [
    [['Жим штанги лёжа', 'm'], ['Подтягивания с весом', 'm'], ['Приседания со штангой', 'm'], ['Жим гантелей сидя', 'm'], ['Сгибания ног лёжа', 'a'], ['Сгибания рук со штангой', 'a']],
    [['Румынская тяга со штангой', 'm'], ['Жим гантелей на наклонной скамье', 'm'], ['Тяга штанги в наклоне', 'm'], ['Махи в стороны', 'a'], ['Выпады с гантелями', 'a'], ['Подъём ног в висе', 'p']],
    [['Жим ногами, стандартная', 'm'], ['Тяга верхнего блока к груди', 'm'], ['Отжимания на брусьях', 'm'], ['Тяга горизонтального блока', 'm'], ['Разгибания на блоке', 'a'], ['Обратное разведение рук (задние дельты)', 'a'], ['Гиперэкстензия', 'a']],
  ],
];
const WOMEN_DAYS: Ex[][][] = [
  [
    [['Жим ногами, стандартная', 'm'], ['Ягодичный мост на полу', 'm'], ['Тяга верхнего блока к груди', 'm'], ['Скручивания', 'p']],
    [['Гоблет-приседания', 'm'], ['Сгибания ног лёжа', 'a'], ['Жим гантелей сидя', 'm'], ['Мёртвый жук', 'p']],
    [['Отведение ноги в кроссовере', 'a'], ['Разгибания ног в тренажёре', 'a'], ['Тяга горизонтального блока', 'm'], ['Подъём ног лёжа', 'p']],
  ],
  [
    [['Гоблет-приседания', 'm'], ['Ягодичный мост со штангой', 'm'], ['Выпады назад', 'a'], ['Тяга верхнего блока к груди', 'm'], ['Скручивания', 'p']],
    [['Румынская тяга с гантелями', 'm'], ['Сгибания ног лёжа', 'a'], ['Отведение ноги в кроссовере', 'a'], ['Жим гантелей лёжа', 'm'], ['Мёртвый жук', 'p']],
    [['Жим ногами, стандартная', 'm'], ['Болгарские сплит-приседания', 'a'], ['Разведение ног в тренажёре', 'a'], ['Тяга гантели одной рукой', 'm'], ['Махи в стороны', 'a'], ['Подъём ног в висе', 'p']],
  ],
  [
    [['Приседания со штангой', 'm'], ['Ягодичный мост со штангой', 'm'], ['Выпады назад', 'a'], ['Разгибания ног в тренажёре', 'a'], ['Тяга верхнего блока к груди', 'm'], ['Скручивания на блоке', 'p']],
    [['Румынская тяга со штангой', 'm'], ['Болгарские сплит-приседания', 'a'], ['Сгибания ног лёжа', 'a'], ['Отведение ноги в кроссовере', 'a'], ['Тяга горизонтального блока', 'm'], ['Мёртвый жук', 'p'], ['Русские скручивания', 'p']],
    [['Жим ногами, стандартная', 'm'], ['Ягодичный мост на полу', 'a', 'на одной ноге'], ['Зашагивания на скамью', 'a'], ['Разведение ног в тренажёре', 'a'], ['Жим гантелей лёжа', 'm'], ['Тяга гантели одной рукой', 'm'], ['Подъём ног в висе', 'p']],
  ],
];
const MEN_LIFTS = [
  ['Жим штанги лёжа', 'Тяга верхнего блока к груди', 'Жим ногами, стандартная'],
  ['Жим штанги лёжа', 'Тяга верхнего блока к груди', 'Жим ногами, стандартная'],
  ['Жим штанги лёжа', 'Приседания со штангой', 'Румынская тяга со штангой'],
];
const WOMEN_LIFTS = [
  ['Жим ногами, стандартная', 'Ягодичный мост на полу', 'Тяга верхнего блока к груди'],
  ['Ягодичный мост со штангой', 'Жим ногами, стандартная', 'Тяга верхнего блока к груди'],
  ['Приседания со штангой', 'Румынская тяга со штангой', 'Ягодичный мост со штангой'],
];

export const TEMPLATES: Template[] = ([0, 1, 2] as Level[]).flatMap((level) => [
  { id: `m${level}`, sex: 'm' as Sex, level, name: 'Сила и масса', weeks: 13, blocks: MEN_BLOCKS, days: MEN_DAYS[level], lifts: MEN_LIFTS[level], askReps: 8 },
  { id: `f${level}`, sex: 'f' as Sex, level, name: 'Фулбади', weeks: 12, blocks: WOMEN_BLOCKS, days: WOMEN_DAYS[level], lifts: WOMEN_LIFTS[level], askReps: 12 },
]);
export const templatesFor = (sex: Sex | null) => TEMPLATES.filter((t) => t.sex === (sex === 'f' ? 'f' : 'm')).sort((a, b) => a.level - b.level);
export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id);

export const blockOf = (t: Template, week: number) => t.blocks.find((b) => week >= b.from && week <= b.to) ?? t.blocks[t.blocks.length - 1];
const topReps = (scheme: string) => { const m = scheme.match(/×(\d+)(?:–(\d+))?/); return m ? Number(m[2] ?? m[1]) : 10; };

/** Men's accessories follow the blocks too, softer than the main lifts (isolation is never taken to 4–6 reps). */
const MEN_ACC: Record<string, string> = { 'Адаптация': '3×12–15', 'Объём': '3×10–12', 'Сила': '3×8–10', 'Разгрузка': '2×12', 'Пик': '3×8', 'Закрепление': '3×10' };
/** Sets × reps of one exercise in a week; abs are 3×15 (3×12 hanging). */
export function schemeOf(t: Template, week: number, kind: Kind, name: string): string {
  const b = blockOf(t, week);
  if (kind === 'p') return name === 'Подъём ног в висе' ? '3×12' : '3×15';
  if (kind === 'a' && t.sex === 'm') return MEN_ACC[b.name] ?? '3×10–12';
  return b.scheme[t.level];
}
/** Rest: main lifts 3:00 up to 8 reps, 2:30 at 10–12, 2:00 at 15; accessories 2:00 up to 10, 1:30 above; abs 1:00. */
export function restOf(kind: Kind, scheme: string): number {
  const r = topReps(scheme);
  if (kind === 'p') return 60;
  if (kind === 'm') return r <= 8 ? 180 : r <= 12 ? 150 : 120;
  return r <= 10 ? 120 : 90;
}
const dropset = (t: Template, week: number, kind: Kind, i: number, day: Ex[]) =>
  blockOf(t, week).name === 'Пик' && t.sex === 'm' && t.level > 0 && kind === 'a' && i === day.length - 1;

/** Working weight for `reps` from a weight lifted for `askReps` (Epley), times the block factor, to 2,5 kg. */
export function weightFor(kgAtAsk: number, askReps: number, reps: number, factor: number): number {
  const max = kgAtAsk * (1 + askReps / 30);
  return Math.max(0, Math.round((max / (1 + reps / 30)) * factor / 2.5) * 2.5);
}

export interface TemplateRow { name: string; kind: Kind; sets: number; reps: string; rest: number; note: string | null }
export function templateDay(t: Template, week: number, day: number): TemplateRow[] {
  const ex = t.days[day];
  return ex.map(([name, kind, note], i) => {
    const s = schemeOf(t, week, kind, name);
    const [sets, reps] = s.split('×');
    const notes = [note, dropset(t, week, kind, i, ex) ? 'дропсет' : null].filter(Boolean).join(', ');
    return { name, kind, sets: Number(sets), reps, rest: restOf(kind, s), note: notes || null };
  });
}
export const dayMinutes = (rows: TemplateRow[]) => Math.round(rows.reduce((t, r) => t + r.sets * (45 + r.rest), 0) / 60);

/** The user's copy: days A/B/C go to the chosen weekdays; known weights fill the asked lifts in every week. */
export function buildPlan(t: Template, weekdays: number[], weights: Record<string, number>, byName: Map<string, Exercise>): Plan {
  const plan: Plan = {};
  for (let w = 1; w <= t.weeks; w++) {
    plan[w] = {};
    const b = blockOf(t, w);
    weekdays.forEach((wd, d) => {
      const rows: PlanRow[] = [];
      for (const r of templateDay(t, w, d)) {
        const ex = byName.get(r.name.toLowerCase());
        if (!ex) continue;
        const base = weights[r.name];
        const kg = base > 0 && r.kind === 'm' ? String(weightFor(base, t.askReps, Number(r.reps.split('–').pop()), b.factor)).replace('.', ',') : '';
        rows.push({ exerciseId: ex.id, sets: r.sets, reps: r.reps, kg, rest: r.rest, note: r.note, pct: b.name === 'Разгрузка' && r.kind !== 'p' ? 70 : null });
      }
      if (rows.length) plan[w][wd] = rows;
    });
  }
  return plan;
}
