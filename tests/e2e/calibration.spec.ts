import { test, expect, open, today, weekdayIdx, WD_SHORT, createProgram, call, API } from './fixtures';

test('calibration: no planned weight -> «Калибровка…», weight carries over, later weeks get weights', async ({ authed: page, user }) => {
  const wd = weekdayIdx(today());
  const bench = (reps: string, pct?: number) => ({ name: 'Жим штанги лёжа', sets: 2, reps, kg: '', rest: 30, pct });
  const curl = { name: 'Сгибания рук с гантелями', sets: 1, reps: '12', kg: '10', rest: 30 };
  const p = await createProgram(user.token, {
    name: 'Калибровка', weeks: 3, days: { [wd]: [bench('10'), curl] },
    perWeek: { 1: { [wd]: [bench('10'), curl] }, 2: { [wd]: [bench('8'), curl] }, 3: { [wd]: [bench('10', 70), curl] } },
  });

  await open(page, `day/${today()}`);
  await expect(page.locator('.card', { hasText: 'Жим штанги лёжа' })).toContainText('—'); // no weight planned
  await page.locator('.fixed-bottom').getByRole('button', { name: 'Начать' }).click();
  await expect(page.getByText('Калибровка: подберите вес, с которым сделаете 10 повторов. Дальше программа поставит его сама.')).toBeVisible();
  await expect(page.locator('#fw')).toHaveValue('');
  await page.locator('#fw').fill('40');
  await page.getByRole('button', { name: 'Сделал' }).click();
  await page.getByRole('button', { name: 'Пропустить отдых' }).click();
  await expect(page.getByText('Упражнение 1 из 2 · подход 2 из 2')).toBeVisible();
  await expect(page.locator('#fw')).toHaveValue('40');
  await expect(page.getByText(/^Калибровка/)).toBeHidden();
  await page.getByRole('button', { name: 'Больше повторений' }).click(); // 40 × 11 — still the best set is used
  await page.getByRole('button', { name: 'Сделал' }).click();
  await page.getByRole('button', { name: 'Пропустить отдых' }).click();
  // an exercise with a planned weight is not calibrated
  await expect(page.locator('#fw')).toHaveValue('10');
  await expect(page.getByText(/^Калибровка/)).toBeHidden();
  // finishing refetches /programs once the queue is through (see the race test below)
  const refetch = page.waitForResponse((r) => r.url() === `${API}/api/programs` && r.request().method() === 'GET');
  await page.getByRole('button', { name: 'Сделал' }).click();
  await expect(page.getByRole('heading', { name: 'Тренировка завершена' })).toBeVisible();
  await refetch;
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page).toHaveURL(/#\/week/);

  // Epley from the best set 40 × 11: e1 = 40·(1 + 11/30)
  const e1 = 40 * (1 + 11 / 30);
  const r25 = (x: number) => String(Math.round(x / 2.5) * 2.5).replace('.', ',');
  await open(page, `program/${p.id}/edit`);
  const row = page.locator('div.a-in.col', { has: page.getByText('Жим штанги лёжа', { exact: true }) });
  for (const [w, want] of [[1, ''], [2, r25(e1 / (1 + 8 / 30))], [3, r25((e1 / (1 + 10 / 30)) * 0.7)]] as const) {
    await page.getByRole('button', { name: `Неделя ${w}`, exact: true }).click();
    await page.locator('.chips .chip', { hasText: WD_SHORT[wd] }).click();
    await expect(row.getByLabel('Вес'), `week ${w}`).toHaveValue(want);
  }
  const curlRow = page.locator('div.a-in.col', { has: page.getByText('Сгибания рук с гантелями', { exact: true }) });
  await expect(curlRow.getByLabel('Вес')).toHaveValue('10');

  // the next workout of the program has the weight planned (no calibration again)
  const { program } = await call(user.token, 'GET', `/programs/${p.id}`);
  expect(program.plan['2'][String(wd)][0].kg).toBe(r25(e1 / (1 + 8 / 30)));
});

// fixed (was a bug): the program editor copies the program into local state once (useState initializer, keyed by id) and never
// follows later data. Opened while the post-workout /programs refetch is still on its way (slow network), it shows
// the plan from before calibration and keeps showing it; «Сохранить» then writes the empty weights back over the
// calibrated ones. src/screens/ProgramEditor.tsx (Editor state) + WorkoutFlow.tsx (finish does not await the refetch).
test('editor opened right after a calibration workout shows the calibrated weights', async ({ authed: page, user }) => {
  const wd = weekdayIdx(today());
  const p = await createProgram(user.token, { name: 'Гонка', weeks: 2, days: { [wd]: [{ name: 'Жим штанги лёжа', sets: 1, reps: '10', kg: '', rest: 30 }] } });
  await open(page, `day/${today()}`);
  await page.locator('.fixed-bottom').getByRole('button', { name: 'Начать' }).click();
  await page.locator('#fw').fill('40');
  // a slow phone network: program list answers take 2 s
  await page.route(`${API}/api/programs`, async (r) => { await new Promise((f) => setTimeout(f, 2000)); await r.continue(); });
  await page.getByRole('button', { name: 'Сделал' }).click();
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page).toHaveURL(/#\/week/);
  await open(page, `program/${p.id}/edit`);
  await page.getByRole('button', { name: 'Неделя 2', exact: true }).click();
  await page.locator('.chips .chip', { hasText: WD_SHORT[wd] }).click();
  await expect(page.getByLabel('Вес')).toHaveValue('40', { timeout: 8000 });
});
