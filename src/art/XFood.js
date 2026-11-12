// Verbatim port of design/project/XFood.dc.html (hi-fi design). Template holes {{x}} became ${x}.
// Original <script type="text/x-dc"> logic is kept at the bottom as a comment for reference.

export const FOOD_LABELS = {oat:'Овсянка',eggs:'Яйца',buckwheat:'Гречка',chicken:'Куриная грудка',curd:'Творог',salmon:'Лосось',dish:'Блюдо'};

// Plate (always drawn, same in both themes — food illustrations are fixed-colour pictures, not UI):
export const FOOD_PLATE = `<circle cx="60" cy="60" r="57" fill="#E9EDF2"></circle><circle cx="60" cy="60" r="46" fill="#F7F8FA"></circle>`;

export const FOOD_KINDS = {
  oat: `<circle cx="60" cy="60" r="38" fill="#D9B98A"></circle><circle cx="60" cy="60" r="38" fill="none" stroke="#C9A16C" stroke-width="3" stroke-dasharray="2 6"></circle><circle cx="50" cy="50" r="6" fill="#5B3C8F"></circle><circle cx="68" cy="56" r="5" fill="#5B3C8F"></circle><circle cx="58" cy="70" r="6" fill="#B8243C"></circle><circle cx="72" cy="72" r="4" fill="#5B3C8F"></circle>`,
  eggs: `<path d="M28 58c0-14 12-22 24-18s18 20 8 30-32 8-32-12z" fill="#FFFFFF"></path><circle cx="46" cy="56" r="9" fill="#F2B233"></circle><path d="M62 70c2-12 16-18 26-12s8 22-4 26-24-2-22-14z" fill="#FFFFFF"></path><circle cx="76" cy="72" r="8" fill="#F2B233"></circle>`,
  buckwheat: `<circle cx="60" cy="60" r="36" fill="#8A5A3B"></circle><circle cx="48" cy="50" r="2.5" fill="#B58256"></circle><circle cx="64" cy="46" r="2.5" fill="#B58256"></circle><circle cx="72" cy="62" r="2.5" fill="#B58256"></circle><circle cx="52" cy="70" r="2.5" fill="#B58256"></circle><circle cx="62" cy="76" r="2.5" fill="#B58256"></circle><circle cx="44" cy="62" r="2.5" fill="#B58256"></circle><path d="M66 52c6-4 12-2 14 2" stroke="#4CAF6A" stroke-width="4" stroke-linecap="round" fill="none"></path>`,
  chicken: `<rect x="28" y="40" width="64" height="40" rx="18" fill="#E8C39A"></rect><path d="M40 46l-6 28M54 44l-6 34M68 44l-6 34M82 46l-6 28" stroke="#B9855A" stroke-width="4" stroke-linecap="round"></path><circle cx="84" cy="86" r="7" fill="#4CAF6A"></circle>`,
  curd: `<circle cx="60" cy="60" r="36" fill="#FBF7EE"></circle><circle cx="48" cy="52" r="10" fill="#F1EADB"></circle><circle cx="68" cy="50" r="9" fill="#F1EADB"></circle><circle cx="60" cy="70" r="11" fill="#F1EADB"></circle><path d="M54 40c4 2 8 2 12 0" stroke="#D84B6B" stroke-width="5" stroke-linecap="round"></path>`,
  salmon: `<path d="M26 64c4-18 30-28 54-22 12 3 14 18 4 26-14 10-50 12-58-4z" fill="#F08A5D"></path><path d="M44 46l-4 24M56 42l-4 28M68 42l-4 28" stroke="#FFD2BD" stroke-width="4" stroke-linecap="round"></path><circle cx="86" cy="80" r="10" fill="#F2D54A"></circle><circle cx="86" cy="80" r="5" fill="#F7E58A"></circle>`,
  dish: `<path d="M60 24a36 36 0 0 0 0 72z" fill="#8A5A3B"></path><rect x="62" y="38" width="28" height="22" rx="9" fill="#E8C39A"></rect><circle cx="74" cy="76" r="9" fill="#4CAF6A"></circle><circle cx="84" cy="70" r="6" fill="#E2463B"></circle><circle cx="44" cy="52" r="2.5" fill="#B58256"></circle><circle cx="46" cy="70" r="2.5" fill="#B58256"></circle>`,
};

export function foodSvg({ kind = 'oat', size = 120 } = {}) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="${FOOD_LABELS[kind]}" style="display:block">` + FOOD_PLATE + FOOD_KINDS[kind] + `</svg>`;
}
