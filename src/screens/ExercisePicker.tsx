import { useState } from 'react';
import { useApp } from '../app-context';
import { exerciseSubtitle } from '../lib/calc';
import type { Exercise } from '../lib/types';
import { ExerciseArt } from '../art';

export const GROUP_CHIPS: [string, string | null][] = [['Все', null], ['Ноги', 'legs'], ['Спина', 'back'], ['Грудь', 'chest'], ['Плечи', 'shoulders'], ['Руки', 'arms'], ['Пресс', 'abs'], ['Кардио', 'cardio'], ['Мои', 'own']];

export function filterExercises(list: Exercise[], group: string | null, q: string) {
  const s = q.trim().toLowerCase();
  return list.filter((e) => (group === null ? true : group === 'own' ? e.own : e.group === group) && (!s || e.name.toLowerCase().includes(s)));
}

export function SearchInput({ value, onChange, placeholder = 'Поиск', id }: { value: string; onChange: (v: string) => void; placeholder?: string; id?: string }) {
  return (
    <div className="row" style={{ height: 50, borderRadius: 14, background: 'var(--card)', border: '1px solid var(--cardBorder)', padding: '0 14px', gap: 8 }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" style={{ color: 'var(--muted)', flex: 'none' }}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
      <input id={id} aria-label={placeholder} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1, border: 0, background: 'none', outline: 'none', fontSize: 16, minWidth: 0 }} />
      {value ? <button aria-label="Очистить" onClick={() => onChange('')} className="muted" style={{ width: 32, height: 32 }}>✕</button> : null}
    </div>
  );
}

/** Inline picker (not a modal): replaces the parent content while open. */
export function ExercisePicker({ subtitle, existing, onPick, onBack }: { subtitle: string; existing: number[]; onPick: (e: Exercise) => void; onBack: () => void }) {
  const { exercises } = useApp();
  const [q, setQ] = useState('');
  const [g, setG] = useState(0);
  const list = filterExercises(exercises, GROUP_CHIPS[g][1], q);
  return (
    <div className="col" style={{ gap: 12 }}>
      <div><button className="link" onClick={onBack}>‹ Назад</button></div>
      <div>
        <div className="muted" style={{ fontWeight: 700, fontSize: 14 }}>{subtitle}</div>
        <h2 className="display" style={{ fontSize: 22 }}>Добавить упражнение</h2>
      </div>
      <SearchInput value={q} onChange={setQ} />
      <div className="chips">{GROUP_CHIPS.map(([l], i) => <button key={l} className="chip" aria-pressed={g === i} onClick={() => setG(i)}>{l}</button>)}</div>
      <div className="col" style={{ gap: 8 }}>
        {list.map((e) => {
          const has = existing.includes(e.id);
          return (
            <button key={e.id} className="item" disabled={has} onClick={() => onPick(e)} style={{ opacity: has ? 0.5 : 1, minHeight: 60, borderRadius: 14 }}>
              <ExerciseArt kind={e.kind} name={e.name} size={44} />
              <div className="grow"><b>{e.name}</b><div className="sub ell">{exerciseSubtitle(e)}</div></div>
              <b style={{ color: 'var(--acc)', whiteSpace: 'nowrap' }}>{has ? 'уже есть' : '+'}</b>
            </button>
          );
        })}
        {!list.length ? <div className="empty">Ничего не нашлось</div> : null}
      </div>
    </div>
  );
}
