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

    // bottom of the menu: who is signed in (opens the profile), «Выйти», then the collapse arrow
    await expect(side(page).getByRole('link', { name: new RegExp(user.name) })).toHaveAttribute('href', '#/profile');
    await expect(side(page).getByRole('button', { name: 'Выйти' })).toBeVisible();
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
    await expect(page.getByRole('button', { name: 'Удалить тренировку' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Итог ›' }).click();
    await page.getByRole('button', { name: 'Меню', exact: true }).click();
    await sheet(page, 'Тренировка').getByRole('button', { name: 'Удалить тренировку' }).click();
    await sheet(page, 'Тренировка').getByRole('button', { name: 'Да, удалить' }).click();
    await expect(page).toHaveURL(/#\/log$/);
  });

  test('Еда: the phone day (week strip, ring, meal cards in two columns, week macros on the right), entry sheet, product form beside the list', async ({ authed: page, user }) => {
    const D = today();
    await addEntry(user.token, D, 'breakfast', 'Гречка варёная', 100);
    await open(page, `food/${D}`);
    // no table and no quick-add side panel any more
    await expect(page.locator('table')).toHaveCount(0);
    await expect(page.getByLabel('Поиск по общей библиотеке')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^Добавить в / })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Предыдущая неделя' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Календарь' })).toBeVisible();
    await expect(page.locator('a[aria-current="date"]')).toHaveAttribute('href', `#/food/${D}`);
    await expect(page.getByRole('heading', { name: `Сегодня, ${dayMonth(D)}` })).toBeVisible();
    await expect(page.getByRole('img', { name: /^Съедено 109 из / })).toBeVisible();
    const card = (n: string) => page.locator('.card.col', { has: page.locator('b', { hasText: new RegExp(`^${n}$`) }) });
    for (const m of ['Завтрак', 'Обед', 'Ужин', 'Перекус']) await expect(card(m).getByRole('link', { name: 'Добавить' })).toBeVisible();
    // two columns: breakfast and lunch side by side, main column capped
    const boxes = async () => [(await card('Завтрак').boundingBox())!, (await card('Обед').boundingBox())!];
    await expect.poll(async () => { const [x, y] = await boxes(); return Math.abs(x.y - y.y); }).toBeLessThan(2); // after the cards' slide-in
    const [b1, b2] = await boxes();
    expect(b2!.x).toBeGreaterThan(b1!.x + b1!.width);
    expect(b2!.x + b2!.width - b1!.x).toBeLessThanOrEqual(860);
    const aside = page.locator('aside');
    await expect(aside.getByText('Неделя', { exact: true })).toBeVisible();
    expect(Math.round((await aside.boundingBox())!.width)).toBe(320);
    await expect(card('Завтрак').getByRole('link', { name: '+ Создать блюдо' })).toBeVisible();
    await expect(card('Завтрак').getByRole('button', { name: 'Скопировать приём пищи' })).toBeEnabled();

    const row = card('Завтрак').locator('button.row', { hasText: 'Гречка варёная' });
    await expect(row).toContainText('100 г');
    await expect(row).toContainText('109');
    await expect(page.getByText(`Осталось ${fmt(kcal([150, 70, 250]) - 109)} ккал`)).toBeVisible();
    await row.click();
    await sheet(page, 'Гречка варёная').getByRole('button', { name: 'Больше' }).click();
    await sheet(page, 'Гречка варёная').getByRole('button', { name: 'Сохранить' }).click();
    await expect(row).toContainText('150 г');
    // next week and back with «К сегодня»
    await page.getByRole('link', { name: 'Следующая неделя' }).click();
    await expect(page.locator('button.row', { hasText: 'Гречка варёная' })).toHaveCount(0);
    await page.getByRole('link', { name: 'К сегодня' }).click();
    await expect(row).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);

    // add screen: search on the left, product form on the right
    await card('Обед').getByRole('link', { name: 'Добавить' }).click();
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

  test('Еда: new dish form (capped width, header actions), ingredient via the add search; own kcal on an entry', async ({ authed: page, user }) => {
    const D = today();
    await open(page, `food/${D}/add/lunch`);
    await page.getByRole('tab', { name: 'Блюда' }).click();
    await page.getByRole('link', { name: '+ Новое блюдо' }).click();
    await expect(h1(page, 'Новое блюдо')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Отмена' })).toBeVisible();
    const done = page.getByRole('button', { name: 'Готово' });
    await expect(done).toHaveCount(1); // in the header only
    await expect(done).toBeDisabled();
    const ings = page.getByRole('region', { name: 'Ингредиенты' });
    expect((await ings.boundingBox())!.width).toBeLessThanOrEqual(760);
    await page.getByLabel('Название').fill('Каша');
    await page.getByRole('button', { name: 'Добавить ингредиент' }).click();
    await expect(h1(page, 'Добавить в блюдо')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Блюда' })).toHaveCount(0);
    await page.getByLabel('Поиск по всем продуктам').fill('Гречка вар');
    await page.locator('button.row', { hasText: 'Гречка варёная' }).first().click();
    await page.getByRole('button', { name: 'Добавить в блюдо' }).click();
    await expect(ings.locator('button.row', { hasText: 'Гречка варёная' })).toContainText('100 г');
    await expect(page.getByText('Всё блюдо · 100 г')).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    await done.click();
    await expect(page.getByRole('heading', { name: 'Каша' })).toBeVisible();

    // own kcal for a logged entry, from the entry sheet
    await addEntry(user.token, D, 'dinner', 'Гречка варёная', 100);
    await open(page, `food/${D}`);
    const row = page.locator('button.row', { hasText: 'Гречка варёная' });
    await expect(row).toContainText('109');
    await row.click();
    const s = sheet(page, 'Гречка варёная');
    await s.getByRole('button', { name: 'Свои ккал и БЖУ' }).click();
    await s.getByLabel('Калории').fill('200');
    await s.getByRole('button', { name: 'Сохранить' }).click();
    await expect(row).toContainText('200');
    const { entries } = await call(user.token, 'GET', `/diary?from=${D}&to=${D}`);
    expect(entries[0]).toMatchObject({ kcal: 200, custom: true });
    expect((await call(user.token, 'GET', `/products/${entries[0].productId}`)).product.kcal).toBeNull();
  });

  test('Профиль: the same menu as on the phone; «Данные и замеры» → «Изменить» (desktop form), recalculation offer', async ({ authed: page, user }) => {
    await open(page, 'profile');
    await expect(page.getByRole('link', { name: /Тренировочный день/ })).toContainText(`${fmt(kcal(user.norms.training!))} ккал`);
    await expect(page.getByRole('link', { name: /Удалить аккаунт/ })).toBeVisible();
    await page.getByRole('link', { name: /Данные и замеры/ }).click();
    await expect(page.getByText('Замеры тела')).toBeVisible();
    await page.getByRole('link', { name: 'Изменить' }).click();
    await expect(page).toHaveURL(/#\/profile\/edit$/);
    await page.getByLabel('Вес, кг').fill('3');
    await expect(page.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    await page.getByLabel('Вес, кг').fill('90');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    const want = suggestNorms({ sex: 'm', weight: 90, bodyFat: 20, steps: 8000, trainingMode: 'time', trainingMin: 60, trainingKcal: 0 }, 'keep');
    const s = sheet(page, 'Пересчитать калории?');
    await expect(s).toContainText(fmt(kcal(want.rest)));
    await s.getByRole('button', { name: 'Пересчитать' }).click();
    await expect(toast(page)).toHaveText('Калории пересчитаны');
    await expect(page).toHaveURL(/#\/profile\/body$/);
    const me = await call(user.token, 'GET', '/me');
    expect(me.profile.weight).toBe(90);
    void WD_SHORT;
  });
});
