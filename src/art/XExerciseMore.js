// Additional exercise illustrations in the same style as XExercise.js:
// 72×72 viewBox, floor at y=64, stick figure stroke = ink, equipment = equip, working muscle = orange dot.
// Each kind has `start` and `end` phases; both get v = { equip, muscle }.

const h = (x, y) => `<circle cx="${x}" cy="${y}" r="4"></circle>`;
const p = (d) => `<path d="${d}"></path>`;
const q = (v, d, w = 3) => `<path d="${d}" stroke="${v.equip}" stroke-width="${w}"></path>`;
const plate = (v, x, y, r = 6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${v.equip}" stroke="none"></circle>`;
const db = (v, x, y) => `<rect x="${x - 4}" y="${y - 2}" width="8" height="4" rx="1" fill="${v.equip}" stroke="none"></rect>`;
const bar = (v, x1, x2, y) => q(v, `M${x1} ${y}H${x2}`)
  + `<rect x="${x1}" y="${y - 5}" width="4" height="10" rx="1" fill="${v.equip}" stroke="none"></rect>`
  + `<rect x="${x2 - 4}" y="${y - 5}" width="4" height="10" rx="1" fill="${v.equip}" stroke="none"></rect>`;
const pad = (v, x, y, w, hgt = 4) => `<rect x="${x}" y="${y}" width="${w}" height="${hgt}" rx="2" fill="${v.equip}" stroke="none"></rect>`;
const box = (v, x, y, w, hgt) => `<rect x="${x}" y="${y}" width="${w}" height="${hgt}" rx="2" fill="none" stroke="${v.equip}" stroke-width="2.5"></rect>`;
const ring = (v, x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${v.equip}" stroke-width="2.5"></circle>`;
const kb = (v, x, y) => `<circle cx="${x}" cy="${y}" r="4.5" fill="${v.equip}" stroke="none"></circle><path d="M${x - 3} ${y - 4}a3 3 0 0 1 6 0" stroke="${v.equip}" stroke-width="2"></path>`;
const m = (v, x, y) => `<circle cx="${x}" cy="${y}" r="3" fill="${v.muscle}" stroke="none"></circle>`;

// standing figures
const front = (x = 36, top = 10) => h(x, top) + p(`M${x} ${top + 5}V${top + 29}M${x} ${top + 29}l-4 ${52 - top}M${x} ${top + 29}l4 ${52 - top}`);
const side = (x = 36, top = 10) => h(x, top) + p(`M${x} ${top + 5}V${top + 29}M${x} ${top + 29}l-2 ${52 - top}M${x} ${top + 29}l2 ${52 - top}`);
const benchPre = (v) => pad(v, 10, 40, 46, 5) + q(v, 'M16 45v19M50 45v19') + h(15, 35) + p('M20 36h24l8 10v12');
const runFig = (dx = 0, a = true) => (a
  ? h(38 + dx, 10) + p(`M${38 + dx} 15L${36 + dx} 38M${36 + dx} 38L${46 + dx} 48L${44 + dx} 60M${36 + dx} 38L${28 + dx} 50L${20 + dx} 52M${37 + dx} 22L${44 + dx} 28L${48 + dx} 22M${37 + dx} 22L${30 + dx} 30L${26 + dx} 36`)
  : h(38 + dx, 10) + p(`M${38 + dx} 15L${36 + dx} 38M${36 + dx} 38L${40 + dx} 50L${38 + dx} 62M${36 + dx} 38L${30 + dx} 46L${34 + dx} 56M${37 + dx} 22L${30 + dx} 28L${28 + dx} 22M${37 + dx} 22L${42 + dx} 30L${46 + dx} 34`));

export const MORE_LABELS = {
  deadlift: 'Становая тяга', rdl: 'Румынская тяга', goodmorning: 'Гуд-монинг', row: 'Тяга штанги в наклоне', dbrow: 'Тяга гантели одной рукой',
  cablerow: 'Тяга горизонтального блока', pullup: 'Подтягивания', invrow: 'Австралийские подтягивания', shrug: 'Шраги', incline: 'Жим на наклонной скамье',
  dbfly: 'Разведение гантелей лёжа', cablefly: 'Сведение в кроссовере', pecdeck: 'Бабочка', pushup: 'Отжимания', dips: 'Брусья', ohp: 'Жим стоя',
  lateral: 'Махи в стороны', frontraise: 'Подъём перед собой', reardelt: 'Махи в наклоне', facepull: 'Тяга к лицу', uprightrow: 'Тяга к подбородку',
  triext: 'Разгибание из-за головы', pushdown: 'Разгибания на блоке', skull: 'Французский жим', benchdip: 'Обратные отжимания', wrist: 'Сгибания запястий',
  hang: 'Вис на перекладине', plank: 'Планка', sideplank: 'Боковая планка', crunch: 'Скручивания', legraise: 'Подъём ног в висе', lyinglegraise: 'Подъём ног лёжа',
  cablecrunch: 'Скручивания на блоке', russian: 'Русские скручивания', abwheel: 'Ролик для пресса', hipthrust: 'Ягодичный мост со штангой', glutebridge: 'Ягодичный мост',
  calf: 'Подъём на носки стоя', seatedcalf: 'Подъём на носки сидя', abduct: 'Разведение ног', adduct: 'Сведение ног', kickback: 'Отведение ноги назад',
  stepup: 'Зашагивания', pistol: 'Пистолетик', run: 'Бег', treadmill: 'Беговая дорожка', bike: 'Велотренажёр', elliptical: 'Эллипс', rower: 'Гребной тренажёр',
  jumprope: 'Скакалка', stepper: 'Степпер', burpee: 'Берпи', boxjump: 'Прыжки на тумбу', kbswing: 'Махи гирей', swim: 'Плавание', walk: 'Ходьба',
  thruster: 'Трастеры', sled: 'Толкание саней', ohcarry: 'Прогулка с весом над головой', vacuum: 'Вакуум', deadbug: 'Мёртвый жук', bicycle: 'Велосипед',
cleanpress: 'Взятие на грудь и жим', renegade: 'Отжимания с тягой гантелей', burpeepull: 'Берпи с подтягиванием', getup: 'Турецкий подъём', squatcurlpress: 'Присед, бицепс и жим',
    pullover: 'Пуловер', chestpress: 'Жим в тренажёре', cablepullover: 'Пуловер на блоке', goblet: 'Гоблет-приседания', airsquat: 'Приседания', kickbackarm: 'Разгибание в наклоне',
};

export const MORE_KINDS = {
  deadlift: {
    start: (v) => plate(v, 30, 57, 7) + h(21, 27) + p('M42 62L40 50L44 38L26 31M26 31L29 53') + m(v, 42, 40),
    end: (v) => plate(v, 38, 42, 7) + h(37, 10) + p('M38 62V39M38 39L37 15M37 20L38 40') + m(v, 38, 36),
  },
  rdl: {
    start: (v) => plate(v, 30, 52, 6) + h(23, 32) + p('M42 62L43 49L46 37L28 35M28 35L30 50') + m(v, 44, 44),
    end: (v) => plate(v, 38, 42, 6) + h(37, 10) + p('M38 62V39M38 39L37 15M37 20L38 40') + m(v, 38, 44),
  },
  goodmorning: {
    start: (v) => plate(v, 36, 19, 5) + h(36, 10) + p('M37 62V39M37 39L36 15') + m(v, 37, 44),
    end: (v) => plate(v, 24, 33, 5) + h(17, 35) + p('M40 62L42 50L44 38L22 36') + m(v, 42, 44),
  },
  row: {
    start: (v) => plate(v, 27, 47, 6) + h(21, 23) + p('M42 62L40 48L44 36L26 26M26 26L27 45') + m(v, 34, 31),
    end: (v) => plate(v, 37, 39, 6) + h(21, 23) + p('M42 62L40 48L44 36L26 26M26 26L37 23L37 37') + m(v, 33, 30),
  },
  dbrow: {
    start: (v) => pad(v, 8, 42, 22) + q(v, 'M12 46v18M26 46v18') + h(20, 31) + p('M46 62L44 48L44 35L25 35M25 35L20 42M28 35L29 50') + db(v, 29, 52) + m(v, 34, 37),
    end: (v) => pad(v, 8, 42, 22) + q(v, 'M12 46v18M26 46v18') + h(20, 31) + p('M46 62L44 48L44 35L25 35M25 35L20 42M28 35L37 28L36 38') + db(v, 36, 40) + m(v, 34, 37),
  },
  cablerow: {
    start: (v) => q(v, 'M8 38V58') + pad(v, 34, 46, 18) + q(v, 'M8 36H20', 2) + h(40, 18) + p('M40 23V44M40 44L26 40L12 48M40 28L20 36') + m(v, 42, 32),
    end: (v) => q(v, 'M8 38V58') + pad(v, 34, 46, 18) + q(v, 'M8 36L36 38', 2) + h(40, 18) + p('M40 23V44M40 44L26 40L12 48M40 28L48 34L38 38') + m(v, 42, 32),
  },
  pullup: {
    start: (v) => q(v, 'M14 14H58') + h(36, 26) + p('M26 14L32 30M46 14L40 30M32 30H40M36 30V50M36 50L33 61M36 50L39 61') + m(v, 33, 36),
    end: (v) => q(v, 'M14 14H58') + h(36, 8) + p('M26 14L23 24L31 18M46 14L49 24L41 18M31 18H41M36 13V36M36 36L33 47M36 36L39 47') + m(v, 33, 24),
  },
  invrow: {
    start: (v) => q(v, 'M42 30H62M60 30V64') + h(48, 42) + p('M12 62L44 45M44 45L50 30') + m(v, 34, 50),
    end: (v) => q(v, 'M42 30H62M60 30V64') + h(50, 33) + p('M12 62L46 37M46 37L44 30L50 30') + m(v, 34, 44),
  },
  shrug: {
    start: (v) => bar(v, 20, 52, 40) + front() + p('M28 22H44M28 22V38M44 22V38') + m(v, 36, 18),
    end: (v) => bar(v, 20, 52, 36) + front() + p('M28 17H44M28 17V34M44 17V34') + m(v, 36, 15),
  },
  incline: {
    start: (v) => q(v, 'M14 28L40 46H52M32 46V64', 4) + h(16, 23) + p('M20 29L38 41L50 40L52 62M23 31V16') + plate(v, 23, 14, 5) + m(v, 26, 34),
    end: (v) => q(v, 'M14 28L40 46H52M32 46V64', 4) + h(16, 23) + p('M20 29L38 41L50 40L52 62M23 31L30 36L25 25') + plate(v, 25, 23, 5) + m(v, 26, 34),
  },
  dbfly: {
    start: (v) => pad(v, 32, 12, 8, 46) + h(36, 12) + p('M36 17V40M36 40L30 58M36 40L42 58M36 22L18 27M36 22L54 27') + db(v, 15, 27) + db(v, 57, 27) + m(v, 36, 26),
    end: (v) => pad(v, 32, 12, 8, 46) + h(36, 12) + p('M36 17V40M36 40L30 58M36 40L42 58M36 22L26 24L33 19M36 22L46 24L39 19') + db(v, 33, 18) + db(v, 39, 18) + m(v, 36, 26),
  },
  cablefly: {
    start: (v) => q(v, 'M6 4L16 22M66 4L56 22', 2) + front() + p('M36 20L16 22M36 20L56 22') + m(v, 36, 25),
    end: (v) => q(v, 'M6 4L33 34M66 4L39 34', 2) + front() + p('M36 20L30 32L36 34M36 20L42 32L36 34') + m(v, 36, 25),
  },
  pecdeck: {
    start: (v) => pad(v, 28, 40, 16) + q(v, 'M18 10V28M54 10V28') + h(36, 10) + p('M36 15V40M36 40L28 48V62M36 40L44 48V62M36 22H20V12M36 22H52V12') + m(v, 36, 26),
    end: (v) => pad(v, 28, 40, 16) + q(v, 'M31 8V26M41 8V26') + h(36, 10) + p('M36 15V40M36 40L28 48V62M36 40L44 48V62M36 22L30 22V12M36 22L42 22V12') + m(v, 36, 28),
  },
  pushup: {
    start: (v) => h(14, 42) + p('M20 44L58 62M20 44V62') + m(v, 24, 47),
    end: (v) => h(14, 53) + p('M20 55L58 62M20 55L27 58L20 62') + m(v, 24, 57),
  },
  dips: {
    start: (v) => q(v, 'M26 36V64M46 36V64M20 36H32M40 36H52') + h(36, 12) + p('M28 20H44M28 20L26 36M44 20L46 36M36 17V40M36 40L33 50L38 56') + m(v, 34, 26),
    end: (v) => q(v, 'M26 36V64M46 36V64M20 36H32M40 36H52') + h(36, 22) + p('M28 30H44M28 30L22 36H26M44 30L50 36H46M36 27V48M36 48L33 56L38 60') + m(v, 34, 35),
  },
  ohp: {
    start: (v) => bar(v, 18, 54, 21) + front() + p('M36 20L28 30L27 21M36 20L44 30L45 21') + m(v, 31, 21),
    end: (v) => bar(v, 18, 54, 4) + front() + p('M36 20L29 12L29 5M36 20L43 12L43 5') + m(v, 31, 19),
  },
  lateral: {
    start: (v) => front() + p('M36 20L30 38M36 20L42 38') + db(v, 30, 40) + db(v, 42, 40) + m(v, 39, 21),
    end: (v) => front() + p('M36 20L18 21M36 20L54 21') + db(v, 16, 21) + db(v, 56, 21) + m(v, 39, 21),
  },
  frontraise: {
    start: (v) => side() + p('M36 20L37 38') + db(v, 37, 40) + m(v, 38, 21),
    end: (v) => side() + p('M36 20L54 20') + db(v, 57, 20) + m(v, 38, 21),
  },
  reardelt: {
    start: (v) => h(21, 23) + p('M42 62L40 48L44 36L26 26M26 26L27 44') + db(v, 27, 46) + m(v, 29, 27),
    end: (v) => h(21, 23) + p('M42 62L40 48L44 36L26 26M26 26L30 11') + db(v, 30, 9) + m(v, 29, 27),
  },
  facepull: {
    start: (v) => q(v, 'M64 4V64') + q(v, 'M64 12L54 16', 2) + side() + p('M36 20L54 16') + m(v, 34, 21),
    end: (v) => q(v, 'M64 4V64') + q(v, 'M64 12L44 10', 2) + side() + p('M36 20L48 16L43 10') + m(v, 34, 21),
  },
  uprightrow: {
    start: (v) => bar(v, 20, 52, 38) + front() + p('M30 20H42M30 20V38M42 20V38') + m(v, 36, 20),
    end: (v) => bar(v, 22, 50, 24) + front() + p('M30 20H42M30 20L22 15L30 24M42 20L50 15L42 24') + m(v, 36, 20),
  },
  triext: {
    start: (v) => side() + p('M36 20L39 6L31 13') + db(v, 30, 13) + m(v, 38, 14),
    end: (v) => side() + p('M36 20L38 3') + db(v, 38, 2) + m(v, 37, 13),
  },
  pushdown: {
    start: (v) => q(v, 'M60 2V64') + q(v, 'M60 4L46 26', 2) + side() + p('M36 20L38 32L46 26') + m(v, 37, 26),
    end: (v) => q(v, 'M60 2V64') + q(v, 'M60 4L41 42', 2) + side() + p('M36 20L38 32L41 42') + m(v, 37, 26),
  },
  skull: {
    start: (v) => benchPre(v) + p('M28 36V20') + plate(v, 28, 17, 4) + m(v, 28, 28),
    end: (v) => benchPre(v) + p('M28 36L25 20L17 27') + plate(v, 15, 27, 4) + m(v, 27, 28),
  },
  benchdip: {
    start: (v) => pad(v, 6, 38, 20) + q(v, 'M10 42v22M22 42v22') + h(26, 16) + p('M27 21L30 42L46 44L58 62M27 22L24 38') + m(v, 26, 28),
    end: (v) => pad(v, 6, 38, 20) + q(v, 'M10 42v22M22 42v22') + h(28, 26) + p('M29 31L32 52L46 48L58 62M29 32L20 34L24 38') + m(v, 25, 33),
  },
  wrist: {
    start: (v) => pad(v, 16, 44, 30) + q(v, 'M22 48v16M42 48v16') + h(10, 22) + p('M12 27L12 50L20 62M12 32L22 40H40L44 46') + plate(v, 45, 49, 4) + m(v, 30, 40),
    end: (v) => pad(v, 16, 44, 30) + q(v, 'M22 48v16M42 48v16') + h(10, 22) + p('M12 27L12 50L20 62M12 32L22 40H40L44 34') + plate(v, 45, 31, 4) + m(v, 30, 40),
  },
  hang: {
    start: (v) => q(v, 'M16 8H56') + h(36, 18) + p('M30 8L32 23M42 8L40 23M32 23H40M36 23V44M36 44L33 61M36 44L39 61') + m(v, 31, 14),
    end: (v) => q(v, 'M16 8H56') + h(36, 18) + p('M30 8L32 23M42 8L40 23M32 23H40M36 23V44M36 44L35 61M36 44L37 61') + m(v, 31, 14),
  },
  plank: {
    start: (v) => h(12, 46) + p('M18 49L60 61M18 49V62H30') + m(v, 34, 54),
    end: (v) => h(12, 45) + p('M18 48L60 61M18 48V62H30') + m(v, 34, 53),
  },
  sideplank: {
    start: (v) => h(13, 44) + p('M16 49L60 62M16 49V62H24M16 49L16 32') + m(v, 34, 54),
    end: (v) => h(13, 43) + p('M16 48L60 62M16 48V62H24M16 48L22 31') + m(v, 34, 53),
  },
  crunch: {
    start: (v) => h(14, 56) + p('M19 59H40L50 46L58 62M22 59L14 52') + m(v, 31, 57),
    end: (v) => h(20, 43) + p('M25 47L40 59L50 46L58 62M27 49L18 42') + m(v, 33, 54),
  },
  legraise: {
    start: (v) => q(v, 'M22 6H50') + h(31, 20) + p('M36 6V24M36 24V44M36 44V62') + m(v, 38, 36),
    end: (v) => q(v, 'M22 6H50') + h(31, 20) + p('M36 6V24M36 24V44M36 44H58') + m(v, 38, 38),
  },
  lyinglegraise: {
    start: (v) => h(10, 58) + p('M15 60H40H64') + m(v, 34, 58),
    end: (v) => h(10, 58) + p('M15 60H40L48 36') + m(v, 34, 58),
  },
  cablecrunch: {
    start: (v) => q(v, 'M30 2V8') + q(v, 'M30 8L34 22', 2) + h(34, 22) + p('M40 44L36 27M40 44V62H54') + m(v, 38, 38),
    end: (v) => q(v, 'M30 2V8') + q(v, 'M30 8L24 40', 2) + h(23, 42) + p('M40 44L28 38M40 44V62H54') + m(v, 34, 42),
  },
  russian: {
    start: (v) => h(23, 30) + p('M36 56L26 36M36 56L48 46L58 52M27 40L18 48') + plate(v, 16, 50, 4) + m(v, 31, 46),
    end: (v) => h(23, 30) + p('M36 56L26 36M36 56L48 46L58 52M27 40L36 46') + plate(v, 39, 47, 4) + m(v, 31, 46),
  },
  abwheel: {
    start: (v) => ring(v, 30, 59, 4) + h(31, 31) + p('M44 62H58M44 62V48L34 36M35 38L30 55') + m(v, 40, 44),
    end: (v) => ring(v, 9, 59, 4) + h(13, 49) + p('M44 62H58M44 62L40 56L18 52M20 52L10 56') + m(v, 30, 54),
  },
  hipthrust: {
    start: (v) => pad(v, 4, 38, 18) + q(v, 'M8 42v22M18 42v22') + h(15, 36) + p('M20 40L34 56L48 46L52 62') + plate(v, 34, 51, 5) + m(v, 36, 58),
    end: (v) => pad(v, 4, 38, 18) + q(v, 'M8 42v22M18 42v22') + h(15, 36) + p('M20 40L36 42L50 42L52 62') + plate(v, 36, 37, 5) + m(v, 38, 46),
  },
  glutebridge: {
    start: (v) => h(9, 58) + p('M14 61H32L44 48L50 62') + m(v, 30, 58),
    end: (v) => h(9, 58) + p('M14 61L32 48L46 44L50 62') + m(v, 32, 52),
  },
  calf: {
    start: (v) => pad(v, 30, 58, 16, 6) + h(36, 8) + p('M36 13V37M36 37V58H42M36 18L37 36') + m(v, 36, 50),
    end: (v) => pad(v, 30, 58, 16, 6) + h(36, 3) + p('M36 8V32M36 32V53L42 58M36 13L37 31') + m(v, 36, 46),
  },
  seatedcalf: {
    start: (v) => pad(v, 20, 40, 18) + pad(v, 42, 32, 10) + h(30, 12) + p('M30 17L32 38L46 38V58H52') + m(v, 46, 50),
    end: (v) => pad(v, 20, 40, 18) + pad(v, 42, 28, 10) + h(30, 12) + p('M30 17L32 38L46 34V54L52 58') + m(v, 46, 46),
  },
  abduct: {
    start: (v) => pad(v, 26, 40, 20) + q(v, 'M26 44V56M46 44V56') + h(36, 12) + p('M36 17V40M36 40L32 48V62M36 40L40 48V62') + m(v, 30, 42),
    end: (v) => pad(v, 26, 40, 20) + q(v, 'M18 44V56M54 44V56') + h(36, 12) + p('M36 17V40M36 40L24 48L28 62M36 40L48 48L44 62') + m(v, 30, 42),
  },
  adduct: {
    start: (v) => pad(v, 26, 40, 20) + q(v, 'M30 44V56M42 44V56') + h(36, 12) + p('M36 17V40M36 40L24 48L28 62M36 40L48 48L44 62') + m(v, 32, 46),
    end: (v) => pad(v, 26, 40, 20) + q(v, 'M33 44V56M39 44V56') + h(36, 12) + p('M36 17V40M36 40L32 48V62M36 40L40 48V62') + m(v, 34, 46),
  },
  kickback: {
    start: (v) => q(v, 'M8 4V64') + q(v, 'M8 60L40 60', 2) + h(34, 11) + p('M35 16L37 39M37 39V62M37 39L40 60M35 22L12 26') + m(v, 39, 40),
    end: (v) => q(v, 'M8 4V64') + q(v, 'M8 60L56 50', 2) + h(32, 13) + p('M33 18L37 39M37 39V62M37 39L56 50M33 24L12 26') + m(v, 39, 40),
  },
  stepup: {
    start: (v) => box(v, 38, 50, 22, 14) + h(30, 12) + p('M30 17V36M30 36L26 62M30 36L42 42L44 50') + m(v, 34, 38),
    end: (v) => box(v, 38, 50, 22, 14) + h(48, 6) + p('M48 11V28M48 28L46 50M48 28L52 50') + m(v, 48, 30),
  },
  pistol: {
    start: (v) => side() + p('M36 39L50 44M36 22L50 24') + m(v, 37, 48),
    end: (v) => h(31, 28) + p('M32 33L34 52M34 52L42 46L40 62M34 52L58 50M32 38L50 36') + m(v, 40, 49),
  },
  run: {
    start: (v) => runFig(0, true) + m(v, 40, 44),
    end: (v) => runFig(0, false) + m(v, 38, 44),
  },
  treadmill: {
    start: (v) => q(v, 'M8 61H58', 4) + q(v, 'M58 61L62 30L54 28') + runFig(-4, true) + m(v, 36, 44),
    end: (v) => q(v, 'M8 61H58', 4) + q(v, 'M58 61L62 30L54 28') + runFig(-4, false) + m(v, 34, 44),
  },
  bike: {
    start: (v) => q(v, 'M30 36L36 56M22 62H54M48 26L46 52') + ring(v, 44, 54, 6) + h(46, 14) + p('M32 34L42 20M42 22L48 28M32 34L42 40L40 54') + m(v, 36, 36),
    end: (v) => q(v, 'M30 36L36 56M22 62H54M48 26L46 52') + ring(v, 44, 54, 6) + h(46, 14) + p('M32 34L42 20M42 22L48 28M32 34L40 28L46 46') + m(v, 36, 32),
  },
  elliptical: {
    start: (v) => q(v, 'M12 62H60M50 6L46 40') + h(36, 10) + p('M36 15V39M36 39L44 50L46 58M36 39L30 50L26 58M36 21L48 12') + m(v, 39, 46),
    end: (v) => q(v, 'M12 62H60M44 6L48 40') + h(36, 10) + p('M36 15V39M36 39L40 50L36 58M36 39L36 50L44 58M36 21L44 22') + m(v, 37, 46),
  },
  rower: {
    start: (v) => q(v, 'M6 60H64M60 46V60') + q(v, 'M60 46L56 44', 2) + h(46, 31) + p('M36 57L44 38M36 57L46 42L58 52M43 40L56 44') + m(v, 40, 48),
    end: (v) => q(v, 'M6 60H64M60 46V60') + q(v, 'M60 46L24 44', 2) + h(12, 31) + p('M20 57L14 37M20 57L58 54M15 40L24 46L24 44') + m(v, 18, 44),
  },
  jumprope: {
    start: (v) => q(v, 'M27 34Q36 -10 45 34', 2) + front() + p('M36 20L27 34M36 20L45 34') + m(v, 34, 56),
    end: (v) => q(v, 'M27 30Q36 82 45 30', 2) + front(36, 6) + p('M36 16L27 30M36 16L45 30') + m(v, 34, 52),
  },
  stepper: {
    start: (v) => q(v, 'M8 64H22V56H36V48H50V40H64') + h(36, 8) + p('M36 13V32M36 32L30 44L30 56M36 32L44 38L44 48') + m(v, 38, 36),
    end: (v) => q(v, 'M8 64H22V56H36V48H50V40H64') + h(40, 7) + p('M40 12V28M40 28L34 40L30 48M40 28L44 48') + m(v, 42, 34),
  },
  burpee: {
    start: (v) => h(23, 34) + p('M40 44L27 37M27 38L24 62M40 44L32 50L34 62') + m(v, 34, 48),
    end: (v) => h(36, 8) + p('M36 13V35M36 35L32 55M36 35L40 55M36 18L28 3M36 18L44 3') + m(v, 34, 44),
  },
  boxjump: {
    start: (v) => box(v, 40, 44, 22, 20) + h(29, 22) + p('M28 27L24 46M24 46L33 50L27 62M28 32L18 40') + m(v, 30, 48),
    end: (v) => box(v, 40, 44, 22, 20) + h(49, 9) + p('M48 14L46 30M46 30L54 36L50 44M48 18L58 22') + m(v, 52, 34),
  },
  kbswing: {
    start: (v) => h(23, 27) + p('M42 62L40 50L44 38L28 30M28 30L39 47') + kb(v, 41, 50) + m(v, 44, 40),
    end: (v) => side() + p('M36 20L54 22') + kb(v, 58, 22) + m(v, 37, 40),
  },
  swim: {
    start: (v) => q(v, 'M4 52Q10 48 16 52T28 52T40 52T52 52T64 52', 2) + h(12, 42) + p('M16 44H48M48 44L60 40M48 44L60 48M20 44L26 30L14 30') + m(v, 30, 44),
    end: (v) => q(v, 'M4 52Q10 48 16 52T28 52T40 52T52 52T64 52', 2) + h(12, 42) + p('M16 44H48M48 44L60 42M48 44L60 46M20 44L6 48') + m(v, 30, 44),
  },
  walk: {
    start: (v) => side() .replace('l-2 23', 'l-6 23').replace('l2 23', 'l6 23') + p('M36 20L32 36M36 20L41 35') + m(v, 38, 50),
    end: (v) => side() + p('M36 20L35 37M36 20L38 37') + m(v, 37, 50),
  },
  thruster: {
    start: (v) => h(32, 27) + p('M32 32L28 48L42 48L40 62M28 48L22 62M32 36L24 32L26 26M32 36L40 32L38 26') + db(v, 26, 25) + db(v, 38, 25) + m(v, 34, 46),
    end: (v) => front() + p('M36 20L29 12L29 5M36 20L43 12L43 5') + db(v, 29, 4) + db(v, 43, 4) + m(v, 31, 19),
  },
  sled: {
    start: (v) => q(v, 'M50 30V58M44 58H66M58 40V58') + h(47, 24) + p('M30 40L43 28M43 28L50 32M30 40L38 50L36 62M30 40L20 52L12 62') + m(v, 34, 46),
    end: (v) => q(v, 'M50 30V58M44 58H66M58 40V58') + h(47, 24) + p('M30 40L43 28M43 28L50 32M30 40L26 50L28 62M30 40L36 50L20 58') + m(v, 30, 48),
  },
  ohcarry: {
    start: (v) => side() .replace('l-2 23', 'l-6 23').replace('l2 23', 'l6 23') + p('M36 20L38 4M36 20L36 36') + db(v, 38, 3) + m(v, 37, 18),
    end: (v) => side() + p('M36 20L38 4M36 20L36 36') + db(v, 38, 3) + m(v, 37, 18),
  },
  vacuum: {
    start: (v) => h(36, 10) + p('M36 15Q42 27 36 39M36 39l-2 23M36 39l2 23M36 20L34 36') + m(v, 39, 28),
    end: (v) => h(36, 10) + p('M36 15Q31 27 36 39M36 39l-2 23M36 39l2 23M36 20L34 36') + m(v, 34, 28),
  },
  deadbug: {
    start: (v) => h(10, 57) + p('M15 59H40M24 59V40M40 59V43H52') + m(v, 32, 57),
    end: (v) => h(10, 57) + p('M15 59H40M24 59L8 50M40 59L62 54') + m(v, 32, 57),
  },
  bicycle: {
    start: (v) => h(20, 46) + p('M24 50L40 58M40 58L34 44L44 40M40 58L62 54M26 49L30 42') + m(v, 32, 54),
    end: (v) => h(20, 46) + p('M24 50L40 58M40 58L62 52M40 58L36 46L46 42M26 49L32 46') + m(v, 32, 54),
  },
  pullover: {
    start: (v) => benchPre(v) + p('M28 36L10 42') + db(v, 7, 43) + m(v, 26, 34),
    end: (v) => benchPre(v) + p('M28 36L30 18') + db(v, 30, 15) + m(v, 26, 34),
  },
  chestpress: {
    start: (v) => pad(v, 24, 46, 22) + q(v, 'M24 46V24') + h(32, 20) + p('M32 25V44H46V58M32 29L40 32L42 26') + pad(v, 40, 24, 6, 4) + m(v, 34, 30),
    end: (v) => pad(v, 24, 46, 22) + q(v, 'M24 46V24') + h(32, 20) + p('M32 25V44H46V58M32 29L56 28') + pad(v, 54, 26, 6, 4) + m(v, 34, 30),
  },
  cablepullover: {
    start: (v) => q(v, 'M64 2V64') + q(v, 'M64 4L52 8', 2) + h(34, 12) + p('M35 17L37 40M37 40L35 62M37 40L39 62M35 22L52 8') + m(v, 34, 28),
    end: (v) => q(v, 'M64 2V64') + q(v, 'M64 4L46 40', 2) + h(34, 12) + p('M35 17L37 40M37 40L35 62M37 40L39 62M35 22L46 40') + m(v, 34, 28),
  },
  goblet: {
    start: (v) => front() + p('M36 20L30 28L34 27M36 20L42 28L38 27') + kb(v, 36, 28) + m(v, 34, 44),
    end: (v) => h(36, 26) + p('M36 31V46M36 46L26 50L28 62M36 46L46 50L44 62M36 34L30 40L34 39M36 34L42 40L38 39') + kb(v, 36, 40) + m(v, 30, 50),
  },
  airsquat: {
    start: (v) => side() + p('M36 20L54 22') + m(v, 37, 46),
    end: (v) => h(38, 22) + p('M36 27L30 46M30 46L42 44L40 62M35 31L54 30') + m(v, 36, 46),
  },
  // Combined movements (cover muscle sets no single picture had: back + legs + shoulders, chest + back + arms…).
  cleanpress: {
    start: (v) => plate(v, 30, 57, 7) + h(21, 27) + p('M42 62L40 50L44 38L26 31M26 31L29 53') + m(v, 44, 40),
    end: (v) => bar(v, 18, 54, 4) + h(36, 10) + p('M36 15V37M36 37L28 62M36 37L46 62M36 20L29 12L29 5M36 20L43 12L43 5') + m(v, 31, 19),
  },
  renegade: {
    start: (v) => h(14, 42) + p('M20 44L58 62M20 44V59M24 46L28 59') + db(v, 20, 61) + db(v, 28, 61) + m(v, 30, 49),
    end: (v) => h(14, 42) + p('M20 44L58 62M20 44V59M24 46L31 38L30 47') + db(v, 20, 61) + db(v, 30, 48) + m(v, 30, 46),
  },
  burpeepull: {
    start: (v) => q(v, 'M14 14H58') + h(23, 34) + p('M40 44L27 37M27 38L24 62M40 44L32 50L34 62') + m(v, 34, 48),
    end: (v) => q(v, 'M14 14H58') + h(36, 8) + p('M26 14L23 24L31 18M46 14L49 24L41 18M31 18H41M36 13V36M36 36L33 47M36 36L39 47') + m(v, 33, 24),
  },
  getup: {
    start: (v) => h(12, 56) + p('M16 58H42M42 58L58 62M42 58L52 50L58 62M20 58V40M24 58L30 62') + kb(v, 20, 36) + m(v, 21, 50),
    end: (v) => h(36, 20) + p('M36 25V44M36 44L30 62H18M36 44L46 48L46 62M36 29L38 11M36 29L28 40') + kb(v, 38, 7) + m(v, 37, 30),
  },
  squatcurlpress: {
    start: (v) => h(32, 27) + p('M32 32L28 48L42 48L40 62M28 48L22 62M32 36L37 47') + db(v, 38, 49) + m(v, 29, 42),
    end: (v) => front() + p('M36 20L30 30L31 22M36 20L42 30L41 22') + db(v, 31, 21) + db(v, 41, 21) + m(v, 31, 27),
  },
  kickbackarm: {
    start: (v) => h(21, 23) + p('M42 62L40 48L44 36L26 26M28 27L36 30L36 42') + db(v, 36, 44) + m(v, 32, 29),
    end: (v) => h(21, 23) + p('M42 62L40 48L44 36L26 26M28 27L50 34') + db(v, 53, 35) + m(v, 34, 30),
  },
};
