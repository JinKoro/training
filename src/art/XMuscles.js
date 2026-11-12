// Verbatim port of design/project/XMuscles.dc.html (hi-fi design). Template holes {{x}} became ${x}.
// Original <script type="text/x-dc"> logic is kept at the bottom as a comment for reference.

export const MUSCLE_GROUPS = {chest:'грудь',shoulders:'плечи',biceps:'бицепс',forearms:'предплечья',abs:'пресс',quads:'квадрицепс',calves:'икры',traps:'трапеции',reardelts:'задние дельты',lats:'широчайшие',triceps:'трицепс',lowerback:'поясница',glutes:'ягодицы',hamstrings:'бицепс бедра'};
// front view groups: shoulders chest biceps forearms abs quads calves; back view: traps reardelts lats triceps lowerback glutes hamstrings calves

export const MUSCLE_COLORS = {
  primary: '#E2703A', secondary: '#6F9BE3',
  dark:  { idle:'#3A4350', body:'#2A313C', muted:'#B3BCC8' },
  light: { idle:'#C3CAD5', body:'#DFE4EB', muted:'#5A6371' },
};

// ${body} = silhouette colour, ${f.<group>} = group colour, ${label} = comma-joined Russian names of primary groups.
export const MUSCLES_FRONT = ({ body, f, label }) => `<svg width="120" height="196" viewBox="0 0 100 196" role="img" aria-label="Мышцы спереди: ${label}">
      <circle cx="50" cy="16" r="11" fill="${body}"></circle><rect x="44" y="25" width="12" height="8" fill="${body}"></rect>
      <rect x="29" y="31" width="42" height="62" rx="14" fill="${body}"></rect><rect x="33" y="88" width="34" height="24" rx="9" fill="${body}"></rect>
      <rect x="15" y="37" width="13" height="64" rx="6.5" fill="${body}"></rect><rect x="72" y="37" width="13" height="64" rx="6.5" fill="${body}"></rect>
      <rect x="34" y="106" width="15" height="84" rx="7.5" fill="${body}"></rect><rect x="51" y="106" width="15" height="84" rx="7.5" fill="${body}"></rect>
      <circle cx="27" cy="43" r="7" fill="${f.shoulders}"></circle><circle cx="73" cy="43" r="7" fill="${f.shoulders}"></circle>
      <ellipse cx="41" cy="50" rx="9.5" ry="7" fill="${f.chest}"></ellipse><ellipse cx="59" cy="50" rx="9.5" ry="7" fill="${f.chest}"></ellipse>
      <ellipse cx="21.5" cy="62" rx="5" ry="9.5" fill="${f.biceps}"></ellipse><ellipse cx="78.5" cy="62" rx="5" ry="9.5" fill="${f.biceps}"></ellipse>
      <ellipse cx="21.5" cy="86" rx="4.5" ry="10" fill="${f.forearms}"></ellipse><ellipse cx="78.5" cy="86" rx="4.5" ry="10" fill="${f.forearms}"></ellipse>
      <rect x="43" y="60" width="14" height="28" rx="5" fill="${f.abs}"></rect>
      <ellipse cx="41.5" cy="130" rx="7" ry="19" fill="${f.quads}"></ellipse><ellipse cx="58.5" cy="130" rx="7" ry="19" fill="${f.quads}"></ellipse>
      <ellipse cx="41.5" cy="171" rx="5" ry="11" fill="${f.calves}"></ellipse><ellipse cx="58.5" cy="171" rx="5" ry="11" fill="${f.calves}"></ellipse>
    </svg>`;

export const MUSCLES_BACK = ({ body, f, label }) => `<svg width="120" height="196" viewBox="0 0 100 196" role="img" aria-label="Мышцы сзади: ${label}">
      <circle cx="50" cy="16" r="11" fill="${body}"></circle><rect x="44" y="25" width="12" height="8" fill="${body}"></rect>
      <rect x="29" y="31" width="42" height="62" rx="14" fill="${body}"></rect><rect x="33" y="88" width="34" height="24" rx="9" fill="${body}"></rect>
      <rect x="15" y="37" width="13" height="64" rx="6.5" fill="${body}"></rect><rect x="72" y="37" width="13" height="64" rx="6.5" fill="${body}"></rect>
      <rect x="34" y="106" width="15" height="84" rx="7.5" fill="${body}"></rect><rect x="51" y="106" width="15" height="84" rx="7.5" fill="${body}"></rect>
      <ellipse cx="50" cy="38" rx="15" ry="6" fill="${f.traps}"></ellipse>
      <circle cx="27" cy="43" r="7" fill="${f.reardelts}"></circle><circle cx="73" cy="43" r="7" fill="${f.reardelts}"></circle>
      <ellipse cx="40" cy="64" rx="9" ry="15" fill="${f.lats}"></ellipse><ellipse cx="60" cy="64" rx="9" ry="15" fill="${f.lats}"></ellipse>
      <ellipse cx="21.5" cy="62" rx="5" ry="9.5" fill="${f.triceps}"></ellipse><ellipse cx="78.5" cy="62" rx="5" ry="9.5" fill="${f.triceps}"></ellipse>
      <ellipse cx="50" cy="86" rx="8" ry="6" fill="${f.lowerback}"></ellipse>
      <ellipse cx="42.5" cy="102" rx="8" ry="8" fill="${f.glutes}"></ellipse><ellipse cx="57.5" cy="102" rx="8" ry="8" fill="${f.glutes}"></ellipse>
      <ellipse cx="41.5" cy="134" rx="6.5" ry="17" fill="${f.hamstrings}"></ellipse><ellipse cx="58.5" cy="134" rx="6.5" ry="17" fill="${f.hamstrings}"></ellipse>
      <ellipse cx="41.5" cy="171" rx="5" ry="11" fill="${f.calves}"></ellipse><ellipse cx="58.5" cy="171" rx="5" ry="11" fill="${f.calves}"></ellipse>
    </svg>`;

export function musclesSvgs({ primary = ['chest','triceps'], secondary = ['shoulders'], theme = 'dark' } = {}) {
  const t = MUSCLE_COLORS[theme], f = {};
  for (const k of Object.keys(MUSCLE_GROUPS)) f[k] = primary.includes(k) ? MUSCLE_COLORS.primary : secondary.includes(k) ? MUSCLE_COLORS.secondary : t.idle;
  const label = primary.map(k => MUSCLE_GROUPS[k]).filter(Boolean).join(', ');
  return { front: MUSCLES_FRONT({ body: t.body, f, label }), back: MUSCLES_BACK({ body: t.body, f, label }) };
}
