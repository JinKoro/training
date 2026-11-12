import { useId } from 'react';

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Front silhouette whose waist, hips, limbs and belly grow with body fat (men 10-35 %, women 15-40 %). */
export function BodyFigure({ sex, fat, size = 96, selected }: { sex: 'm' | 'f'; fat: number; size?: number; selected?: boolean }) {
  const cid = 'bf' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const fem = sex === 'f';
  const t = Math.max(0, Math.min(1, (fat - (fem ? 15 : 10)) / 25));
  const S = fem ? 12 + 1.5 * t : 14.6 + 1.6 * t, Ch = fem ? 10.2 + 2.4 * t : 11.6 + 2.6 * t, W = fem ? 7 + 6.2 * t : 9 + 8 * t;
  const B = fem ? 1.4 * t : 3 * t, H = fem ? 12.2 + 5 * t : 10.4 + 4.2 * t;
  const au = fem ? 3.6 + 1.8 * t : 4.4 + 2 * t, tw = fem ? 8.6 + 7 * t : 8 + 5.5 * t, kw = fem ? 4.6 + 1.8 * t : 5 + 1.8 * t;
  const cw = fem ? 5.2 + 2 * t : 5.8 + 2 * t, aw = fem ? 2.8 + 0.5 * t : 3.1 + 0.6 * t, nx = fem ? 2.5 : 3.1;
  const lc = H - tw / 2, gI = Math.max(0.5, H - tw), kC = lc - 0.6, kO = kC + kw / 2, kI = Math.max(0.6, kC - kw / 2);
  const cC = lc - 0.8, cO = cC + cw / 2, cI = Math.max(0.6, cC - cw / 2), aC = lc - 1.3, aO = aC + aw / 2, aI = Math.max(0.5, aC - aw / 2);
  const eI = Math.max(W, Ch - 0.5) + 1.6 + 0.3 * t, eO = eI + au * 0.9, wI = Math.max(W + B, H) + 1.4, wO = wI + au * 0.7, hC = (wI + wO) / 2;
  const p = (x: number, y: number) => `${r1(30 + x)} ${r1(y)}`;
  const x = (v: number) => r1(30 + v), X = (v: number) => r1(30 - v);
  const top = `M${p(0, 15.5)}L${p(nx, 15.5)}L${p(nx, 21.2)}C${p(nx + 2, 22)} ${p(S - 3, 22)} ${p(S - 1.4, 23)}`;
  const arm = `C${p(S + 0.9, 24)} ${p(S + 1.5, 26.5)} ${p(S + 1.4, 30)}C${p(S + 1.3, 34)} ${p(eO, 40)} ${p(eO, 45)}C${p(eO, 51)} ${p(wO, 56)} ${p(wO, 60)}C${p(wO + 0.5, 63)} ${p(wO - 0.3, 67.6)} ${p(hC, 67.6)}C${p(wI + 0.3, 67.6)} ${p(wI - 0.4, 63)} ${p(wI, 60)}C${p(wI, 56)} ${p(eI, 51)} ${p(eI, 45)}C${p(eI, 40)} ${p(S - 2.2, 35.5)} ${p(S - 3.2, 33.5)}`;
  const rest = `C${p(Ch, 36)} ${p(W, 43)} ${p(W, 48)}C${p(W + B, 53)} ${p(H, 56)} ${p(H, 62)}C${p(H + 0.3, 68)} ${p(kO + 0.8, 80)} ${p(kO, 88)}C${p(kO + 0.6, 92)} ${p(cO, 94)} ${p(cO, 99)}C${p(cO, 103)} ${p(aO, 106)} ${p(aO, 109.5)}C${p(aO + 0.4, 111.5)} ${p(aO + 2.6, 112.6)} ${p(aO + 2.2, 114.2)}L${p(aI - 0.3, 114.2)}C${p(aI - 0.6, 112.5)} ${p(aI, 111)} ${p(aI, 109.5)}C${p(aI, 106)} ${p(cI, 103)} ${p(cI, 99)}C${p(cI, 95)} ${p(kI, 92)} ${p(kI, 88)}C${p(kI, 80)} ${p(gI, 74)} ${p(gI, 70)}C${p(gI, 68.5)} ${p(gI * 0.5, 67.5)} ${p(0, 67.5)}Z`;
  const body = top + arm + rest, trunk = top + `L${p(S - 3.2, 33.5)}` + rest;
  const clothes = fem ? `M${X(S)} 31Q30 36.5 ${x(S)} 31V41.5H${X(S)}ZM0 57.5H60V106.5H0Z` : 'M0 58.5H60V77.5H0Z';
  const straps = fem ? `M${X(nx + 1.2)} 22.2L${X(S - 3.6)} 31.5M${x(nx + 1.2)} 22.2L${x(S - 3.6)} 31.5` : '';
  const band = fem ? `M${X(W + B * 0.5)} 59.4H${x(W + B * 0.5)}` : `M${X(Math.max(H, W + B * 0.6))} 60.4H${x(Math.max(H, W + B * 0.6))}`;
  const abs = fem ? 'M30 44V50.5' : `M30 39.5V56.5M${X(W * 0.42)} 45.5H${x(W * 0.42)}M${X(W * 0.4)} 50.5H${x(W * 0.4)}M${X(Ch - 2.2)} 36.5Q${X(5.5)} 40 ${X(0.6)} 37.6M${x(Ch - 2.2)} 36.5Q${x(5.5)} 40 ${x(0.6)} 37.6`;
  const folds = fem ? `M${X(W * 0.8)} 55Q30 57.8 ${x(W * 0.8)} 55` : `M${X(W * 0.75)} 57.6Q30 61.2 ${x(W * 0.75)} 57.6M${X(Ch - 1.5)} 38Q${X(5)} 42.4 ${X(1)} 39M${x(Ch - 1.5)} 38Q${x(5)} 42.4 ${x(1)} 39`;
  const hair = fem ? 'M22.6 15.5C21 1.8 39 1.8 37.4 15.5L35.9 15.5C36.6 8 23.4 8 24.1 15.5Z' : 'M23.4 9.5C23 2.6 37 2.6 36.6 9.5C34.8 6.4 25.2 6.4 23.4 9.5Z';
  const skin = selected ? 'var(--bodyOn)' : 'var(--body)', cloth = selected ? 'var(--chart)' : 'var(--cloth)', hairC = selected ? 'var(--hairOn)' : 'var(--hair)';
  const line = 'rgba(16,21,28,.32)', mirror = 'translate(60 0) scale(-1 1)';
  return (
    <svg width={Math.round(size / 2)} height={size} viewBox="0 0 60 120" aria-hidden="true" style={{ display: 'block' }}>
      <defs><clipPath id={cid}><path d={trunk} /><path d={trunk} transform={mirror} /></clipPath></defs>
      <ellipse cx="30" cy="10" rx="6" ry="6.8" fill={skin} />
      <g fill={skin} stroke={skin} strokeWidth=".3" strokeLinejoin="round"><path d={body} /><path d={body} transform={mirror} /></g>
      <g clipPath={`url(#${cid})`} fill={cloth}><path d={clothes} /></g>
      {straps ? <path d={straps} fill="none" stroke={cloth} strokeWidth="1.5" strokeLinecap="round" /> : null}
      <g fill="none" stroke={line} strokeWidth=".6" strokeLinecap="round">
        <path d={abs} opacity={r1(Math.max(0, fem ? 0.5 - t * 1.6 : 1 - t * 1.9))} />
        <path d={folds} opacity={r1(Math.max(0, (t - 0.35) * 1.6))} />
      </g>
      <path d={band} clipPath={`url(#${cid})`} fill="none" stroke={line} strokeWidth=".6" />
      <circle cx="30" cy={fem ? 52 : 55} r=".7" fill={line} />
      <path d={hair} fill={hairC} />
    </svg>
  );
}
