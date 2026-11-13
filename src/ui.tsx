import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from './app-context';

export function TopBar({ left, title, right }: { left?: ReactNode; title?: ReactNode; right?: ReactNode }) {
  return (
    <div className="between" style={{ minHeight: 44 }}>
      <div style={{ minWidth: 60 }}>{left}</div>
      {title ? <div style={{ fontWeight: 800, fontSize: 17, textAlign: 'center' }} className="ell">{title}</div> : null}
      <div style={{ minWidth: 60, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
    </div>
  );
}

export const BackLink = ({ to, children }: { to: string; children: ReactNode }) => (
  <a className="link" href={to}>‹ {children}</a>
);

export function Field({ label, aside, error, children, id }: { label: ReactNode; aside?: ReactNode; error?: string | null; children: ReactNode; id?: string }) {
  return (
    <div className="field">
      <label htmlFor={id}><span>{label}</span>{aside ? <span className="muted">{aside}</span> : null}</label>
      {children}
      {error ? <span className="err" role="alert">{error}</span> : null}
    </div>
  );
}

/**
 * Bottom sheet (centered dialog on desktop). Rendered into <body>: on iPhone a fixed element inside the
 * scrolling content area gets clipped to it, which hid the sheet's bottom buttons behind the tab bar.
 */
export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  const { wide } = useApp();
  const [startY, setStartY] = useState<number | null>(null);
  const [dy, setDy] = useState(0);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <>
      <button className="scrim" aria-label="Закрыть" onClick={onClose} />
      <div
        className={`sheet${wide ? ' desk' : ''}`} role="dialog" aria-modal="true" aria-label={label}
        style={dy > 0 ? { transform: `translateY(${dy}px)`, transition: 'none' } : undefined}
        onTouchStart={(e) => { if ((e.currentTarget.scrollTop ?? 0) <= 0) setStartY(e.touches[0].clientY); }}
        onTouchMove={(e) => { if (startY !== null) setDy(Math.max(0, e.touches[0].clientY - startY)); }}
        onTouchEnd={() => { if (dy > 90) onClose(); setStartY(null); setDy(0); }}
      >
        <div className="grab" />
        {children}
      </div>
    </>,
    document.body,
  );
}

export function MacroBar({ name, value, norm, color, over }: { name: string; value: number; norm: number; color: string; over?: boolean }) {
  const pct = norm ? Math.min(100, Math.round((value / norm) * 100)) : 0;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr 84px', alignItems: 'center', gap: 10 }}>
      <span style={{ fontWeight: 700 }}>{name}</span>
      <div className="bar"><i className="a-fill" style={{ width: `${pct}%`, background: over ? 'var(--warn)' : color }} /></div>
      <span className="num" style={{ fontWeight: 800, textAlign: 'right', color: over ? 'var(--warnT)' : 'var(--ink)' }}>
        {Math.round(value)} / {Math.round(norm)}
      </span>
    </div>
  );
}

export function Stepper({ value, onDec, onInc, label }: { value: ReactNode; onDec: () => void; onInc: () => void; label: [string, string] }) {
  return (
    <div className="row" style={{ gap: 6 }}>
      <button className="icon-btn" aria-label={label[0]} onClick={onDec} style={{ background: 'var(--bg)' }}>−</button>
      <b className="num" style={{ minWidth: 48, textAlign: 'center' }}>{value}</b>
      <button className="icon-btn" aria-label={label[1]} onClick={onInc} style={{ background: 'var(--bg)' }}>+</button>
    </div>
  );
}

export const Skeleton = ({ n = 3 }: { n?: number }) => (
  <div className="col">{Array.from({ length: n }, (_, i) => <div key={i} className="skeleton" />)}</div>
);

export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  const code = (error as { code?: string })?.code;
  return (
    <div className="card col" style={{ alignItems: 'center', textAlign: 'center' }}>
      <b>{code === 'network' ? 'Нет связи с сервером' : 'Не получилось загрузить'}</b>
      {retry ? <button className="btn small sec" onClick={retry}>Повторить</button> : null}
    </div>
  );
}

/** Wraps a screen: on desktop adds an h1 row; on phone just the page column. */
export function Screen({ children, className = '', title, actions }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode }) {
  const { wide } = useApp();
  return (
    <div className={`page ${className}`}>
      {wide && title ? (
        <div className="between" style={{ flexWrap: 'wrap' }}>
          <h1 className="h1 a-h" style={{ fontSize: 30 }}>{title}</h1>
          {actions}
        </div>
      ) : null}
      {children}
    </div>
  );
}

let toastTimer: number | undefined;
/** How long a toast stays; quick-add checkmarks last the same. */
export const TOAST_MS = 2400;
export function toast(text: string) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = text;
  document.body.appendChild(el);
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.remove(), TOAST_MS);
}

export const errText = (e: unknown) => {
  const code = (e as { code?: string })?.code;
  if (code === 'network') return 'Нет связи с сервером';
  return 'Не получилось сохранить';
};

/**
 * Number field that is exactly as wide as its text, followed by a unit ("г", "шт"). A hidden copy of the value
 * sizes the grid cell the input sits in, so nothing is clipped and there is no empty space on any device.
 */
export function AmountInput({ value, onChange, unit, size, label }: { value: string; onChange: (v: string) => void; unit: string; size: number; label: string }) {
  const font: React.CSSProperties = { fontFamily: 'var(--display)', fontWeight: 800, fontSize: size, lineHeight: 1.1, letterSpacing: 0 };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: Math.round(size * 0.18) }}>
      <span style={{ display: 'inline-grid' }}>
        <span aria-hidden="true" style={{ ...font, gridArea: '1 / 1', visibility: 'hidden', whiteSpace: 'pre', padding: '0 1px' }}>{value || '0'}</span>
        <input aria-label={label} inputMode="numeric" size={1} value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
          style={{ ...font, gridArea: '1 / 1', width: '100%', minWidth: 0, padding: 0, margin: 0, border: 0, background: 'none', outline: 'none', color: 'var(--ink)', textAlign: 'center' }} />
      </span>
      <b style={{ ...font, fontSize: Math.round(size * 0.55) }}>{unit}</b>
    </span>
  );
}

/** «⋯» menu sheet rows (same look as the workout menu): plain rows, the destructive one in warn colour. */
export const menuRow: React.CSSProperties = { minHeight: 52, textAlign: 'left', fontWeight: 700, borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', width: '100%' };
export const MoreButton = ({ onClick, color }: { onClick: () => void; color?: string }) => (
  <button onClick={onClick} aria-label="Меню" style={{ width: 44, height: 44, fontSize: 24, fontWeight: 800, color: color ?? 'var(--ink)', flex: 'none' }}>⋯</button>
);
