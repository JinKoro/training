import { useEffect, useState } from 'react';

/** Tiny hash router: "#/food/2026-11-12" -> ["food", "2026-11-12"]. Works on GitHub Pages without rewrites. */
export function parseHash(hash = location.hash): string[] {
  return hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
}

export function useRoute(): string[] {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const onChange = () => { setRoute(parseHash()); scrollTop(); };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export const href = (...parts: (string | number)[]) => `#/${parts.map((p) => encodeURIComponent(String(p))).join('/')}`;

export function go(...parts: (string | number)[]) {
  location.hash = href(...parts);
}

export function replace(...parts: (string | number)[]) {
  history.replaceState(null, '', href(...parts));
  stack[stack.length - 1] = location.hash;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/**
 * In-app history: the hashes visited in this tab, so «‹ Назад» / «Отмена» can return to the screen the user
 * actually came from. A hash equal to the one before the last is a step back.
 */
const stack: string[] = [location.hash];
window.addEventListener('hashchange', () => {
  const h = location.hash;
  if (stack.length > 1 && stack[stack.length - 2] === h) stack.pop();
  else if (stack[stack.length - 1] !== h) stack.push(h);
});

/** Back to the previous in-app screen; `fallback` when the app was opened right here. */
export function back(...fallback: (string | number)[]) {
  if (stack.length > 1) history.back();
  else go(...fallback);
}

/** Same as back(), for a fallback written as a ready href ("#/week"). */
export function backTo(fallbackHref: string) {
  if (stack.length > 1) history.back();
  else location.hash = fallbackHref;
}

/** An <a> click handler that goes back in history instead of following the link (the link stays the fallback). */
export const onBackClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
  if (stack.length > 1) { e.preventDefault(); history.back(); }
};

export function scrollTop() {
  const el = document.querySelector('.scroller');
  if (el) el.scrollTo(0, 0); else window.scrollTo(0, 0);
}
