// Verbatim from design/project/X01Welcome, XSidebar, XTabBar (.dc.html).
// All nav icons: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" [stroke-linejoin="round" — sidebar only]>

// Logo «Подход» (dumbbell on rounded tile). Default colours: tile = acc, bars = onAcc.
// Sizes used: 48 (auth screens), 32 (sidebar). Auth screens use fixed #A9CBFA / #10151C in both themes.
export const logoSvg = ({ size = 48, tile = '#A9CBFA', ink = '#10151C' } = {}) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="14" fill="${tile}"></rect><rect x="9" y="20" width="5" height="8" rx="1.5" fill="${ink}"></rect><rect x="34" y="20" width="5" height="8" rx="1.5" fill="${ink}"></rect><rect x="14" y="15" width="4" height="18" rx="1.5" fill="${ink}"></rect><rect x="30" y="15" width="4" height="18" rx="1.5" fill="${ink}"></rect><rect x="18" y="22.5" width="12" height="3" fill="${ink}"></rect></svg>`;

// Mobile tab bar (22x22). Inner markup per tab.
export const TAB_ICONS = {
  week: '<path d="M5 20V12M10 20V6M15 20V10M20 20V4"></path>',
  plan: '<path d="M3 12h3M18 12h3M6 8v8M18 8v8M9 10v4M15 10v4M9 12h6"></path>',
  food: '<path d="M3 12h18a9 9 0 0 1-18 0zM8 8c0-2 2-2 2-4M13 8c0-2 2-2 2-4"></path>',
  log: '<rect x="4" y="4" width="16" height="16" rx="2"></rect><path d="M4 10h16M4 15h16M10 4v16M15 4v16"></path>',
  me: '<circle cx="12" cy="8" r="4"></circle><path d="M4 21c1-4 4-6 8-6s7 2 8 6"></path>',
};

// Desktop sidebar (20x20). [key, label, design-route, path d]
export const SIDEBAR_ITEMS = [
  ['week', 'Неделя', 'X30Week', 'M5 20V12M10 20V6M15 20V10M20 20V4'],
  ['calendar', 'Календарь', 'D03Calendar', 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4'],
  ['workout', 'Тренировки', 'D04Workout', 'M3 12h3M18 12h3M6 8v8M18 8v8M9 10v4M15 10v4M9 12h6'],
  ['plan', 'Спорт', 'D05Programs', 'M5 5h14M5 12h14M5 19h9'],
  ['library', 'Упражнения', 'D06Library', 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'],
  ['log', 'Журнал', 'D07Log', 'M4 4h16v16H4zM4 10h16M4 15h16M10 4v16M15 4v16'],
  ['food', 'Еда', 'X32Food', 'M3 12h18a9 9 0 0 1-18 0zM8 8c0-2 2-2 2-4M13 8c0-2 2-2 2-4'],
  ['profile', 'Профиль', 'D02Profile', 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4 21c1-4 4-6 8-6s7 2 8 6'],
];
export const LOGOUT_ICON_D = 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10';
