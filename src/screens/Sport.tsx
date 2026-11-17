import { useEffect, useState } from 'react';
import { useApp } from '../app-context';
import { api } from '../lib/api';
import { DEFAULT_REST, mmss, schemeText, planMinutes, programDonePct, programEnd, programProgress, timesPerWeek, weeksText } from '../lib/calc';
import { plural, today, WD_CAP } from '../lib/dates';
import { invalidate, useQuery } from '../lib/query';
import { go } from '../lib/router';
import type { Program, Workout } from '../lib/types';
import { ExerciseArt } from '../art';
import { MoreButton, Screen, Sheet, errText, menuRow, toast } from '../ui';
import { TodayWorkout } from './Week';
import { LevelTag, TemplatesBlock } from './Templates';
import type { Level } from '../lib/templates';
import { barHeights, deloads, loadNote, weekLoads } from '../lib/load';

export function programSubtitle(p: Program) {
  return `${weeksText(p.weeks)} · ${timesPerWeek(p.weekdays.length)}`;
}

export function SportScreen() {
  const { programs, exercises, wide } = useApp();
  const current = programs.find((p) => p.active && !programProgress(p).finished);
  // Progress = program days actually trained (a deleted workout no longer counts).
  const wq = useQuery<{ workouts: Workout[] }>(current ? `/workouts?from=${current.startDate}&to=${programEnd(current)}` : '/workouts?from=2000-01-01&to=2000-01-01');
  const donePct = current ? programDonePct(current, wq.data?.workouts ?? []) : 0;
  const base = exercises.filter((e) => !e.own).length;
  const own = exercises.filter((e) => e.own).length;
  const progHref = (p: Program) => (wide ? `#/program/${p.id}/edit` : `#/program/${p.id}`);

  const currentCard = current ? (() => {
    const pr = { pct: donePct };
    return wide ? (
      <a href={progHref(current)} className="col a-in" style={{ background: 'var(--hero)', color: '#fff', borderRadius: 22, padding: 20, gap: 10 }}>
        <div className="between"><span style={{ background: 'rgba(255,255,255,.18)', borderRadius: 8, padding: '3px 8px', fontSize: 12, fontWeight: 800 }}>ИДЁТ СЕЙЧАС</span><b className="display" style={{ fontSize: 20 }}>{pr.pct}%</b></div>
        <div className="display" style={{ fontSize: 24 }}>{current.name}</div>
        {current.level != null ? <span style={{ alignSelf: 'flex-start' }}><LevelTag level={current.level as Level} /></span> : null}
        <div className="bar" style={{ background: 'rgba(255,255,255,.25)' }}><i className="a-fill" style={{ width: `${pr.pct}%`, background: '#fff' }} /></div>
        <div className="between"><span>{timesPerWeek(current.weekdays.length)}</span><b>Изменить ›</b></div>
      </a>
    ) : (
      <a href={progHref(current)} className="card col a-in" style={{ borderRadius: 22, padding: 16, gap: 10 }}>
        <div className="between"><span style={{ background: 'var(--hero)', color: '#fff', borderRadius: 8, padding: '3px 8px', fontSize: 12, fontWeight: 800 }}>ИДЁТ СЕЙЧАС</span><b className="display" style={{ fontSize: 18 }}>{pr.pct}%</b></div>
        <div className="display" style={{ fontSize: 22 }}>{current.name}</div>
        {current.level != null ? <span style={{ alignSelf: 'flex-start' }}><LevelTag level={current.level as Level} /></span> : null}
        <div className="bar"><i className="a-fill" style={{ width: `${pr.pct}%`, background: 'var(--acc)' }} /></div>
        <span className="muted" style={{ fontSize: 14 }}>{timesPerWeek(current.weekdays.length)}</span>
      </a>
    );
  })() : (
    <div className="card col a-in" style={{ alignItems: 'flex-start' }}>
      <b>Нет активной программы</b>
      {!programs.length ? <a className="btn small" href="#/program/new">+ Программа</a> : null}
    </div>
  );

  const exercisesBlock = (
    <>
      <span className="label">Упражнения</span>
      <div className="list a-in">
        <a href="#/exercises">
          <ExerciseArt kind="bench" size={wide ? 48 : 44} />
          <div className="grow"><b>Библиотека</b><div className="sub">{base} {plural(base, ['упражнение', 'упражнения', 'упражнений'])} с техникой</div></div><span className="muted">›</span>
        </a>
        <a href="#/exercises/mine">
          <ExerciseArt kind="carry" size={wide ? 48 : 44} />
          <div className="grow"><b>Мои упражнения</b><div className="sub">{own ? `${own} ${plural(own, ['своё', 'своих', 'своих'])}, видите только вы` : 'Пока нет, видите только вы'}</div></div><span className="muted">›</span>
        </a>
      </div>
    </>
  );

  const programsBlock = programs.length ? (
    <>
      <span className="label">Мои программы</span>
      <div className="list a-in">
        <a href="#/program/new" style={{ color: 'var(--acc)', fontWeight: 800 }}>+ Программа</a>
        {programs.map((p) => (
          <a key={p.id} href={progHref(p)}>
            <div className="grow">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><b>{p.name}</b>{p.level != null ? <LevelTag level={p.level as Level} /> : null}</span>
              <div className="sub">{programSubtitle(p)}</div>
            </div><span className="muted">›</span>
          </a>
        ))}
      </div>
    </>
  ) : null;
  const readyBlock = <TemplatesBlock />;

  return (
    <Screen title="Спорт">
      {!wide ? <h1 className="h1 a-h">Спорт</h1> : null}
      {wide ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, alignItems: 'start' }}>
          <div className="col" style={{ gap: 14 }}><TodayWorkout />{currentCard}{programsBlock}{readyBlock}</div>
          <div className="col" style={{ gap: 14 }}>{exercisesBlock}</div>
        </div>
      ) : <><TodayWorkout />{currentCard}{exercisesBlock}{programsBlock}{readyBlock}</>}
    </Screen>
  );
}

/** `week` opens that week of the program (from a day card: the week the day belongs to). */
/**
 * «Нагрузка по неделям» of a program, like a ready-made one's: a bar a week (grey = deload, a dashed stub = no
 * workouts). With `cur` the weeks after the current one are paler; with `onPick` a bar opens its week.
 */
export function LoadChart({ loads, cur, sel, onPick, height = 64 }: { loads: number[]; cur?: number; sel?: number; onPick?: (week: number) => void; height?: number }) {
  const note = loadNote(loads), hs = barHeights(loads), dl = deloads(loads);
  return (
    <div className="card col a-in" style={{ borderRadius: 22, gap: 12 }}>
      <b>Нагрузка по неделям</b>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: loads.length > 20 ? 2 : 4, height }}>
        {loads.map((v, i) => {
          const n = i + 1, rest = v === 0;
          const style: React.CSSProperties = {
            flex: 1, minWidth: 0, padding: 0, borderRadius: 4, boxSizing: 'border-box',
            height: rest ? 4 : Math.max(6, Math.round(hs[i] * height)),
            background: rest ? 'transparent' : dl[i] ? 'var(--track)' : 'var(--chart)',
            border: rest ? '2px dashed var(--track)' : n === sel ? '2px solid var(--ink)' : 0,
            opacity: cur && n > cur ? 0.45 : 1,
          };
          return onPick
            ? <button key={n} className="a-bar" aria-label={`Нагрузка: неделя ${n}${rest ? ', без тренировок' : ''}`} aria-pressed={n === sel} onClick={() => onPick(n)} style={style} />
            : <span key={n} className="a-bar" aria-hidden="true" style={style} />;
        })}
      </div>
      {note ? <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>{note}</span> : null}
    </div>
  );
}

export function ProgramScreen({ id, week: atWeek }: { id: number; week?: number }) {
  const { programs, exById, wide } = useApp();
  const p = programs.find((x) => x.id === id);
  const pr = p ? programProgress(p) : null;
  const [sel, setSel] = useState<number>(() => (pr ? (atWeek && atWeek >= 1 && atWeek <= p!.weeks ? atWeek : pr.finished ? p!.weeks : pr.started ? pr.currentWeek : 1) : 1));
  const [del, setDel] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => { if (wide && p) go('program', p.id, 'edit', ...(atWeek ? [atWeek] : [])); }, [wide, p, atWeek]);
  if (!p || !pr) return <Screen className="modal"><a className="link" href="#/sport">‹ Спорт</a><div className="empty">Программа не найдена</div></Screen>;
  const cur = pr.finished ? p.weeks + 1 : pr.started ? pr.currentWeek : 0;
  const week = p.plan[String(sel)] ?? {};
  return (
    <Screen className="modal">
      <div className="between"><a className="link" href="#/sport">‹ Спорт</a><MoreButton onClick={() => setMenu(true)} /></div>
      <h1 className="display a-h" style={{ fontSize: 26 }}>{p.name}</h1>
      {p.level != null ? <span style={{ alignSelf: 'flex-start' }}><LevelTag level={p.level as Level} big /></span> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        {[[String(p.weeks), plural(p.weeks, ['неделя', 'недели', 'недель'])], [String(p.weekdays.length), timesPerWeek(p.weekdays.length).replace(/^\S+\s/, '')]].map(([v, l]) => (
          <div key={l} className="card col a-in" style={{ borderRadius: 20, padding: 12, gap: 2 }}><b className="display" style={{ fontSize: 18 }}>{v}</b><span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>{l}</span></div>
        ))}
      </div>
      <LoadChart loads={weekLoads(p.plan, p.weeks, (id) => exById.get(id)?.type === 'time')} cur={cur || undefined} sel={sel} onPick={setSel} />
      <div style={p.weeks > 13 ? { display: 'flex', gap: 4, overflowX: 'auto' } : { display: 'grid', gridTemplateColumns: `repeat(${p.weeks}, minmax(0, 1fr))`, gap: 3 }}>
        {Array.from({ length: p.weeks }, (_, i) => i + 1).map((n) => {
          const isSel = n === sel;
          const st = n < cur ? 'past' : n === cur ? 'cur' : 'future';
          return (
            <button key={n} aria-label={`Неделя ${n}`} aria-pressed={isSel} onClick={() => setSel(n)} style={{
              height: 44, minWidth: p.weeks > 13 ? 40 : 0, borderRadius: 7, fontSize: 12, fontWeight: 800, boxSizing: 'border-box',
              background: isSel ? 'var(--acc)' : st === 'past' ? 'var(--chart)' : st === 'cur' ? 'var(--btn)' : 'transparent',
              color: isSel ? 'var(--onAcc)' : st === 'future' || st === 'cur' ? 'var(--ink)' : '#fff',
              border: isSel ? 0 : st === 'cur' ? '2px solid var(--ink)' : st === 'future' ? '2px dashed var(--track)' : 0,
            }}>{n}</button>
          );
        })}
      </div>
      <div className="between"><b style={{ fontSize: 18 }}>Неделя {sel}</b><span className="muted">{sel < cur ? 'прошла' : sel === cur ? 'сейчас' : 'впереди'}</span></div>
      {p.weekdays.map((wd) => {
        const rows = week[String(wd)] ?? [];
        return (
          <div key={wd} className="card col a-in" style={{ borderRadius: 22, gap: 6 }}>
            <div className="between"><b>{WD_CAP[wd]}</b><span className="muted">{rows.length ? `${rows.length} упр. · ~ ${planMinutes(rows, exById)} мин` : '0 упр.'}</span></div>
            {rows.length ? rows.map((r, i) => {
              const e = exById.get(r.exerciseId);
              return (
                <div key={i} className="col" style={{ fontSize: 14, gap: 2 }}>
                  <div className="between" style={{ gap: 8 }}>
                    <span className="ell" style={{ minWidth: 0 }}>{e?.name ?? 'Упражнение'}</span>
                    <span className="muted" style={{ whiteSpace: 'nowrap', flex: 'none' }}>{e?.type === 'time' && !(r.rest ?? e.rest) ? schemeText(r, e.type) : `${schemeText(r, e?.type)} · ${mmss(r.rest ?? e?.rest ?? DEFAULT_REST)}`}</span>
                  </div>
                  {r.note ? <span className="muted" style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{r.note}</span> : null}
                </div>
              );
            }) : <span className="muted" style={{ fontSize: 14 }}>Пусто</span>}
          </div>
        );
      })}
      <Sheet open={menu} onClose={() => setMenu(false)} label="Программа">
        <b style={{ fontSize: 18 }}>Программа</b>
        <div className="col" style={{ gap: 0 }}>
          <a href={`#/program/${p.id}/edit`} style={menuRow}>Изменить</a>
          <button onClick={() => { setMenu(false); setDel(true); }} style={{ ...menuRow, color: 'var(--warn)', borderBottom: 0 }}>Удалить программу</button>
        </div>
      </Sheet>
      <DeleteProgram p={p} open={del} onClose={() => setDel(false)} />
    </Screen>
  );
}

export function DeleteProgram({ p, open, onClose }: { p: Program; open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} label="Удаление программы">
      <b className="display" style={{ fontSize: 20 }}>Удалить программу «{p.name}»?</b>
      <span className="muted">Сделанные тренировки и журнал сохранятся.</span>
      <button className="btn" style={{ background: 'var(--warn)', color: '#fff' }} disabled={busy} onClick={async () => {
        setBusy(true);
        try { await api('DELETE', `/programs/${p.id}`); invalidate('/programs'); go('sport'); } catch (e) { toast(errText(e)); setBusy(false); }
      }}>Удалить</button>
      <button className="btn outline" onClick={onClose}>Отмена</button>
    </Sheet>
  );
}

export { today };
