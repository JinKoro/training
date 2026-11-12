// Verbatim port of design/project/XExercise.dc.html (hi-fi design). Template holes {{x}} became ${x}.
// Original <script type="text/x-dc"> logic is kept at the bottom as a comment for reference.

export const EXERCISE_LABELS = {bench:'Жим штанги лёжа',pulldown:'Тяга верхнего блока',legext:'Разгибания ног',legcurl:'Сгибания ног',press:'Жим гантелей сидя',curl:'Сгибания рук с гантелями',legpress:'Жим ногами',hyper:'Гиперэкстензия',squat:'Приседания со штангой',lunge:'Выпады с гантелями',carry:'Фермерская прогулка'};

export const EXERCISE_COLORS = {
  dark:  { bg:'#2E3A4B', ink:'#F3F5F7', equip:'#A9CBFA', floor:'#4A5563', muscle:'#E2703A' },
  light: { bg:'#E9EEF8', ink:'#12151C', equip:'#3F63D0', floor:'#C3CAD5', muscle:'#E2703A' },
};

// Per kind, draw in order: `pre` (always), then `start` OR `end` (by phase), then `post` (always; the orange working-muscle dot). All inside the stroke group below.
// Placeholders: ${equip}, ${muscle}, ${cable} (pulldown cable length: 8 at start, 15 at end).
export const EXERCISE_KINDS = {
  bench: {
    pre: ({equip, muscle, cable}) => `<rect x="10" y="40" width="46" height="5" rx="2" fill="${equip}" stroke="none"></rect><path d="M16 45v19M50 45v19" stroke="${equip}"></path><circle cx="15" cy="35" r="4"></circle><path d="M20 36h24l8 10v12"></path>`,
    start: ({equip, muscle, cable}) => `<path d="M30 36V18"></path><path d="M18 18h24" stroke="${equip}" stroke-width="3"></path><rect x="15" y="13" width="4" height="10" rx="1" fill="${equip}" stroke="none"></rect><rect x="41" y="13" width="4" height="10" rx="1" fill="${equip}" stroke="none"></rect>`,
    end: ({equip, muscle, cable}) => `<path d="M30 36l-6-5 6-3"></path><path d="M18 28h24" stroke="${equip}" stroke-width="3"></path><rect x="15" y="23" width="4" height="10" rx="1" fill="${equip}" stroke="none"></rect><rect x="41" y="23" width="4" height="10" rx="1" fill="${equip}" stroke="none"></rect>`,
    post: ({equip, muscle, cable}) => `<circle cx="28" cy="35" r="3" fill="${muscle}" stroke="none"></circle>`,
  },
  pulldown: {
    pre: ({equip, muscle, cable}) => `<path d="M34 2v${cable}" stroke="${equip}" stroke-width="2"></path><rect x="24" y="46" width="22" height="4" rx="2" fill="${equip}" stroke="none"></rect><circle cx="34" cy="21" r="4"></circle><path d="M34 26v18h12v14"></path>`,
    start: ({equip, muscle, cable}) => `<path d="M34 29L26 11M34 29l8-18"></path><path d="M20 10h28" stroke="${equip}" stroke-width="3"></path>`,
    end: ({equip, muscle, cable}) => `<path d="M34 29l-10-2 2-10M34 29l10-2-2-10"></path><path d="M20 17h28" stroke="${equip}" stroke-width="3"></path>`,
    post: ({equip, muscle, cable}) => `<circle cx="31" cy="34" r="3" fill="${muscle}" stroke="none"></circle>`,
  },
  legext: {
    pre: ({equip, muscle, cable}) => `<rect x="22" y="46" width="22" height="4" rx="2" fill="${equip}" stroke="none"></rect><path d="M22 46V26" stroke="${equip}" stroke-width="3"></path><circle cx="30" cy="20" r="4"></circle><path d="M30 25v19h14"></path><path d="M30 30l6 8"></path>`,
    start: ({equip, muscle, cable}) => `<path d="M44 44v14"></path><circle cx="46" cy="56" r="3.5" fill="${equip}" stroke="none"></circle>`,
    end: ({equip, muscle, cable}) => `<path d="M44 44l16-4"></path><circle cx="60" cy="42" r="3.5" fill="${equip}" stroke="none"></circle>`,
    post: ({equip, muscle, cable}) => `<circle cx="38" cy="44" r="3" fill="${muscle}" stroke="none"></circle>`,
  },
  legcurl: {
    pre: ({equip, muscle, cable}) => `<rect x="22" y="46" width="22" height="4" rx="2" fill="${equip}" stroke="none"></rect><path d="M22 46V26" stroke="${equip}" stroke-width="3"></path><circle cx="30" cy="20" r="4"></circle><path d="M30 25v19h14"></path><path d="M30 30l6 8"></path>`,
    start: ({equip, muscle, cable}) => `<path d="M44 44l16 0"></path><circle cx="58" cy="47" r="3.5" fill="${equip}" stroke="none"></circle>`,
    end: ({equip, muscle, cable}) => `<path d="M44 44l-4 14"></path><circle cx="38" cy="58" r="3.5" fill="${equip}" stroke="none"></circle>`,
    post: ({equip, muscle, cable}) => `<circle cx="38" cy="46" r="3" fill="${muscle}" stroke="none"></circle>`,
  },
  press: {
    pre: ({equip, muscle, cable}) => `<rect x="24" y="46" width="22" height="4" rx="2" fill="${equip}" stroke="none"></rect><path d="M24 46V24" stroke="${equip}" stroke-width="3"></path><circle cx="34" cy="20" r="4"></circle><path d="M34 25v19h12v14"></path>`,
    start: ({equip, muscle, cable}) => `<path d="M34 29l-9 2v-11M34 29l9 2v-11"></path><rect x="21" y="15" width="8" height="4" rx="1" fill="${equip}" stroke="none"></rect><rect x="39" y="15" width="8" height="4" rx="1" fill="${equip}" stroke="none"></rect>`,
    end: ({equip, muscle, cable}) => `<path d="M34 29l-6-20M34 29l6-20"></path><rect x="24" y="5" width="8" height="4" rx="1" fill="${equip}" stroke="none"></rect><rect x="36" y="5" width="8" height="4" rx="1" fill="${equip}" stroke="none"></rect>`,
    post: ({equip, muscle, cable}) => `<circle cx="30" cy="28" r="3" fill="${muscle}" stroke="none"></circle>`,
  },
  curl: {
    pre: ({equip, muscle, cable}) => `<circle cx="36" cy="10" r="4"></circle><path d="M36 15v24M36 39l-4 23M36 39l4 23"></path>`,
    start: ({equip, muscle, cable}) => `<path d="M36 19l-3 12v11"></path><rect x="29" y="42" width="8" height="4" rx="1" fill="${equip}" stroke="none"></rect>`,
    end: ({equip, muscle, cable}) => `<path d="M36 19l-3 12 8-8"></path><rect x="39" y="19" width="8" height="4" rx="1" fill="${equip}" stroke="none"></rect>`,
    post: ({equip, muscle, cable}) => `<circle cx="34" cy="25" r="3" fill="${muscle}" stroke="none"></circle>`,
  },
  legpress: {
    pre: ({equip, muscle, cable}) => `<path d="M14 30l10 22" stroke="${equip}" stroke-width="4"></path><path d="M12 56h22" stroke="${equip}" stroke-width="3"></path><circle cx="18" cy="24" r="4"></circle><path d="M20 29l10 19"></path><path d="M24 36l10 4"></path>`,
    start: ({equip, muscle, cable}) => `<path d="M30 48l10-14 12 6"></path><path d="M54 28v20" stroke="${equip}" stroke-width="4"></path>`,
    end: ({equip, muscle, cable}) => `<path d="M30 48l28-10"></path><path d="M60 28v20" stroke="${equip}" stroke-width="4"></path>`,
    post: ({equip, muscle, cable}) => `<circle cx="36" cy="42" r="3" fill="${muscle}" stroke="none"></circle>`,
  },
  hyper: {
    pre: ({equip, muscle, cable}) => `<path d="M12 60l30-18" stroke="${equip}" stroke-width="4"></path><path d="M14 64l4-8M38 64l-2-20" stroke="${equip}" stroke-width="3"></path><path d="M14 56l26-15"></path>`,
    start: ({equip, muscle, cable}) => `<path d="M40 41l8 16"></path><circle cx="50" cy="61" r="4"></circle>`,
    end: ({equip, muscle, cable}) => `<path d="M40 41l18-10"></path><circle cx="62" cy="28" r="4"></circle>`,
    post: ({equip, muscle, cable}) => `<circle cx="40" cy="41" r="3" fill="${muscle}" stroke="none"></circle>`,
  },
  squat: {
    pre: ({equip, muscle, cable}) => ``,
    start: ({equip, muscle, cable}) => `<circle cx="36" cy="10" r="4"></circle><path d="M22 17h28" stroke="${equip}" stroke-width="3"></path><path d="M36 15v24M36 39l-5 23M36 39l5 23M36 20l-8-2M36 20l8-2"></path>`,
    end: ({equip, muscle, cable}) => `<circle cx="32" cy="27" r="4"></circle><path d="M18 34h28" stroke="${equip}" stroke-width="3"></path><path d="M32 32l-4 16 14 0 -2 14M28 48l-6 14M32 36l-8-2M32 36l8-2"></path>`,
    post: ({equip, muscle, cable}) => `<circle cx="34" cy="46" r="3" fill="${muscle}" stroke="none"></circle>`,
  },
  lunge: {
    pre: ({equip, muscle, cable}) => ``,
    start: ({equip, muscle, cable}) => `<circle cx="36" cy="10" r="4"></circle><path d="M36 15v24M36 39l-4 23M36 39l4 23M36 20l-4 18M36 20l4 18"></path><rect x="28" y="38" width="7" height="4" rx="1" fill="${equip}" stroke="none"></rect><rect x="38" y="38" width="7" height="4" rx="1" fill="${equip}" stroke="none"></rect>`,
    end: ({equip, muscle, cable}) => `<circle cx="34" cy="20" r="4"></circle><path d="M34 25v19M34 44l12 2 0 16M34 44l-10 10 -8 8M34 29l-3 16M34 29l4 16"></path><rect x="27" y="45" width="7" height="4" rx="1" fill="${equip}" stroke="none"></rect><rect x="35" y="45" width="7" height="4" rx="1" fill="${equip}" stroke="none"></rect>`,
    post: ({equip, muscle, cable}) => `<circle cx="40" cy="46" r="3" fill="${muscle}" stroke="none"></circle>`,
  },
  carry: {
    pre: ({equip, muscle, cable}) => `<circle cx="36" cy="10" r="4"></circle><path d="M36 15v24M36 20l-6 18M36 20l6 18"></path>`,
    start: ({equip, muscle, cable}) => `<path d="M36 39l-8 23M36 39l8 23"></path>`,
    end: ({equip, muscle, cable}) => `<path d="M36 39l-3 23M36 39l3 23"></path>`,
    post: ({equip, muscle, cable}) => `<rect x="25" y="38" width="9" height="6" rx="1.5" fill="${equip}" stroke="none"></rect><rect x="38" y="38" width="9" height="6" rx="1.5" fill="${equip}" stroke="none"></rect><path d="M54 30h10M58 26l6 4-6 4" stroke="${equip}" stroke-width="2"></path><circle cx="36" cy="24" r="3" fill="${muscle}" stroke="none"></circle>`,
  },
};

// Full SVG (size px square, viewBox 72x72, rounded tile radius = round(size/5)).
export function exerciseSvg({ kind = 'bench', phase = 'end', size = 72, theme = 'dark' } = {}) {
  const c = EXERCISE_COLORS[theme], K = EXERCISE_KINDS[kind];
  const v = { equip: c.equip, muscle: c.muscle, cable: phase === 'start' ? 8 : 15 };
  const label = EXERCISE_LABELS[kind] + (phase === 'start' ? ', начало' : ', конец');
  return `<svg width="${size}" height="${size}" viewBox="0 0 72 72" role="img" aria-label="${label}" style="display:block;border-radius:${Math.round(size/5)}px;background:${c.bg}">`
    + `<line x1="6" y1="64" x2="66" y2="64" stroke="${c.floor}" stroke-width="2" stroke-linecap="round"></line>`
    + `<g fill="none" stroke="${c.ink}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">`
    + K.pre(v) + K[phase](v) + K.post(v) + `</g></svg>`;
}
