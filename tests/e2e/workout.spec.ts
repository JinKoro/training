import { test, expect, open, sheet, toast, tab, today, weekdayIdx, createProgram, call, type Page, type User } from './fixtures';

async function setup(user: User, weeks = 2) {
  const wd = weekdayIdx(today());
  return createProgram(user.token, {
    name: 'Тестовая', weeks, days: {
      [wd]: [
        { name: 'Жим штанги лёжа', sets: 2, reps: '10', kg: '50', rest: 60 },
        { name: 'Махи в стороны', sets: 2, reps: '12', kg: '8', rest: 0 },
        { name: 'Подъём ног лёжа', sets: 1, reps: '15', kg: '', rest: 30 },
      ],
      [(wd + 3) % 7]: [{ name: 'Приседания со штангой', sets: 3, reps: '8', kg: '80' }],
    },
  });
}

async function startFromWeek(page: Page) {
  await open(page, 'week');
  await expect(page.getByText(`Сегодня, `)).toBeVisible();
  await expect(page.getByText('День тренировки', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Начать тренировку' }).click();
  await expect(page).toHaveURL(new RegExp(`#/day/${today()}`));
  await expect(page.getByText('3 упражнения', { exact: true })).toBeVisible();
  await expect(page.getByText('5 подходов', { exact: true })).toBeVisible();
  await page.locator('.fixed-bottom').getByRole('button', { name: 'Начать' }).click();
  await expect(page).toHaveURL(/#\/workout\/\d+/);
  await expect(page.getByText('Упражнение 1 из 3 · подход 1 из 2')).toBeVisible();
}
const weight = (page: Page) => page.locator('#fw');
const reps = (page: Page) => page.locator('#fr');

// After a delete, invalidate('/workouts') also refetches the deleted workout's own cache entry -> GET 404 (BUG below).
const after404 = /http 404 GET \/api\/workouts\/\d+$|status of 404 .*\/api\/workouts\/\d+$/;

test.describe('Workout flow', () => {
  test.beforeEach(({ allowErrors }) => allowErrors(after404));
  test('sets, steppers, rest, skip, finish via menu, summary, journal, edit, delete', async ({ authed: page, user }) => {
    const p = await setup(user);
    await startFromWeek(page);

    // steppers
    await expect(weight(page)).toHaveValue('50');
    await expect(reps(page)).toHaveValue('10');
    await page.getByRole('button', { name: 'Увеличить вес' }).click();
    await expect(weight(page)).toHaveValue('52,5');
    await page.getByRole('button', { name: 'шаг 5' }).click();
    await page.getByRole('button', { name: 'Увеличить вес' }).click();
    await expect(weight(page)).toHaveValue('57,5');
    await page.getByRole('button', { name: 'Уменьшить вес' }).click();
    await expect(weight(page)).toHaveValue('52,5');
    await page.getByRole('button', { name: 'Больше повторений' }).click();
    await expect(reps(page)).toHaveValue('11');
    await expect(page.getByText('52,5 × 11 · сейчас')).toBeVisible();
    await page.getByRole('button', { name: 'Сделал' }).click();

    // rest screen
    await expect(page.getByText('Отдых', { exact: true })).toBeVisible();
    await expect(page.getByRole('timer')).toHaveAttribute('aria-label', /Осталось 0:5\d|Осталось 1:00/);
    await expect(page.getByText('из 1:00')).toBeVisible();
    await page.getByRole('button', { name: '+15 с' }).click();
    await expect(page.getByText('из 1:1')).toBeVisible();
    await expect(page.getByText('Дальше · подход 2 из 2')).toBeVisible();
    await expect(page.getByText('50 кг × 10')).toBeVisible();

    // a reload in the gym resumes in place
    await page.reload();
    await expect(page.getByText('Отдых', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Пропустить отдых' }).click();
    await expect(page.getByText('Упражнение 1 из 3 · подход 2 из 2')).toBeVisible();
    await expect(page.getByText('52,5 × 11 ✓')).toBeVisible();
    await expect(weight(page)).toHaveValue('50');

    // back returns to the rest screen
    await page.getByRole('button', { name: '‹ Назад' }).click();
    await expect(page.getByText('Отдых', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Пропустить отдых' }).click();
    await page.getByRole('button', { name: 'Сделал' }).click();
    // rest after the exercise, then exercise 2
    await expect(page.getByText('Дальше · упражнение 2 из 3')).toBeVisible();
    await page.getByRole('button', { name: 'Пропустить отдых' }).click();
    await expect(page.getByText('Упражнение 2 из 3 · подход 1 из 2')).toBeVisible();
    await expect(weight(page)).toHaveValue('8');
    await page.getByRole('button', { name: 'Сделал' }).click();
    // rest 0 -> straight to the next set
    await expect(page.getByText('Упражнение 2 из 3 · подход 2 из 2')).toBeVisible();
    await page.getByRole('button', { name: 'Пропустить упражнение' }).click();
    await expect(page.getByText('Упражнение 3 из 3 · подход 1 из 1')).toBeVisible();
    await expect(page.getByText(/^Калибровка: подберите вес/)).toBeVisible();

    // finish from the menu with an exercise not done
    await page.getByRole('button', { name: 'Меню тренировки' }).click();
    await sheet(page, 'Тренировка').getByRole('button', { name: 'Завершить тренировку' }).click();
    await expect(page.getByRole('heading', { name: 'Не все упражнения сделаны' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Подъём ног лёжа/ })).toContainText('Вернуться ›');
    await page.getByRole('button', { name: 'Завершить', exact: true }).click();

    // summary: 3 of 5 sets, 32 of 59 reps
    await expect(page.getByRole('heading', { name: 'Тренировка завершена' })).toBeVisible();
    await expect(page.getByText('из 5 по плану')).toBeVisible();
    await expect(page.locator('.a-in', { hasText: 'Подходы' })).toContainText('3');
    await expect(page.getByText('32 из 59 повторов')).toBeVisible();
    await expect(page.locator('.a-in', { hasText: 'Выполнено' })).toContainText('54%');
    const benchCard = page.locator('.card', { hasText: 'Жим штанги лёжа' });
    await expect(benchCard).toContainText('52,5 кг');
    await expect(benchCard).toContainText('× 11');
    await expect(page.locator('.card', { hasText: 'Махи в стороны' })).toContainText('не сделан');
    await page.getByRole('button', { name: 'Продолжить' }).click();
    await expect(page).toHaveURL(/#\/week/);
    await expect(page.getByText('✓ выполнено 54%')).toBeVisible();

    // program progress: 1 of 4 training days done
    await tab(page, 'Спорт').click();
    await expect(page.locator('a', { hasText: 'ИДЁТ СЕЙЧАС' })).toContainText('25%');

    // journal -> summary -> edit
    await tab(page, 'Журнал').click();
    const entry = page.locator('a[href^="#/summary/"]');
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText('3 упражнения');
    await expect(entry).toContainText('54%');
    await entry.click();
    await expect(page.getByRole('link', { name: '‹ Назад' })).toBeVisible();
    await page.getByRole('button', { name: 'Меню' }).click();
    await sheet(page, 'Тренировка').getByRole('link', { name: 'Изменить' }).click();
    await expect(page).toHaveURL(/#\/workout-edit\/\d+/);
    const ex1 = page.locator('.card', { hasText: 'Жим штанги лёжа' });
    await expect(ex1.getByLabel('Вес').first()).toHaveValue('52,5');
    await ex1.getByLabel('Вес').first().fill('55');
    await ex1.getByLabel('Повторы').first().fill('abc');
    await expect(page.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    await ex1.getByLabel('Повторы').first().fill('10');
    // fill the missed side raise set
    await page.locator('.card', { hasText: 'Махи в стороны' }).getByLabel('Повторы').nth(1).fill('12');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(toast(page)).toHaveText('Сохранено');
    await expect(page).toHaveURL(/#\/summary\/\d+/);
    await expect(page.locator('.card', { hasText: 'Жим штанги лёжа' })).toContainText('55 кг');
    await expect(page.locator('.a-in', { hasText: 'Подходы' })).toContainText('4');

    // delete -> journal
    await page.getByRole('button', { name: 'Меню' }).click();
    await sheet(page, 'Тренировка').getByRole('button', { name: 'Удалить тренировку' }).click();
    await sheet(page, 'Тренировка').getByRole('button', { name: 'Да, удалить' }).click();
    await expect(toast(page)).toHaveText('Тренировка удалена');
    await expect(page).toHaveURL(/#\/log$/);
    await expect(page.locator('a[href^="#/summary/"]')).toHaveCount(0);
    await tab(page, 'Спорт').click();
    await expect(page.locator('a', { hasText: 'ИДЁТ СЕЙЧАС' })).toContainText('0%');
    const { workouts } = await call(user.token, 'GET', '/workouts');
    expect(workouts).toHaveLength(0);
    void p;
  });

  test('«Отменить тренировку» deletes it and the day can be started again; an unfinished workout does not count', async ({ authed: page, user }) => {
    await setup(user);
    await startFromWeek(page);
    await page.getByRole('button', { name: 'Сделал' }).click();
    // in progress: Спорт shows «Продолжить», progress stays 0 %
    await open(page, 'sport');
    await expect(page.getByText('идёт тренировка')).toBeVisible();
    await expect(page.locator('a', { hasText: 'ИДЁТ СЕЙЧАС' })).toContainText('0%');
    await page.getByRole('link', { name: 'Продолжить' }).click();
    await expect(page.getByText('Отдых', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Меню тренировки' }).click();
    const m = sheet(page, 'Тренировка');
    await m.getByRole('button', { name: 'Отменить тренировку' }).click();
    await expect(m).toContainText('Отменить тренировку?');
    await m.getByRole('button', { name: 'Нет, продолжить' }).click();
    await expect(m).toHaveCount(0);
    await page.getByRole('button', { name: 'Меню тренировки' }).click();
    await m.getByRole('button', { name: 'Отменить тренировку' }).click();
    await m.getByRole('button', { name: 'Да, отменить' }).click();
    await expect(page).toHaveURL(/#\/week/);
    await expect(page.getByRole('link', { name: 'Начать тренировку' })).toBeVisible();
    const { workouts } = await call(user.token, 'GET', '/workouts');
    expect(workouts).toHaveLength(0);
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('podhod-flow-')))).toEqual([]);
  });

  test('finishing every set goes straight to the summary; the week card then opens it', async ({ authed: page, user }) => {
    const wd = weekdayIdx(today());
    await createProgram(user.token, { name: 'Короткая', weeks: 1, days: { [wd]: [{ name: 'Жим штанги лёжа', sets: 1, reps: '5', kg: '40', rest: 90 }] } });
    await open(page, `day/${today()}`);
    await page.locator('.fixed-bottom').getByRole('button', { name: 'Начать' }).click();
    await page.getByRole('button', { name: 'Меньше повторений' }).click();
    await page.getByRole('button', { name: 'Сделал' }).click();
    await expect(page.getByRole('heading', { name: 'Тренировка завершена' })).toBeVisible();
    await expect(page.getByText('× 4 из 5')).toBeVisible();
    await expect(page.locator('.a-in', { hasText: 'Выполнено' })).toContainText('80%');
    await page.getByRole('button', { name: 'Продолжить' }).click();
    await expect(page.getByText('✓ выполнено 80%')).toBeVisible();
    await page.getByRole('link', { name: 'Итог' }).click();
    await expect(page).toHaveURL(/#\/summary\/\d+\/week/);
    await expect(page.getByRole('heading', { name: /Грудь/ })).toBeVisible();
    await page.getByRole('link', { name: '‹ Назад' }).click();
    await expect(page).toHaveURL(/#\/week$/);
    // the day screen now offers the summary instead of a new workout
    await open(page, `day/${today()}`);
    await expect(page.locator('.fixed-bottom').getByRole('button', { name: 'Итог ›' })).toBeVisible();
    await open(page, 'sport');
    await expect(page.locator('a', { hasText: 'ИДЁТ СЕЙЧАС' })).toContainText('100%');
  });

  test('deleting from the workout editor lands on the journal', async ({ authed: page, user }) => {
    const wd = weekdayIdx(today());
    const p = await createProgram(user.token, { name: 'Ред', weeks: 1, days: { [wd]: [{ name: 'Жим штанги лёжа', sets: 2, reps: '5', kg: '40' }] } });
    const { workout } = await call(user.token, 'POST', '/workouts', {
      date: today(), title: 'Грудь', programId: p.id, week: 1, weekday: wd, status: 'finished',
      exercises: [{ exerciseId: null, name: 'Жим штанги лёжа', type: 'weight_reps', rest: 60, sets: [{ plannedWeight: 40, plannedReps: 5, weight: 40, reps: 5 }, { plannedWeight: 40, plannedReps: 5, weight: 40, reps: 5 }] }],
    });
    await open(page, `workout-edit/${workout.id}`);
    await page.getByRole('button', { name: 'Удалить подход' }).nth(1).click();
    await expect(page.getByLabel('Вес')).toHaveCount(1);
    await page.getByRole('button', { name: '+ Подход' }).click();
    await expect(page.getByLabel('Вес')).toHaveCount(2);
    await expect(page.getByLabel('Вес').nth(1)).toHaveValue('40');
    await page.getByRole('button', { name: 'Удалить тренировку' }).click();
    await sheet(page, 'Подтверждение').getByRole('button', { name: 'Удалить' }).click();
    await expect(page).toHaveURL(/#\/log$/);
    await expect(page.getByText('Здесь появятся прошедшие тренировки')).toBeVisible();
  });

  // fixed (was a bug): deleting a workout (summary menu, editor, «Отменить тренировку») calls invalidate('/workouts'), which
  // also refetches the cached '/workouts/<id>' of the workout just deleted -> a failed GET 404 and a console error
  // every time. src/lib/query.ts invalidate() + src/screens/Summary.tsx / WorkoutEdit.tsx / WorkoutFlow.tsx.
  test('deleting a workout makes no failing requests', async ({ authed: page, user }) => {
    const wd = weekdayIdx(today());
    await createProgram(user.token, { name: 'Чисто', weeks: 1, days: { [wd]: [{ name: 'Жим штанги лёжа', sets: 1, reps: '5', kg: '40' }] } });
    const failed: string[] = [];
    page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
    await open(page, `day/${today()}`);
    await page.locator('.fixed-bottom').getByRole('button', { name: 'Начать' }).click();
    await page.getByRole('button', { name: 'Сделал' }).click();
    await page.getByRole('button', { name: 'Продолжить' }).click();
    await page.getByRole('link', { name: 'Итог' }).click();
    await page.getByRole('button', { name: 'Меню' }).click();
    await sheet(page, 'Тренировка').getByRole('button', { name: 'Удалить тренировку' }).click();
    await sheet(page, 'Тренировка').getByRole('button', { name: 'Да, удалить' }).click();
    await expect(page).toHaveURL(/#\/log$/);
    await page.waitForTimeout(1000);
    expect(failed).toEqual([]);
  });
});
