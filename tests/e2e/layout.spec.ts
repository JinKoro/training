import { test, expect, open, login, registerUser, createProgram, addEntry, call, today, weekdayIdx, layoutProblems, type User } from './fixtures';

/** 390 px wide phone: no screen may scroll sideways or push content out of the viewport; no clipped labels. */
let u: User;
const ids: Record<string, number> = {};

test.beforeAll(async () => {
  u = await registerUser({ name: 'Константин Длинноимённый' });
  const wd = weekdayIdx(today());
  const p = await createProgram(u.token, {
    name: 'Очень длинное название программы для проверки переноса строк', weeks: 13,
    days: {
      [wd]: [
        { name: 'Обратное разведение рук (задние дельты)', sets: 4, reps: '10–12', kg: '12,5/15/17,5/20', rest: 90 },
        { name: 'Жим штанги лёжа', sets: 3, reps: '8', kg: '100' },
      ],
      [(wd + 2) % 7]: [{ name: 'Приседания со штангой', sets: 5, reps: '5', kg: '120' }],
    },
  });
  ids.program = p.id;
  const { workout } = await call(u.token, 'POST', '/workouts', {
    date: today(), title: 'Плечи и грудь', programId: p.id, week: 1, weekday: wd,
    exercises: [{ exerciseId: null, name: 'Обратное разведение рук (задние дельты)', type: 'weight_reps', rest: 90, sets: [1, 2, 3, 4].map(() => ({ plannedWeight: 117.5, plannedReps: 12 }))}],
  });
  ids.workout = workout.id;
  const { workout: done } = await call(u.token, 'POST', '/workouts', {
    date: today(), title: 'Готовая', status: 'finished',
    exercises: [{ exerciseId: null, name: 'Обратное разведение рук (задние дельты)', type: 'weight_reps', rest: 90, sets: [1, 2, 3, 4, 5, 6].map(() => ({ plannedWeight: 117.5, plannedReps: 12, weight: 117.5, reps: 9 }))}],
  });
  ids.done = done.id;
  await addEntry(u.token, today(), 'breakfast', 'Овсянка с ягодами', 350);
  await addEntry(u.token, today(), 'lunch', 'Гречка варёная', 1500);
  const { product } = await call(u.token, 'POST', '/products', { name: 'Очень длинное название продукта без пробелов-и-с-дефисами', brand: 'Бренд-длинный', protein: 10, fat: 10, carbs: 10 });
  ids.product = product.id;
});

const routes = () => [
  'week', 'week-macros/0', 'week/1', 'calendar', 'sport', `program/${ids.program}`, `program/${ids.program}/edit`, 'program/new',
  'template/m2', 'template/m2/start', `day/${today()}`, `workout/${ids.workout}`, `summary/${ids.done}`, `workout-edit/${ids.done}`, 'log',
  `food/${today()}`, `food/${today()}/add/breakfast`, `food/${today()}/item/product/${ids.product}/lunch`, `food/${today()}/new-product/lunch/-`,
  `food/${today()}/dish/lunch/from-meal`, `food-calendar/${today()}`, 'profile', 'profile/edit', 'profile/norms', 'profile/recalc', 'profile/password',
  'exercises', 'exercises/mine', 'exercise/new',
];

test('every main screen fits 390 px', async ({ page }) => {
  test.setTimeout(180_000);
  await login(page, u.token);
  const problems: string[] = [];
  for (const r of routes()) {
    await open(page, r);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(900); // entry animations
    for (const p of await layoutProblems(page)) problems.push(`#/${r}: ${p}`);
  }
  expect(problems).toEqual([]);
});

test('login and registration fit 390 px', async ({ page }) => {
  for (const r of ['login', 'register']) {
    await open(page, r);
    await page.waitForTimeout(600);
    expect(await layoutProblems(page), r).toEqual([]);
  }
});
