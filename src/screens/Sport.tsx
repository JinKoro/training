import { useEffect, useState } from 'react';
import { useApp } from '../app-context';
import { api } from '../lib/api';
import { mmss, programEnd, programProgress, timesPerWeek, weeksText } from '../lib/calc';
import { addDays, fromDay, plural, today, WD_CAP } from '../lib/dates';
import { invalidate } from '../lib/query';
import { go } from '../lib/router';
import type { Program } from '../lib/types';
import { ExerciseArt } from '../art';
import { Screen, Sheet, errText, toast } from '../ui';

const MONTH_PREP = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];

export function programSubtitle(p: Program) {
  const pr = programProgress(p);
  if (pr.finished) return `закончена в ${MONTH_PREP[fromDay(addDays(programEnd(p), -1)).getMonth()]}`;
  return `${weeksText(p.weeks)} · ${timesPerWeek(p.weekdays.length)}`;
}

export function SportScreen() {
  const { programs, exercises, wide } = useApp();
  const current = programs.find((p) => p.active && !programProgress(p).finished);
  const base = exercises.filter((e) => !e.own).length;
  const own = exercises.filter((e) => e.own).length;
  const progHref = (p: Program) => (wide ? `#/program/${p.id}/edit` : `#/program/${p.id}`);

  const currentCard = current ? (() => {
    const pr = programProgress(current);
    return wide ? (
      <a href={progHref(current)} className="col a-in" style={{ background: '#2438C9', color: '#fff', borderRadius: 22, padding: 20, gap: 10 }}>
        <div className="between"><span style={{ background: 'rgba(255,255,255,.18)', borderRadius: 8, padding: '3px 8px', fontSize: 12, fontWeight: 800 }}>ИДЁТ СЕЙЧАС</span><b className="display" style={{ fontSize: 20 }}>{pr.pct}%</b></div>
        <div className="display" style={{ fontSize: 24 }}>{current.name}</div>
        <div className="bar" style={{ background: 'rgba(255,255,255,.25)' }}><i className="a-fill" style={{ width: `${pr.pct}%`, background: '#fff' }} /></div>
        <div className="between"><span>{timesPerWeek(current.weekdays.length)}</span><b>Изменить ›</b></div>
      </a>
    ) : (
      <a href={progHref(current)} className="card col a-in" style={{ borderRadius: 22, padding: 16, gap: 10 }}>
        <div className="between"><span style={{ background: '#2438C9', color: '#fff', borderRadius: 8, padding: '3px 8px', fontSize: 12, fontWeight: 800 }}>ИДЁТ СЕЙЧАС</span><b className="display" style={{ fontSize: 18 }}>{pr.pct}%</b></div>
        <div className="display" style={{ fontSize: 22 }}>{current.name}</div>
        <div className="bar"><i className="a-fill" style={{ width: `${pr.pct}%`, background: 'var(--acc)' }} /></div>
        <span className="muted" style={{ fontSize: 14 }}>{timesPerWeek(current.weekdays.length)}</span>
      </a>
    );
  })() : (
    <div className="card col a-in" style={{ alignItems: 'flex-start' }}>
      <b>Нет активной программы</b>
      <a className="btn small" href="#/program/new">+ Программа</a>
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
          <div className="grow"><b>Мои упражнения</b><div className="sub">{own ? `${own} ${plural(own, ['своё', 'своих', 'своих'])}, видишь только ты` : 'Пока нет, видишь только ты'}</div></div><span className="muted">›</span>
        </a>
      </div>
    </>
  );

  const programsBlock = programs.length ? (
    <>
      <span className="label">Мои программы</span>
      <div className="list a-in">
        {programs.map((p) => (
          <a key={p.id} href={progHref(p)}>
            <div className="grow"><b>{p.name}</b><div className="sub">{programSubtitle(p)}</div></div><span className="muted">›</span>
          </a>
        ))}
      </div>
    </>
  ) : null;

  const addBtn = <a className="btn small" href="#/program/new">+ Программа</a>;
  return (
    <Screen title="Спорт" actions={addBtn}>
      {!wide ? <div className="between"><h1 className="h1 a-h">Спорт</h1>{addBtn}</div> : null}
      {wide ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, alignItems: 'start' }}>
          <div className="col" style={{ gap: 14 }}>{currentCard}{programsBlock}</div>
          <div className="col" style={{ gap: 14 }}>{exercisesBlock}</div>
        </div>
      ) : <>{currentCard}{exercisesBlock}{programsBlock}</>}
    </Screen>
  );
}

export function ProgramScreen({ id }: { id: number }) {
  const { programs, exById, wide } = useApp();
  const p = programs.find((x) => x.id === id);
  const pr = p ? programProgress(p) : null;
  const [sel, setSel] = useState<number>(() => (pr ? (pr.finished ? p!.weeks : pr.started ? pr.currentWeek : 1) : 1));
  const [del, setDel] = useState(false);
  useEffect(() => { if (wide && p) go('program', p.id, 'edit'); }, [wide, p]);
  if (!p || !pr) return <Screen className="modal"><a className="link" href="#/sport">‹ Спорт</a><div className="empty">Программа не найдена</div></Screen>;
  const cur = pr.finished ? p.weeks + 1 : pr.started ? pr.currentWeek : 0;
  const week = p.plan[String(sel)] ?? {};
  return (
    <Screen className="modal">
      <div className="between"><a className="link" href="#/sport">‹ Спорт</a><a className="link" href={`#/program/${p.id}/edit`}>Изменить</a></div>
      <h1 className="display a-h" style={{ fontSize: 26 }}>{p.name}</h1>
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
          <div key={wd} className="card col a-in" style={{ borderRadius: 18, gap: 6 }}>
            <div className="between"><b>{WD_CAP[wd]}</b><span className="muted">{rows.length} упр.</span></div>
            {rows.length ? rows.map((r, i) => {
              const e = exById.get(r.exerciseId);
              return (
                <div key={i} className="between" style={{ fontSize: 14 }}>
                  <span className="ell">{e?.name ?? 'Упражнение'}</span>
                  <span className="muted" style={{ whiteSpace: 'nowrap' }}>{r.note ? r.note : `${r.sets}×${r.reps.replace('-', '–')} · ${mmss(r.rest ?? e?.rest ?? 150)}`}</span>
                </div>
              );
            }) : <span className="muted" style={{ fontSize: 14 }}>Пусто</span>}
          </div>
        );
      })}
      <button className="warn-link" onClick={() => setDel(true)}>Удалить программу</button>
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
