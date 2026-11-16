import { useEffect, useState } from 'react';
import { mmss } from '../lib/calc';
import { useQuery } from '../lib/query';
import type { Workout } from '../lib/types';

/** What the workout screen saved for itself (WorkoutFlow persists its state under this key). */
interface Saved { screen: string; ei: number; si: number; restEndsAt: number | null; startedAt?: number }
const PREFIX = 'podhod-flow-';

function findLive(): { id: number; s: Saved } | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(PREFIX)) continue;
      const s = JSON.parse(localStorage.getItem(k) ?? 'null') as Saved | null;
      if (s && s.screen !== 'done') return { id: Number(k.slice(PREFIX.length)), s };
    }
  } catch { /* no storage */ }
  return null;
}

/**
 * «Тренировка идёт · Продолжить»: shown over the tab bar (phone) or on top of the page (computer) while a workout
 * was left with «Свернуть». During rest it counts down. A workout finished or deleted elsewhere drops its record.
 */
export function LiveBar({ route, wide }: { route: string; wide: boolean }) {
  const [live, setLive] = useState(findLive);
  useEffect(() => { setLive(findLive()); }, [route]);
  const q = useQuery<{ workout: Workout }>(live ? `/workouts/${live.id}` : null);
  const [, tick] = useState(0);
  const resting = !!live && live.s.screen === 'rest' && !!live.s.restEndsAt && live.s.restEndsAt > Date.now();
  useEffect(() => {
    if (!resting) return;
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [resting]);

  const w = q.data?.workout;
  const stale = !!live && (!!q.error || (!!w && (w.status === 'finished' || (live.s.startedAt != null && live.s.startedAt !== w.startedAt))));
  useEffect(() => {
    if (!stale || !live) return;
    try { localStorage.removeItem(PREFIX + live.id); } catch { /* */ }
    setLive(null);
  }, [stale, live]);
  if (!live || !w || stale) return null;

  const ex = w.exercises[live.s.ei];
  const pos = ex ? `${ex.name} · подход ${live.s.si + 1} из ${ex.sets.length}` : w.title;
  const left = resting ? Math.max(0, Math.ceil((live.s.restEndsAt! - Date.now()) / 1000)) : 0;
  return (
    <a href={`#/workout/${live.id}`} className="live-bar a-in" aria-label="Вернуться к тренировке" style={{ margin: wide ? 0 : '8px 16px', maxWidth: wide ? 1200 : undefined }}>
      <span className="a-pulse live-ico" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M3 12h3M18 12h3M6 8v8M18 8v8M9 10v4M15 10v4M9 12h6" /></svg>
      </span>
      <span className="grow col" style={{ gap: 1, minWidth: 0, lineHeight: 1.2 }}>
        <b className="num" style={{ fontSize: 16 }}>{resting ? `Отдых · ${mmss(left)}` : 'Тренировка идёт'}</b>
        <span className="ell" style={{ fontSize: 13, fontWeight: 700 }}>{resting ? `Дальше: ${pos}` : pos}</span>
      </span>
      <span className="live-go">Продолжить</span>
    </a>
  );
}
