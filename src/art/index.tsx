import { exerciseSvg, ALL_KINDS } from './XExercise.js';
import { foodSvg } from './XFood.js';
import { musclesSvgs } from './XMuscles.js';
import { logoSvg, TAB_ICONS, SIDEBAR_ITEMS, LOGOUT_ICON_D } from './shellIcons.js';
import { useTheme } from '../lib/theme';

export { TAB_ICONS, SIDEBAR_ITEMS, LOGOUT_ICON_D };
export const KINDS = ALL_KINDS as string[];

const Raw = ({ html, className, style }: { html: string; className?: string; style?: React.CSSProperties }) => (
  <span className={className} style={{ display: 'inline-flex', flex: 'none', ...style }} dangerouslySetInnerHTML={{ __html: html }} />
);

/** Exercise illustration; falls back to a letter tile when the exercise has no drawing. */
export function ExerciseArt({ kind, name, phase = 'end', size = 56 }: { kind?: string | null; name?: string; phase?: 'start' | 'end'; size?: number }) {
  const theme = useTheme();
  if (kind && KINDS.includes(kind)) return <Raw html={exerciseSvg({ kind, phase, size, theme })} />;
  return (
    <span aria-hidden="true" style={{
      width: size, height: size, borderRadius: Math.round(size / 5), background: 'var(--btn)', color: 'var(--acc)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
      fontFamily: 'var(--display)', fontWeight: 800, fontSize: Math.round(size * 0.42),
    }}>{(name ?? '?').trim().charAt(0).toUpperCase()}</span>
  );
}

const FOOD_KINDS = ['oat', 'eggs', 'buckwheat', 'chicken', 'curd', 'salmon', 'dish'];
export function FoodArt({ kind, size = 48 }: { kind?: string | null; size?: number }) {
  return <Raw html={foodSvg({ kind: kind && FOOD_KINDS.includes(kind) ? kind : 'dish', size })} />;
}

export function Muscles({ primary, secondary }: { primary: string[]; secondary: string[] }) {
  const theme = useTheme();
  const { front, back } = musclesSvgs({ primary, secondary, theme });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, color: 'var(--muted)', fontSize: 12, fontWeight: 700 }}>
      <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}><Raw html={front} /><figcaption>Спереди</figcaption></figure>
      <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}><Raw html={back} /><figcaption>Сзади</figcaption></figure>
    </div>
  );
}

export const Logo = ({ size = 48 }: { size?: number }) => <Raw html={logoSvg({ size })} />;

export function Icon({ d, size = 22, html }: { d?: string; size?: number; html?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      dangerouslySetInnerHTML={html ? { __html: html } : undefined}>{d ? <path d={d} /> : null}</svg>
  );
}
