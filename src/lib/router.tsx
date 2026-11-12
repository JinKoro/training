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
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function back(...fallback: (string | number)[]) {
  if (history.length > 1 && document.referrer !== '' ) history.back();
  else go(...fallback);
}

export function scrollTop() {
  const el = document.querySelector('.scroller');
  if (el) el.scrollTo(0, 0); else window.scrollTo(0, 0);
}
