import { useState } from 'react';
import { useApp } from '../app-context';
import { api, ApiError } from '../lib/api';
import { MUSCLE_RU, exerciseSubtitle, mmss } from '../lib/calc';
import { invalidate } from '../lib/query';
import { go } from '../lib/router';
import type { Exercise } from '../lib/types';
import { ExerciseArt, KINDS, Muscles } from '../art';
import { KIND_MUSCLES } from '../lib/kindMuscles';
import { MoreButton, Screen, Sheet, errText, menuRow, toast } from '../ui';
import { GROUP_CHIPS, SearchInput, filterExercises } from './ExercisePicker';

const muscleLine = (e: Exercise) => {
  const p = e.primary.map((m) => MUSCLE_RU[m]).filter(Boolean).join(', ');
  const s = e.secondary.map((m) => MUSCLE_RU[m]).filter(Boolean).join(', ');
  return p ? `Основная: ${p}${s ? ` · помогают: ${s}` : ''}` : exerciseSubtitle(e);
};

function ExerciseCard({ e, wide }: { e: Exercise; wide?: boolean }) {
  const steps = e.steps.length ? e.steps : (e.description ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
  const [del, setDel] = useState(false);
  const [menu, setMenu] = useState(false);
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <h1 className="display a-h" style={{ fontSize: wide ? 22 : 24 }}>{e.name}</h1>
          <div className="muted" style={{ fontSize: 14 }}>{muscleLine(e)}</div>
        </div>
        {e.own ? <MoreButton onClick={() => setMenu(true)} /> : null}
      </div>
      <div className="card col a-in" style={{ gap: 12 }}>
        <b>Как выполнять</b>
        <div className="row" style={{ justifyContent: 'center', gap: 12 }}>
          <figure className="col" style={{ margin: 0, alignItems: 'center', gap: 4 }}><ExerciseArt kind={e.kind} name={e.name} phase="start" size={120} /><figcaption className="sub">Старт</figcaption></figure>
          <b style={{ color: 'var(--acc)', fontSize: 22 }}>→</b>
          <figure className="col" style={{ margin: 0, alignItems: 'center', gap: 4 }}><ExerciseArt kind={e.kind} name={e.name} phase="end" size={120} /><figcaption className="sub">Конец</figcaption></figure>
        </div>
        {steps.length > 1 ? <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          : steps.length === 1 ? <p style={{ margin: 0 }}>{steps[0]}</p> : null}
      </div>
      <div className="a-in" style={{ background: 'var(--sub)', borderRadius: 20, padding: 14, display: 'flex', justifyContent: 'center' }}>
        <Muscles primary={e.primary} secondary={e.secondary} />
      </div>
      {e.own ? (
        <>
          <Sheet open={menu} onClose={() => setMenu(false)} label="Упражнение">
            <b style={{ fontSize: 18 }}>Упражнение</b>
            <div className="col" style={{ gap: 0 }}>
              <a href={`#/exercise/${e.id}`} style={menuRow}>Изменить</a>
              <button onClick={() => { setMenu(false); setDel(true); }} style={{ ...menuRow, color: 'var(--warn)', borderBottom: 0 }}>Удалить упражнение</button>
            </div>
          </Sheet>
          <DeleteExercise e={e} open={del} onClose={() => setDel(false)} />
        </>
      ) : null}
    </div>
  );
}

function DeleteExercise({ e, open, onClose }: { e: Exercise; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} label="Удаление упражнения">
      <b className="display" style={{ fontSize: 20 }}>Удалить упражнение «{e.name}»?</b>
      <span className="muted">Прошедшие тренировки сохранятся.</span>
      <button className="btn" style={{ background: 'var(--warn)', color: '#fff' }} onClick={async () => {
        try { await api('DELETE', `/exercises/${e.id}`); invalidate('/exercises'); onClose(); go('exercises', 'mine'); } catch (err) { toast(errText(err)); }
      }}>Удалить</button>
      <button className="btn outline" onClick={onClose}>Отмена</button>
    </Sheet>
  );
}

export function LibraryScreen({ mine, selected }: { mine: boolean; selected: number | null }) {
  const { exercises, exById, wide } = useApp();
  const [q, setQ] = useState('');
  const [g, setG] = useState(mine ? GROUP_CHIPS.length - 1 : 0);
  const base = mine && !wide ? exercises.filter((e) => e.own) : exercises;
  const chips = mine && !wide ? [] : GROUP_CHIPS;
  const list = filterExercises(base, chips[g]?.[1] ?? null, q);
  const scope = mine ? 'mine' : 'all';
  const sel = selected ? exById.get(selected) : undefined;

  if (!wide && sel) {
    return (
      <Screen className="modal">
        <a className="link" href={`#/exercises${mine ? '/mine' : ''}`}>‹ {mine ? 'Мои упражнения' : 'Упражнения'}</a>
        <ExerciseCard e={sel} />
      </Screen>
    );
  }

  const grid = (
    <div className="col" style={{ gap: 12 }}>
      <SearchInput value={q} onChange={setQ} placeholder={wide ? 'Поиск упражнения' : 'Поиск'} />
      {chips.length ? <div className="chips" style={wide ? { flexWrap: 'wrap' } : undefined}>{chips.map(([l], i) => <button key={l} className="chip" aria-pressed={g === i} onClick={() => setG(i)}>{l}</button>)}</div> : null}
      {wide ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          <a href="#/exercise/new" className="a-in" style={{ minHeight: 160, border: '2px dashed var(--track)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 14, color: 'var(--acc)', fontWeight: 800 }}>+ Своё упражнение</a>
          {list.map((e) => (
            <a key={e.id} href={`#/exercises/${scope}/${e.id}`} className="card col a-in" style={{ borderRadius: 18, gap: 8, alignItems: 'flex-start', border: `2px solid ${(sel ?? list[0])?.id === e.id ? 'var(--acc)' : 'var(--cardBorder)'}` }}>
              <ExerciseArt kind={e.kind} name={e.name} size={84} />
              <b>{e.name}</b>
              <span className="sub">{exerciseSubtitle(e)}{e.own ? ' · своё' : ''}</span>
            </a>
          ))}
        </div>
      ) : (
        <div className="col" style={{ gap: 8 }}>
          {mine && !wide ? <a href="#/exercise/new" className="item a-in" style={{ minHeight: 60, color: 'var(--acc)', fontWeight: 800 }}>+ Добавить упражнение</a> : null}
          {list.map((e) => (
            <a key={e.id} href={`#/exercises/${scope}/${e.id}`} className="item a-in">
              <ExerciseArt kind={e.kind} name={e.name} size={60} />
              <div className="grow"><b>{e.name}</b><div className="sub">{exerciseSubtitle(e)}</div></div><span className="muted">›</span>
            </a>
          ))}
        </div>
      )}
      {!list.length ? (mine && !wide && !base.length ? <div className="empty">Своих упражнений пока нет</div> : <div className="empty">Ничего не нашлось</div>) : null}
    </div>
  );

  if (wide) {
    const shown = sel ?? list[0];
    return (
      <Screen title="Упражнения">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
          <section style={{ flex: '3 1 520px', minWidth: 0 }}>{grid}</section>
          <aside className="card" style={{ flex: '1 1 340px', minWidth: 0, borderRadius: 22, padding: 20, position: 'sticky', top: 20 }}>
            {shown ? <ExerciseCard key={shown.id} e={shown} wide /> : <div className="empty">Ничего не выбрано</div>}
          </aside>
        </div>
      </Screen>
    );
  }
  return (
    <Screen>
      <a className="link" href="#/sport">‹ Спорт</a>
      <h1 className="display a-h" style={{ fontSize: 26 }}>{mine ? 'Мои упражнения' : 'Упражнения'}</h1>
      {grid}
    </Screen>
  );
}

const FORM_MUSCLES: [string, string][] = [['Грудь', 'chest'], ['Спина', 'lats'], ['Плечи', 'shoulders'], ['Бицепс', 'biceps'], ['Трицепс', 'triceps'], ['Пресс', 'abs'], ['Квадрицепс', 'quads'], ['Бицепс бедра', 'hamstrings'], ['Ягодицы', 'glutes'], ['Икры', 'calves']];
const MAX_MUSCLES = 3;
const groupOf = (m: string[]) => {
  const f = FORM_MUSCLES.map(([, k]) => k).find((k) => m.includes(k));
  return ({ chest: 'chest', lats: 'back', shoulders: 'shoulders', biceps: 'arms', triceps: 'arms', abs: 'abs' } as Record<string, string>)[f ?? ''] ?? 'legs';
};

export function ExerciseFormScreen({ id }: { id?: number }) {
  const { exById, exercises } = useApp();
  const ex = id ? exById.get(id) : undefined;
  const editable = !id || (ex && ex.own);
  const [name, setName] = useState(ex?.name ?? '');
  const [type, setType] = useState<'weight_reps' | 'time'>(ex?.type ?? 'weight_reps');
  const [muscles, setMuscles] = useState<string[]>(ex?.primary ?? []);
  const [kind, setKind] = useState<string | null>(ex?.kind ?? null);
  const [desc, setDesc] = useState(ex?.description ?? '');
  const [rest, setRest] = useState(ex?.rest ?? 150);
  const [busy, setBusy] = useState(false);
  const [dup, setDup] = useState(false);
  const [del, setDel] = useState(false);
  const back = ex ? `#/exercises/mine/${ex.id}` : '#/exercises/mine';
  // Pictures that show every chosen muscle; when none does, the closest ones. The chosen picture always stays.
  const pictures = (() => {
    const chosen = muscles.filter((m) => FORM_MUSCLES.some(([, k]) => k === m));
    if (!chosen.length) return KINDS;
    const hit = (k: string) => chosen.filter((m) => KIND_MUSCLES[k]?.includes(m)).length;
    const best = Math.max(...KINDS.map(hit));
    return best ? KINDS.filter((k) => k === kind || hit(k) === best) : KINDS;
  })();

  if (!editable) return <Screen className="modal"><a className="link" href="#/exercises">‹ Упражнения</a><div className="empty">Это базовое упражнение, его нельзя менять</div></Screen>;

  const taken = exercises.some((e) => e.id !== id && e.name.trim().toLowerCase() === name.trim().toLowerCase());
  const valid = name.trim().length >= 2 && muscles.length > 0 && !taken;
  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const body = { name: name.trim(), type, kind, group: groupOf(muscles), primary: muscles, description: desc.trim() || null, rest };
    try {
      const res = id ? await api<{ exercise: Exercise }>('PUT', `/exercises/${id}`, body) : await api<{ exercise: Exercise }>('POST', '/exercises', body);
      invalidate('/exercises');
      go('exercises', 'mine', res.exercise.id);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'exercise_exists') setDup(true); else toast(errText(e));
      setBusy(false);
    }
  };

  return (
    <Screen className="modal">
      <div className="col" style={{ gap: 26, padding: '0 4px' }}>
        <div className="navbar">
          <a className="link" href={back}>Отмена</a>
          <b>{id ? 'Изменить упражнение' : 'Новое упражнение'}</b>
          <button className="link" disabled={!valid || busy} onClick={save} style={{ color: valid ? 'var(--acc)' : 'var(--muted)' }}>Готово</button>
        </div>
        <div className="field">
          <label htmlFor="ef-name">Название</label>
          <input id="ef-name" className="input" style={{ height: 50, borderRadius: 12 }} value={name} maxLength={80} onChange={(e) => { setName(e.target.value); setDup(false); }} aria-invalid={taken || dup} />
          {taken || dup ? <span className="err">Такое упражнение уже есть</span> : null}
        </div>
        <div className="field">
          <span className="flabel">Что записываем в подходе</span>
          <div className="seg">
            <button aria-pressed={type === 'weight_reps'} onClick={() => setType('weight_reps')}>Вес × повторы</button>
            <button aria-pressed={type === 'time'} onClick={() => setType('time')}>Время</button>
          </div>
        </div>
        <div className="field">
          <span className="flabel"><span>Мышцы</span><span className="muted">до 3</span></span>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {FORM_MUSCLES.map(([l, k]) => {
              const on = muscles.includes(k);
              const off = !on && muscles.length >= MAX_MUSCLES;
              return <button key={k} aria-pressed={on} disabled={off} onClick={() => setMuscles((m) => (on ? m.filter((x) => x !== k) : m.length < MAX_MUSCLES ? [...m, k] : m))}
                style={{ opacity: off ? 0.4 : 1, height: 40, padding: '0 14px', borderRadius: 20, fontWeight: 800, background: on ? 'var(--acc)' : 'transparent', color: on ? 'var(--onAcc)' : 'var(--ink)', border: `1px solid ${on ? 'var(--acc)' : 'var(--track)'}` }}>{l}</button>;
            })}
          </div>
        </div>
        <div className="field">
          <span className="flabel">Картинка</span>
          <div className="chips" style={{ gap: 10 }}>
            {pictures.map((k) => (
              <button key={k} aria-label={k} aria-pressed={kind === k} onClick={() => setKind(kind === k ? null : k)} style={{ borderRadius: 14, padding: 2, border: `3px solid ${kind === k ? 'var(--acc)' : 'transparent'}`, flex: 'none' }}>
                <ExerciseArt kind={k} size={56} />
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="ef-desc">Как выполнять <span className="muted" style={{ fontWeight: 500 }}>· необязательно</span></label>
          <textarea id="ef-desc" rows={3} className="input" style={{ height: 'auto', padding: 12, resize: 'vertical' }} placeholder="Например: спина ровная, опускайтесь медленно" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={2000} />
        </div>
        <div className="card between" style={{ borderRadius: 14, padding: '8px 12px' }}>
          <b>Отдых по умолчанию</b>
          <div className="row" style={{ gap: 6 }}>
            <button className="icon-btn" style={{ background: 'var(--bg)' }} aria-label="Меньше" onClick={() => setRest((r) => Math.max(0, r - 15))}>−</button>
            <b className="num" style={{ minWidth: 44, textAlign: 'center' }}>{mmss(rest)}</b>
            <button className="icon-btn" style={{ background: 'var(--bg)' }} aria-label="Больше" onClick={() => setRest((r) => Math.min(600, r + 15))}>+</button>
          </div>
        </div>
        {ex ? <button className="warn-link" onClick={() => setDel(true)}>Удалить упражнение</button> : null}
        {ex ? <DeleteExercise e={ex} open={del} onClose={() => setDel(false)} /> : null}
      </div>
    </Screen>
  );
}
