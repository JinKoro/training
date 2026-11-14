import { test, expect, open, sheet, toast, today, addDays, weekStart, WD_SHORT, weekdayIdx, addEntry, call, fmt, dayMonth, type Page } from './fixtures';

const D = today();
const meal = (page: Page, name: string) => page.locator('.card.col', { has: page.locator('b', { hasText: new RegExp(`^${name}$`) }) });
const entryRow = (page: Page, name: string) => page.locator('button.row', { hasText: name });
const search = (page: Page) => page.getByLabel('Поиск по всем продуктам');
/** Гречка варёная: 4 / 1 / 21 per 100 g, no label kcal -> 109 kcal per 100 g. */
const BUCK = { p: 4, f: 1, c: 21, k: 109 };

test.describe('Food diary', () => {
  test('add via search, weights screen, edit, delete; search history', async ({ authed: page, user }) => {
    await open(page, `food/${D}`);
    await expect(page.getByRole('heading', { name: `Сегодня, ${dayMonth(D)}` })).toBeVisible();
    const normK = 150 * 4 + 70 * 9 + 250 * 4; // rest-day norm, no program
    await expect(page.getByText(`Осталось ${fmt(normK)} ккал`)).toBeVisible();
    await meal(page, 'Завтрак').getByRole('link', { name: 'Добавить' }).click();
    await expect(page).toHaveURL(new RegExp(`#/food/${D}/add/breakfast`));
    await expect(page.getByRole('tab', { name: 'Недавние' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('За последние 3 дня завтраков не было')).toBeVisible();

    await search(page).fill('гречка вар');
    await page.getByRole('link', { name: /Гречка варёная/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Гречка варёная' })).toBeVisible();
    await expect(page.getByLabel('Граммы')).toHaveValue('100');
    await page.getByRole('button', { name: '150 г' }).click();
    await expect(page.getByLabel('Граммы')).toHaveValue('150');
    await expect(page.locator('.num', { hasText: fmt(BUCK.k * 1.5) }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Больше' }).click();
    await expect(page.getByLabel('Граммы')).toHaveValue('200');
    await page.getByRole('button', { name: 'Меньше' }).click();
    await page.getByLabel('Граммы').fill('0');
    await expect(page.getByRole('button', { name: 'Добавить в завтрак' })).toBeDisabled();
    await page.getByLabel('Граммы').fill('150');
    await page.getByRole('button', { name: 'Добавить в завтрак' }).click();
    await expect(toast(page)).toHaveText('Гречка варёная — в завтрак');
    // back to the same search, the back button now counts what was added
    await expect(search(page)).toHaveValue('гречка вар');
    await page.getByRole('button', { name: 'Готово, добавлено: 1' }).click();
    await expect(page).toHaveURL(new RegExp(`#/food/${D}$`));

    const row = entryRow(page, 'Гречка варёная');
    await expect(row).toContainText('150 г');
    await expect(row).toContainText(fmt(BUCK.k * 1.5));
    await expect(meal(page, 'Завтрак')).toContainText(`${fmt(BUCK.k * 1.5)} ккал`);
    await expect(page.getByRole('img', { name: `Съедено ${Math.round(BUCK.k * 1.5)} из ${normK} ккал` })).toBeVisible();
    await expect(page.getByText(`Осталось ${fmt(normK - Math.round(BUCK.k * 1.5))} ккал`)).toBeVisible();

    // edit the amount
    await row.click();
    const es = sheet(page, 'Гречка варёная');
    await expect(es).toContainText('109 ккал на 100 г');
    await es.getByRole('button', { name: 'Больше' }).click();
    await expect(es.getByLabel('Граммы')).toHaveValue('200');
    await es.getByRole('button', { name: 'Сохранить' }).click();
    await expect(row).toContainText('200 г');
    await expect(row).toContainText(fmt(BUCK.k * 2));

    // search history: shown on an empty focused field
    await meal(page, 'Обед').getByRole('link', { name: 'Добавить' }).click();
    await search(page).click();
    await expect(page.getByText('История поиска')).toBeVisible();
    await expect(page.getByRole('button', { name: 'гречка вар', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'гречка вар', exact: true }).click();
    await expect(search(page)).toHaveValue('гречка вар');
    await page.getByRole('button', { name: 'Очистить' }).click();
    await search(page).click();
    await page.getByRole('button', { name: 'Убрать «гречка вар» из истории' }).click();
    await expect(page.getByText('История поиска')).toBeHidden();
    await expect.poll(async () => (await call(user.token, 'GET', '/food/searches')).searches).toEqual([]);
    await page.getByRole('link', { name: '‹ Еда' }).click();

    // delete
    await row.click();
    await sheet(page, 'Гречка варёная').getByRole('button', { name: 'Удалить из дневника' }).click();
    await expect(row).toHaveCount(0);
    await expect(meal(page, 'Завтрак')).toContainText('0 ккал');
  });

  test('new product: form validation, save, add; duplicate barcode; edit and delete own product', async ({ authed: page, user, allowErrors }) => {
    allowErrors(/409/);
    // deleting the product refetches its own '/products/<id>' cache entry -> 404 (same bug as workouts, see workout.spec.ts)
    allowErrors(/404 .*\/api\/products\/\d+$|http 404 GET \/api\/products\/\d+$/);
    const code = `46${Date.now().toString().slice(-11)}`;
    await call(user.token, 'POST', '/products', { name: 'Чужой продукт', protein: 1, fat: 1, carbs: 1, barcode: code });
    await open(page, `food/${D}/add/snack`);
    await page.getByRole('link', { name: 'Продукт' }).click();
    await expect(page.getByText('Новый продукт')).toBeVisible();
    const save = page.getByRole('button', { name: 'Сохранить и выбрать вес' });
    await expect(save).toBeDisabled();
    await page.getByLabel('Название').fill('Т');
    await page.getByLabel('Белки, г').fill('120');
    await expect(page.getByLabel('Белки, г')).toHaveAttribute('aria-invalid', 'true');
    await page.getByLabel('Белки, г').fill('20');
    await expect(page.getByLabel('Белки, г')).toHaveAttribute('aria-invalid', 'false');
    await page.getByLabel('Жиры, г').fill('10,5');
    await page.getByLabel('Углеводы, г').fill('80');
    await expect(page.getByLabel('Углеводы, г')).toHaveAttribute('aria-invalid', 'true'); // 110,5 g in 100 g
    await page.getByLabel('Углеводы, г').fill('50');
    await expect(save).toBeDisabled(); // name too short
    await page.getByLabel('Название').fill('Батончик тестовый');
    await expect(page.getByText('В библиотеке: Батончик тестовый')).toBeVisible();
    await page.getByLabel('Бренд').fill('Е2Е');
    await expect(page.getByText('В библиотеке: Е2Е · Батончик тестовый')).toBeVisible();
    await expect(page.getByLabel('Калории')).toHaveAttribute('placeholder', String(Math.round(20 * 4 + 10.5 * 9 + 50 * 4)));
    await page.getByLabel('Калории').fill('1000');
    await expect(page.getByLabel('Калории')).toHaveAttribute('aria-invalid', 'true');
    await expect(save).toBeDisabled();
    await page.getByLabel('Калории').fill('380');
    await page.getByLabel('Штрихкод').fill('123');
    await expect(page.getByLabel('Штрихкод')).toHaveAttribute('aria-invalid', 'true');
    await expect(save).toBeDisabled();
    await page.getByLabel('Штрихкод').fill(code);
    await save.click();
    await expect(page.getByText('Такой штрихкод уже есть')).toBeVisible();
    await expect(page.getByRole('button', { name: /Чужой продукт/ })).toBeVisible();
    await page.getByLabel('Штрихкод').fill('');
    await save.click();

    await expect(page.getByRole('heading', { name: 'Е2Е · Батончик тестовый' })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`#/food/${D}/item/product/\\d+/snack`));
    await page.getByRole('button', { name: '200 г' }).click();
    await expect(page.locator('.num', { hasText: '760' }).first()).toBeVisible(); // label kcal 380 × 2
    await page.getByRole('button', { name: 'Добавить в перекус' }).click();
    await open(page, `food/${D}`);
    await expect(entryRow(page, 'Батончик тестовый')).toContainText('760');

    // edit own product from its weights screen
    await meal(page, 'Перекус').getByRole('link', { name: 'Добавить' }).click();
    await search(page).fill('Батончик тестовый');
    await page.getByRole('link', { name: /Батончик тестовый/ }).first().click();
    await page.getByRole('button', { name: 'Меню' }).click();
    await sheet(page, 'Продукт').getByRole('link', { name: 'Изменить' }).click();
    await expect(page.getByText('Изменить продукт')).toBeVisible();
    await expect(page.getByLabel('Белки, г')).toHaveValue('20');
    await page.getByLabel('Белки, г').fill('25');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByRole('heading', { name: 'Е2Е · Батончик тестовый' })).toBeVisible();
    const { products } = await call(user.token, 'GET', '/products?mine=1');
    expect(products.find((p: { title: string }) => p.title === 'Батончик тестовый').protein).toBe(25);

    // delete it
    await page.getByRole('button', { name: 'Меню' }).click();
    await sheet(page, 'Продукт').getByRole('button', { name: 'Удалить продукт' }).click();
    await sheet(page, 'Продукт').getByRole('button', { name: 'Да, удалить' }).click();
    await expect(toast(page)).toHaveText('Продукт удалён');
    expect((await call(user.token, 'GET', '/products?mine=1')).products.map((p: { title: string }) => p.title)).not.toContain('Батончик тестовый');
    // the diary entry keeps its copy
    await open(page, `food/${D}`);
    await expect(entryRow(page, 'Батончик тестовый')).toBeVisible();
  });

  test('a shared product from the library has no delete', async ({ authed: page }) => {
    await open(page, `food/${D}/add/lunch`);
    await page.getByRole('tab', { name: 'Библиотека' }).click();
    await expect(page.getByText('Остальные продукты, в том числе добавленные другими, ищите через поиск.')).toBeVisible();
    await page.locator('a.row.grow').first().click();
    await expect(page.getByText('Общая библиотека')).toBeVisible();
    await page.getByRole('button', { name: 'Меню' }).click();
    await expect(sheet(page, 'Продукт').getByRole('link', { name: 'Изменить' })).toBeVisible();
    await expect(sheet(page, 'Продукт').getByRole('button', { name: 'Удалить продукт' })).toHaveCount(0);
  });

  test('new dish from ingredients; dish from a meal', async ({ authed: page, user }) => {
    await open(page, `food/${D}/add/dinner`);
    await page.getByRole('tab', { name: 'Блюда' }).click();
    await expect(page.getByText('Для ужина блюд пока нет')).toBeVisible();
    await page.getByRole('link', { name: '+ Новое блюдо' }).click();
    const done = page.getByRole('button', { name: 'Готово' });
    await expect(done).toBeDisabled();
    await page.getByLabel('Название').fill('Гречка с курицей');
    for (const n of ['Гречка варёная', 'Куриная грудка']) {
      await page.getByRole('button', { name: '+ Ингредиент' }).click();
      await page.getByLabel('Поиск по общей библиотеке').fill(n);
      await page.locator('button.row', { hasText: n }).first().click();
    }
    await page.getByLabel('Граммы: Гречка варёная').fill('200');
    await expect(page.getByLabel('Вес готового блюда')).toHaveValue('300');
    await page.getByLabel('Вес готового блюда').fill('250');
    // per 100 g of the cooked dish: kcal = (200·109 + 100·(23·4 + 1,5·9)) / 250
    const k100 = (200 * 1.09 + (23 * 4 + 1.5 * 9)) / 250 * 100;
    const blue = page.locator('div', { hasText: /^На 100 г готового блюда/ });
    await expect(blue).toContainText(fmt(k100));
    await expect(blue).toContainText(String(Math.round((200 * 0.04 + 23) / 250 * 100)));
    await page.getByLabel('Граммы: Гречка варёная').fill('0');
    await expect(done).toBeDisabled();
    await page.getByLabel('Граммы: Гречка варёная').fill('200');
    await done.click();
    await expect(page.getByRole('heading', { name: 'Гречка с курицей' })).toBeVisible();
    await expect(page.getByText('своё блюдо', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Добавить в ужин' }).click();
    await page.getByRole('button', { name: /Готово, добавлено/ }).click();
    await expect(entryRow(page, 'Гречка с курицей')).toContainText('своё блюдо');
    await expect(entryRow(page, 'Гречка с курицей')).toContainText(fmt(k100));

    // a dish from what was eaten at breakfast
    await addEntry(user.token, D, 'breakfast', 'Гречка варёная', 150);
    await addEntry(user.token, D, 'breakfast', 'Куриная грудка', 120);
    await page.reload();
    await meal(page, 'Завтрак').getByRole('link', { name: '+ Создать блюдо' }).click();
    await expect(page.getByText('Блюдо из завтрака')).toBeVisible();
    await expect(page.getByLabel('Граммы: Гречка варёная')).toHaveValue('150');
    await expect(page.getByLabel('Граммы: Куриная грудка')).toHaveValue('120');
    await expect(page.getByRole('button', { name: 'Завтрак' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Ужин' })).toHaveAttribute('aria-pressed', 'false');
    await page.getByLabel('Название').fill('Мой завтрак');
    await page.getByRole('button', { name: 'Готово' }).click();
    await expect(toast(page)).toHaveText('Блюдо «Мой завтрак» сохранено');
    await expect(page).toHaveURL(new RegExp(`#/food/${D}$`));
    const { dishes } = await call(user.token, 'GET', '/dishes');
    expect(dishes.map((d: { name: string }) => d.name).sort()).toEqual(['Гречка с курицей', 'Мой завтрак']);
    expect(dishes.find((d: { name: string }) => d.name === 'Мой завтрак').meals).toEqual(['breakfast']);
  });

  test('copy a meal to another day; yesterday tab quick add; food calendar', async ({ authed: page, user }) => {
    const y = addDays(D, -1), tm = addDays(D, 1);
    await addEntry(user.token, y, 'lunch', 'Куриная грудка', 180);
    await addEntry(user.token, D, 'lunch', 'Гречка варёная', 200);
    await open(page, `food/${D}`);
    await meal(page, 'Обед').getByRole('button', { name: 'Скопировать приём пищи' }).click();
    const cs = sheet(page, 'Копирование');
    await expect(cs).toContainText('Скопировать обед');
    await expect(cs).toContainText(`Гречка варёная · ${fmt(BUCK.k * 2)} ккал`);
    if (weekStart(tm) !== weekStart(D)) await cs.getByRole('button', { name: 'Следующая неделя' }).click();
    const dayBtn = (d: string) => cs.getByRole('button', { name: new RegExp(`^${WD_SHORT[weekdayIdx(d)]}\\s?${Number(d.slice(8))}$`) });
    if (weekStart(y) === weekStart(D)) await expect(dayBtn(y)).toBeDisabled();
    await dayBtn(tm).click();
    await expect(dayBtn(tm)).toHaveAttribute('aria-pressed', 'true');
    await cs.getByRole('button', { name: 'Скопировать в 1 день' }).click();
    await expect(toast(page)).toHaveText('Скопировано');
    await open(page, `food/${tm}`);
    await expect(page.getByRole('heading', { name: `Завтра, ${dayMonth(tm)}` })).toBeVisible();
    await expect(meal(page, 'Обед')).toContainText('Гречка варёная');

    // yesterday's food, one tap
    await open(page, `food/${D}`);
    await meal(page, 'Ужин').getByRole('link', { name: 'Добавить' }).click();
    await page.getByRole('tab', { name: 'Вчера' }).click();
    await expect(page.getByText('Куриная грудка')).toBeVisible();
    await expect(page.getByText(`180 г · ${fmt((23 * 4 + 1.5 * 9) * 1.8)} ккал`)).toBeVisible();
    await page.getByRole('button', { name: 'Добавить Куриная грудка' }).click();
    await expect(page.getByRole('button', { name: 'Куриная грудка добавлен' })).toBeVisible();
    await page.getByRole('button', { name: 'Готово, добавлено: 1' }).click();
    await expect(meal(page, 'Ужин')).toContainText('Куриная грудка');
    await expect(meal(page, 'Ужин')).toContainText('180 г');

    // calendar from the food screen
    await page.getByRole('button', { name: 'Календарь' }).click();
    await expect(page).toHaveURL(new RegExp(`#/food-calendar/${D}`));
    await expect(page.getByText(`Сегодня, ${dayMonth(D)}`)).toBeVisible();
    const eaten = Math.round(BUCK.k * 2 + (23 * 4 + 1.5 * 9) * 1.8);
    await expect(page.locator('.card', { hasText: 'Еда' })).toContainText(fmt(eaten));
    if (y.slice(0, 7) === D.slice(0, 7)) {
      await page.locator(`button[title="${dayMonth(y)}"]`).click();
      await expect(page.getByText(new RegExp(`, ${dayMonth(y)}$`))).toBeVisible();
      await page.getByRole('link', { name: 'Открыть день' }).click();
      await expect(page).toHaveURL(new RegExp(`#/food/${y}$`));
      await expect(meal(page, 'Обед')).toContainText('Куриная грудка');
    }
  });

  // fixed (was a bug): `cameFromAdd` (module flag in FoodAdd.tsx) is set when a food row is opened from the add panel and only
  // cleared by «Добавить». Open a food, go back without adding, then create a new product: its «Добавить» does
  // history.back() and lands on the empty «Новый продукт» form instead of the add list. src/screens/FoodAdd.tsx.
  test('after creating a product, «Добавить» returns to the add list', async ({ authed: page }) => {
    await open(page, `food/${D}/add/snack`);
    await search(page).fill('Гречка варёная');
    await page.getByRole('link', { name: /Гречка варёная/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Гречка варёная' })).toBeVisible();
    await page.getByRole('button', { name: '‹ Назад' }).click();
    await page.getByLabel('Очистить').click();
    await page.getByRole('link', { name: 'Продукт' }).click();
    await page.getByLabel('Название').fill('Сырок тестовый');
    await page.getByLabel('Белки, г').fill('8');
    await page.getByLabel('Жиры, г').fill('20');
    await page.getByLabel('Углеводы, г').fill('30');
    await page.getByRole('button', { name: 'Сохранить и выбрать вес' }).click();
    await expect(page.getByRole('heading', { name: 'Сырок тестовый' })).toBeVisible();
    await page.getByRole('button', { name: 'Добавить в перекус' }).click();
    await expect(page).toHaveURL(new RegExp(`#/food/${D}/add/snack$`), { timeout: 3000 });
  });
});
