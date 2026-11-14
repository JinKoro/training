import { test, expect, open, sheet, toast, tab, today, weekdayIdx, WD_SHORT, call, createProgram, type Page } from './fixtures';

const WD_CAP = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

async function addExercise(page: Page, name: string) {
  await page.getByRole('button', { name: '+ Упражнение' }).click();
  await expect(page.getByRole('heading', { name: 'Добавить упражнение' })).toBeVisible();
  await page.getByLabel('Поиск').fill(name);
  await page.locator('button.item', { hasText: name }).first().click();
}
const row = (page: Page, name: string) => page.locator('div.a-in.col', { has: page.getByText(name, { exact: true }) });

test.describe('Own program editor', () => {
  test('create: name, weekdays, weeks, exercises, rest parsing, copy week', async ({ authed: page, allowErrors }) => {
    // Reported separately below (mixed border / borderColor styles).
    allowErrors(/a style property during rerender .* Removing borderColor border/s);
    const wd = weekdayIdx(today());
    await open(page, 'sport');
    await expect(page.getByText('Нет активной программы')).toBeVisible();
    await page.getByRole('link', { name: '+ Программа' }).click();
    await expect(page.getByText('Новая программа')).toBeVisible();

    await page.getByLabel('Название').fill('Мой сплит');
    const dayBtn = (i: number) => page.locator('.field', { hasText: 'Дни тренировок' }).getByRole('button', { name: WD_SHORT[i], exact: true });
    // default Mon/Wed/Fri; make it Tue + today's weekday (+Mon if today is Tue)
    for (const i of [0, 2, 4]) await dayBtn(i).click();
    for (const i of [0, 2, 4]) await expect(dayBtn(i)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText('Выберите хотя бы один день')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Создать' })).toBeDisabled();
    const other = wd === 1 ? 0 : 1;
    await dayBtn(wd).click();
    await dayBtn(other).click();

    // 8 weeks by default -> 3
    for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Меньше недель' }).click();
    await expect(page.locator('.card', { hasText: 'Недель в программе' })).toContainText('3');
    await expect(page.getByRole('button', { name: /^Неделя \d$/ })).toHaveCount(3);

    // week 1, today's weekday
    await page.locator('.chips .chip', { hasText: WD_SHORT[wd] }).click();
    await addExercise(page, 'Жим штанги лёжа');
    await addExercise(page, 'Тяга верхнего блока к груди');
    const bench = row(page, 'Жим штанги лёжа');
    await bench.getByLabel('Подходы').fill('4');
    await bench.getByLabel('Повторы').fill('8');
    await bench.getByLabel('Вес').fill('60');
    const rest = bench.getByLabel('Отдых');
    await expect(rest).toHaveValue('3:00'); // base exercises default to 3 min
    for (const [typed, shown] of [['3,30', '3:30'], ['2', '2:00'], ['130', '1:30'], ['3:00', '3:00'], ['2.45', '2:45']]) {
      await rest.fill(typed);
      await rest.blur();
      await expect(rest, `rest typed as ${typed}`).toHaveValue(shown);
    }
    await rest.fill('3,3'); await rest.blur();
    await expect(rest).toHaveValue('3:30');
    // over 10 minutes: red while typing, the last valid value stays
    await rest.fill('12:00');
    await rest.blur();
    await expect(rest).toHaveValue('3:30');

    const lat = row(page, 'Тяга верхнего блока к груди');
    await lat.getByLabel('Повторы').fill('10-');
    await expect(page.getByRole('button', { name: 'Создать' })).toBeDisabled();
    await lat.getByLabel('Повторы').fill('10-12');
    await lat.getByLabel('Вес').fill('40/45');
    await expect(page.getByRole('button', { name: 'Создать' })).toBeEnabled();
    await expect(page.getByText(/2 упр\. · ~ \d+ мин/)).toBeVisible();

    // the week-wide buttons
    await page.getByRole('button', { name: '+2,5 кг всем' }).click();
    await expect(bench.getByLabel('Вес')).toHaveValue('62,5');
    await expect(lat.getByLabel('Вес')).toHaveValue('42,5/47,5');
    await page.getByRole('button', { name: '+1 подход всем' }).click();
    await expect(bench.getByLabel('Подходы')).toHaveValue('5');

    // week 2: offered to copy week 1
    await page.getByRole('button', { name: 'Неделя 2' }).click();
    const copy = page.locator('.card', { hasText: 'Скопировать неделю' });
    await expect(copy).toBeVisible();
    await copy.getByRole('button', { name: '1', exact: true }).click();
    await page.locator('.chips .chip', { hasText: WD_SHORT[wd] }).click();
    await expect(row(page, 'Жим штанги лёжа').getByLabel('Вес')).toHaveValue('62,5');
    await expect(row(page, 'Жим штанги лёжа').getByLabel('Отдых')).toHaveValue('3:30');
    // week 3 stays empty -> «Заполнить с нуля» shows the editor
    await page.getByRole('button', { name: 'Неделя 3' }).click();
    await copy.getByRole('button', { name: 'Заполнить с нуля' }).click();
    await expect(page.getByRole('button', { name: '+ Упражнение' })).toBeVisible();

    await page.getByRole('button', { name: 'Создать' }).click();
    await expect(toast(page)).toHaveText('Программа создана');
    await expect(page).toHaveURL(/#\/program\/\d+$/);
    await expect(page.getByRole('heading', { name: 'Мой сплит' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Неделя \d$/ })).toHaveCount(3);
    const card = page.locator('.card', { hasText: WD_CAP[wd] });
    await expect(card).toContainText('2 упр.');
    await expect(card.locator('.between', { hasText: 'Жим штанги лёжа' })).toContainText('5×8 · 3:30');
    await expect(card.locator('.between', { hasText: 'Тяга верхнего блока к груди' })).toContainText('4×10–12 · 3:00');
    await expect(page.locator('.card', { hasText: WD_CAP[other] })).toContainText('Пусто');
    await page.getByRole('button', { name: 'Неделя 2' }).click();
    await expect(page.locator('.card', { hasText: WD_CAP[wd] }).locator('.between', { hasText: 'Жим штанги лёжа' })).toContainText('5×8 · 3:30');
    await page.getByRole('button', { name: 'Неделя 3' }).click();
    await expect(page.locator('.card', { hasText: WD_CAP[wd] })).toContainText('Пусто');

    // Спорт lists it as current and under «Мои программы»
    await page.getByRole('link', { name: '‹ Спорт' }).click();
    await expect(page.locator('a', { hasText: 'ИДЁТ СЕЙЧАС' })).toContainText('Мой сплит');
    await expect(page.locator('.list a', { hasText: 'Мой сплит' })).toContainText('3 недели · 2 раза в неделю');
  });

  test('edit and delete from the program menu', async ({ authed: page, user }) => {
    const p = await createProgram(user.token, { name: 'Старое имя', weeks: 4, days: { 0: [{ name: 'Жим штанги лёжа', sets: 3, reps: '10', kg: '50' }], 3: [{ name: 'Приседания со штангой', sets: 3, reps: '8', kg: '70' }] } });
    await open(page, `program/${p.id}`);
    await page.getByRole('button', { name: 'Меню' }).click();
    await sheet(page, 'Программа').getByRole('link', { name: 'Изменить' }).click();
    await expect(page.getByText('Изменить программу')).toBeVisible();
    await expect(page.getByLabel('Название')).toHaveValue('Старое имя');
    await page.getByLabel('Название').fill('Новое имя');
    await page.locator('.chips .chip', { hasText: 'Чт' }).click();
    await row(page, 'Приседания со штангой').getByLabel('Вес').fill('75');
    // more weeks
    await page.getByRole('button', { name: 'Больше недель' }).click();
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(toast(page)).toHaveText('Сохранено');
    await expect(page).toHaveURL(new RegExp(`#/program/${p.id}$`));
    await expect(page.getByRole('heading', { name: 'Новое имя' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Неделя \d$/ })).toHaveCount(5);
    const { program } = await call(user.token, 'GET', `/programs/${p.id}`);
    expect(program.plan['1']['3'][0].kg).toBe('75');

    await page.getByRole('button', { name: 'Меню' }).click();
    await sheet(page, 'Программа').getByRole('button', { name: 'Удалить программу' }).click();
    const del = sheet(page, 'Удаление программы');
    await expect(del).toContainText('Удалить программу «Новое имя»?');
    await del.getByRole('button', { name: 'Удалить' }).click();
    await expect(page).toHaveURL(/#\/sport$/);
    await expect(page.getByText('Нет активной программы')).toBeVisible();
    await expect(page.locator('.list a', { hasText: 'Новое имя' })).toHaveCount(0);
  });

  test('cancel in the editor keeps the program unchanged; fewer weeks clamps the selected week', async ({ authed: page, user }) => {
    const p = await createProgram(user.token, { name: 'Пять недель', weeks: 5, days: { 2: [{ name: 'Жим штанги лёжа', sets: 3, reps: '10' }] } });
    await open(page, `program/${p.id}/edit`);
    await page.getByRole('button', { name: 'Неделя 5' }).click();
    await page.getByRole('button', { name: 'Меньше недель' }).click();
    await expect(page.getByRole('button', { name: 'Неделя 4' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Неделя 4 · среда')).toBeVisible();
    await page.getByLabel('Название').fill('Не сохранять');
    await page.getByRole('link', { name: 'Отмена' }).click();
    await expect(page.getByRole('heading', { name: 'Пять недель' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Неделя \d$/ })).toHaveCount(5);
  });

  test('a removed exercise and a deselected weekday are gone after save', async ({ authed: page, user }) => {
    const p = await createProgram(user.token, { name: 'Чистка', weeks: 2, days: {
      0: [{ name: 'Жим штанги лёжа', sets: 3, reps: '10' }, { name: 'Махи в стороны', sets: 3, reps: '15' }],
      4: [{ name: 'Приседания со штангой', sets: 3, reps: '8' }],
    } });
    await open(page, `program/${p.id}/edit`);
    await page.getByRole('button', { name: 'Неделя 1' }).click();
    await page.locator('.chips .chip', { hasText: 'Пн' }).click();
    await row(page, 'Махи в стороны').getByRole('button', { name: 'Убрать упражнение' }).click();
    await expect(page.getByText('Махи в стороны')).toHaveCount(0);
    await page.locator('.field', { hasText: 'Дни тренировок' }).getByRole('button', { name: 'Пт', exact: true }).click();
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByRole('heading', { name: 'Чистка' })).toBeVisible();
    await page.getByRole('button', { name: 'Неделя 1' }).click();
    await expect(page.locator('.card', { hasText: 'Понедельник' })).toContainText('1 упр.');
    await expect(page.locator('.card', { hasText: 'Пятница' })).toHaveCount(0);
    await tab(page, 'Спорт').click();
    await expect(page.locator('.list a', { hasText: 'Чистка' })).toContainText('1 раз в неделю');
  });

  // fixed (was a bug): the editor's inputs use the `border` shorthand plus a conditional `borderColor` (red when invalid).
  // When a wrong value is corrected, React removes `borderColor` and the field loses its grey border colour
  // (falls back to currentColor = black/white); React also logs "Removing borderColor border" warnings.
  // src/screens/ProgramEditor.tsx (inp + bad()), same pattern in WorkoutEdit.tsx.
  test('a corrected field gets its normal border back', async ({ authed: page, user }) => {
    const p = await createProgram(user.token, { name: 'Рамка', weeks: 1, days: { 0: [{ name: 'Жим штанги лёжа', sets: 3, reps: '10' }] } });
    await open(page, `program/${p.id}/edit`);
    const reps = page.getByLabel('Повторы');
    const before = await reps.evaluate((el) => getComputedStyle(el).borderTopColor);
    await reps.fill('10-');
    await expect.poll(() => reps.evaluate((el) => getComputedStyle(el).borderTopColor)).not.toBe(before);
    await reps.fill('10');
    await expect.poll(() => reps.evaluate((el) => getComputedStyle(el).borderTopColor), { timeout: 2000 }).toBe(before);
  });

  // fixed (was a bug): after the current program is deleted, the older ones stay inactive: Спорт says «Нет активной программы»,
  // but the week / day / journal screens use activeProgram() which falls back to programs[0] and keep planning
  // workouts from a program the user replaced. src/lib/calc.ts activeProgram() vs Sport.tsx `current`.
  test('after deleting the current program the week does not plan from a replaced one', async ({ authed: page, user }) => {
    const wd = weekdayIdx(today());
    await createProgram(user.token, { name: 'Заменённая', weeks: 4, days: { [wd]: [{ name: 'Жим штанги лёжа', sets: 3, reps: '10', kg: '50' }] } });
    const b = await createProgram(user.token, { name: 'Текущая', weeks: 4, days: { [(wd + 1) % 7]: [{ name: 'Махи в стороны', sets: 3, reps: '12' }] } });
    await call(user.token, 'DELETE', `/programs/${b.id}`);
    await open(page, 'sport');
    await expect(page.getByText('Нет активной программы')).toBeVisible();
    await open(page, 'week');
    await expect(page.getByText(`Сегодня, `)).toBeVisible();
    await expect(page.locator('div.muted', { hasText: /^День отдыха$/ })).toBeVisible({ timeout: 3000 });
  });
});
