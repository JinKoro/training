import { test, expect, open, sheet, toast, today, weekdayIdx, WD_SHORT, createProgram, addEntry, call, fmt, layoutProblems, dayMonth, type Page } from './fixtures';
import { kcal, suggestNorms } from '../../src/lib/calc';

const side = (page: Page) => page.getByRole('navigation', { name: 'Разделы' });
const h1 = (page: Page, name: string) => page.getByRole('heading', { level: 1, name, exact: true });

test.describe('Desktop layout (1440×900)', () => {
  test('sidebar sections, titles, collapse; no horizontal overflow', async ({ authed: page, user }) => {
    const wd = weekdayIdx(today());
    await createProgram(user.token, { name: 'Десктоп', weeks: 4, days: { [wd]: [{ name: 'Жим штанги лёжа', sets: 3, reps: '10', kg: '50' }] } });
    await addEntry(user.token, today(), 'lunch', 'Гречка варёная', 200);
    await open(page, 'week');
    await expect(page.locator('.tabbar')).toHaveCount(0);
    const sections: [string, string, RegExp][] = [
      ['Неделя', 'Неделя', /#\/week/], ['Календарь', 'Календарь', /#\/calendar/], ['Тренировки', 'Тренировки', /#\/workouts/],
      ['Спорт', 'Спорт', /#\/sport/], ['Журнал', 'Журнал', /#\/log/], ['Профиль', 'Профиль', /#\/profile/],
    ];
    const problems: string[] = [];
    for (const [link, title, url] of sections) {
      await side(page).getByRole('link', { name: link }).click();
      await expect(page).toHaveURL(url);
      await expect(h1(page, title)).toBeVisible();
      await expect(side(page).getByRole('link', { name: link })).toHaveAttribute('aria-current', 'page');
      await page.waitForTimeout(700);
      problems.push(...(await layoutProblems(page)).map((p) => `${link}: ${p}`));
    }
    await side(page).getByRole('link', { name: 'Еда' }).click();
    await expect(page.getByRole('heading', { level: 1, name: new RegExp(dayMonth(today())) })).toBeVisible();
    await page.waitForTimeout(700);
    problems.push(...(await layoutProblems(page)).map((p) => `Еда: ${p}`));
    await side(page).getByRole('link', { name: 'Упражнения' }).click();
    await page.waitForTimeout(700);
    problems.push(...(await layoutProblems(page)).map((p) => `Упражнения: ${p}`));
    expect(problems).toEqual([]);

    await expect(side(page).getByRole('button', { name: `Выйти · ${user.name}` })).toBeVisible();
    await side(page).getByRole('button', { name: 'Свернуть меню' }).click();
    await expect(side(page).getByRole('link', { name: 'Неделя' })).toHaveText('');
    await page.reload();
    await expect(side(page).getByRole('button', { name: 'Развернуть меню' })).toBeVisible();
    await side(page).getByRole('button', { name: 'Развернуть меню' }).click();
    await expect(side(page).getByRole('link', { name: 'Неделя' })).toHaveText('Неделя');
  });

  test('login page has the two-column layout with the Вход / Регистрация switch', async ({ page }) => {
    await open(page, 'login');
    await expect(page.getByRole('heading', { name: 'Тренировки и питание в одном месте' })).toBeVisible();
    await page.getByRole('button', { name: 'Регистрация' }).click();
    await expect(page).toHaveURL(/#\/register/);
    await expect(page.getByText('Шаг 1 из 4')).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    await page.getByRole('button', { name: 'Вход' }).click();
    await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible();
  });

  test('Спорт: programs open in the editor; create and delete there', async ({ authed: page, user }) => {
    const p = await createProgram(user.token, { name: 'Первая', weeks: 2, days: { 0: [{ name: 'Жим штанги лёжа', sets: 3, reps: '10' }] } });
    await open(page, `program/${p.id}`);
    await expect(page).toHaveURL(new RegExp(`#/program/${p.id}/edit`)); // wide: the program screen is the editor
    await side(page).getByRole('link', { name: 'Спорт' }).click();
    await page.locator('a', { hasText: 'ИДЁТ СЕЙЧАС' }).click();
    await expect(page.getByText('Изменить программу')).toBeVisible();
    await page.getByRole('link', { name: 'Отмена' }).click();
    await page.getByRole('link', { name: '+ Программа' }).click();
    await page.getByLabel('Название').fill('Вторая');
    await page.getByRole('button', { name: '+ Упражнение' }).click();
    await page.getByLabel('Поиск').fill('Махи в стороны');
    await page.locator('button.item', { hasText: 'Махи в стороны' }).first().click();
    await page.getByRole('button', { name: 'Создать' }).click();
    await expect(toast(page)).toHaveText('Программа создана');
    await expect(page).toHaveURL(/#\/sport$/);
    await expect(page.locator('a', { hasText: 'ИДЁТ СЕЙЧАС' })).toContainText('Вторая');
    await page.locator('.list a', { hasText: 'Вторая' }).click();
    await page.getByRole('button', { name: 'Удалить программу' }).click();
    await sheet(page, 'Удаление программы').getByRole('button', { name: 'Удалить' }).click();
    await expect(page).toHaveURL(/#\/sport$/);
    await expect(page.locator('.list a', { hasText: 'Вторая' })).toHaveCount(0);
  });

  test('Тренировки: start today\'s workout, finish, edit it in place, delete', async ({ authed: page, user, allowErrors }) => {
    allowErrors(/404 .*\/api\/workouts\/\d+$|http 404 GET \/api\/workouts\/\d+$/); // see workout.spec.ts
    const wd = weekdayIdx(today());
    await createProgram(user.token, { name: 'Стол', weeks: 1, days: { [wd]: [{ name: 'Жим штанги лёжа', sets: 1, reps: '8', kg: '60', rest: 30 }] } });
    await open(page, 'workouts');
    await expect(page.getByText('Сегодня · Грудь')).toBeVisible();
    await expect(page.locator('section', { hasText: 'по программе' })).toContainText('1×8 · 60 кг');
    await page.getByRole('link', { name: 'Начать тренировку' }).click();
    await expect(page).toHaveURL(new RegExp(`#/day/${today()}`));
    await page.getByRole('button', { name: 'Начать тренировку' }).click();
    await expect(page.getByText('Упражнение 1 из 1 · подход 1 из 1')).toBeVisible();
    await page.getByRole('button', { name: 'Сделал' }).click();
    await expect(page.getByRole('heading', { name: 'Тренировка завершена' })).toBeVisible();
    await page.getByRole('button', { name: 'Продолжить' }).click();
    await expect(page).toHaveURL(/#\/week/);

    await side(page).getByRole('link', { name: 'Тренировки' }).click();
    await page.locator('aside a', { hasText: 'Грудь' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Грудь' })).toBeVisible();
    await page.getByLabel('Вес').fill('62,5');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(toast(page)).toHaveText('Сохранено');
    const { workouts } = await call(user.token, 'GET', '/workouts');
    expect(workouts[0].exercises[0].sets[0].weight).toBe(62.5);
    await page.getByRole('button', { name: 'Удалить тренировку' }).click();
    await sheet(page, 'Подтверждение').getByRole('button', { name: 'Удалить' }).click();
    await expect(page).toHaveURL(/#\/log$/);
  });

  test('Еда: table, quick add from the side search, entry sheet, product form beside the list', async ({ authed: page }) => {
    const D = today();
    await open(page, `food/${D}`);
    const table = page.locator('table');
    for (const m of ['Завтрак', 'Обед', 'Ужин', 'Перекус']) await expect(table).toContainText(m);
    await page.getByLabel('Поиск по общей библиотеке').fill('Гречка варёная');
    await page.getByRole('button', { name: 'Добавить Гречка варёная' }).click();
    await expect(toast(page)).toHaveText('Добавлено в завтрак');
    const row = table.locator('tr', { hasText: 'Гречка варёная' });
    await expect(row).toContainText('100 г');
    await expect(row).toContainText('109');
    await expect(page.getByText(`осталось ${fmt(kcal([150, 70, 250]) - 109)} ккал`)).toBeVisible();
    await row.click();
    await sheet(page, 'Гречка варёная').getByRole('button', { name: 'Больше' }).click();
    await sheet(page, 'Гречка варёная').getByRole('button', { name: 'Сохранить' }).click();
    await expect(row).toContainText('150 г');
    // next / previous day
    await page.getByRole('link', { name: 'Следующий день' }).click();
    await expect(table.locator('tr', { hasText: 'Гречка варёная' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Предыдущий день' }).click();
    await expect(row).toBeVisible();

    // add screen: search on the left, product form on the right
    await table.getByRole('link', { name: 'Добавить' }).nth(1).click();
    await expect(page.getByRole('heading', { name: 'Добавить в обед' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Новый продукт' })).toBeVisible();
    await page.getByLabel('Название').fill('Кефир тестовый');
    await page.getByLabel('Белки, г').fill('3');
    await page.getByLabel('Жиры, г').fill('1');
    await page.getByLabel('Углеводы, г').fill('4');
    await page.getByRole('button', { name: 'Сохранить в библиотеку' }).click();
    await expect(toast(page)).toHaveText('Продукт в библиотеке');
    await expect(page.getByLabel('Название')).toHaveValue('');
    expect(await layoutProblems(page)).toEqual([]);
  });

  test('Профиль: one form for data and norms, «Сохранено ✓», recalculation offer', async ({ authed: page, user }) => {
    await open(page, 'profile');
    const save = page.getByRole('button', { name: 'Сохранить изменения' });
    await expect(save).toBeDisabled();
    await page.getByLabel('Вес, кг').fill('3');
    await expect(page.getByRole('button', { name: 'Исправьте ошибки в данных' })).toBeDisabled();
    await page.getByLabel('Вес, кг').fill('90');
    await save.click();
    await expect(page.getByRole('button', { name: 'Сохранено ✓' })).toBeVisible();
    const want = suggestNorms({ sex: 'm', weight: 90, bodyFat: 20, steps: 8000, trainingMode: 'time', trainingMin: 60, trainingKcal: 0 }, 'keep');
    const s = sheet(page, 'Пересчитать калории?');
    await expect(s).toContainText(fmt(kcal(want.rest)));
    await s.getByRole('button', { name: 'Пересчитать' }).click();
    await expect(toast(page)).toHaveText('Калории пересчитаны');
    await expect(page.getByLabel('День отдыха, Белки, г')).toHaveValue(String(want.rest[0]));
    // norms typed by hand win: no offer
    await page.getByLabel('День отдыха, Углеводы, г').fill('200');
    await page.getByLabel('Шагов в день').fill('9000');
    await page.getByRole('button', { name: 'Сохранить изменения' }).click();
    await expect(page.getByRole('button', { name: 'Сохранено ✓' })).toBeVisible();
    await expect(sheet(page)).toHaveCount(0);
    const me = await call(user.token, 'GET', '/me');
    expect(me.profile.steps).toBe(9000);
    void WD_SHORT;
  });
});
