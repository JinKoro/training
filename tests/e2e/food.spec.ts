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

  test('a shared product cannot be changed; own kcal and macros go into this one entry only', async ({ authed: page, user }) => {
    await open(page, `food/${D}/add/lunch`);
    await search(page).fill('гречка вар');
    await page.getByRole('link', { name: /Гречка варёная/ }).first().click();
    await expect(page.getByText('Общая библиотека')).toBeVisible();
    // no «⋯»: only the user's own product can be changed or deleted
    await expect(page.getByRole('button', { name: 'Меню', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Свои ккал и БЖУ' }).click();
    await page.getByLabel('Калории').fill('274,5');
    await page.getByRole('button', { name: '150 г' }).click();
    await expect(page.locator('.num', { hasText: '411,8' }).first()).toBeVisible(); // label kcal with tenths -> one decimal
    await page.getByLabel('Белки, г').fill('120');
    await expect(page.getByRole('button', { name: 'Добавить в обед' })).toBeDisabled();
    await page.getByLabel('Белки, г').fill('4');
    await page.getByRole('button', { name: 'Добавить в обед' }).click();
    await expect(toast(page)).toHaveText('Гречка варёная — в обед');
    await expect.poll(async () => (await call(user.token, 'GET', `/diary?from=${D}&to=${D}`)).entries.length).toBe(1);
    const { entries } = await call(user.token, 'GET', `/diary?from=${D}&to=${D}`);
    expect(entries[0]).toMatchObject({ grams: 150, kcal: 274.5, protein: 4 });
    const { product } = await call(user.token, 'GET', `/products/${entries[0].productId}`);
    expect(product.kcal).not.toBe(274.5); // the library keeps its values
  });

  test('new dish: button first, ingredients via the add search, weight sheet, totals; dish from a meal', async ({ authed: page, user }) => {
    await addEntry(user.token, D, 'dinner', 'Куриная грудка', 120); // a recent dinner food for the quick «+»
    await open(page, `food/${D}/add/dinner`);
    await page.getByRole('tab', { name: 'Блюда' }).click();
    const newDish = page.getByRole('link', { name: '+ Новое блюдо' });
    const empty = page.getByText('Для ужина блюд пока нет');
    await expect(empty).toBeVisible();
    // «+ Новое блюдо» comes first, above the list
    expect((await newDish.boundingBox())!.y).toBeLessThan((await empty.boundingBox())!.y);
    await newDish.click();
    const done = page.getByRole('button', { name: 'Готово' });
    await expect(done).toBeDisabled();
    await expect(page.getByPlaceholder('Например, омлет с сыром')).toBeVisible();
    await expect(page.getByText('Вес готового блюда')).toHaveCount(0);
    await page.getByLabel('Название').fill('Гречка с курицей');
    const ings = page.getByRole('region', { name: 'Ингредиенты' });
    const ing = (n: string) => ings.locator('button.row', { hasText: n });

    // «+» → the add search in ingredient mode → weights → «Добавить в блюдо»
    await page.getByRole('button', { name: 'Добавить ингредиент' }).click();
    await expect(page.getByText('Ингредиент', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '‹ Блюдо' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Недавние' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Блюда' })).toHaveCount(0);
    await search(page).fill('Гречка вар');
    await page.locator('button.row', { hasText: 'Гречка варёная' }).first().click();
    await expect(page.getByRole('button', { name: 'Свои ккал и БЖУ' })).toHaveCount(0);
    await page.getByLabel('Граммы').fill('200');
    await page.getByRole('button', { name: 'Добавить в блюдо' }).click();
    await expect(page.getByLabel('Название')).toHaveValue('Гречка с курицей'); // the draft is kept
    await expect(ing('Гречка варёная')).toContainText('200 г · Б 8 Ж 2 У 42');
    await expect(ing('Гречка варёная')).toContainText('218');

    // quick «+» on a recent row adds straight into the dish
    await page.getByRole('button', { name: 'Добавить ингредиент' }).click();
    await page.getByRole('button', { name: 'Добавить Куриная грудка' }).click();
    await expect(ing('Куриная грудка')).toContainText('120 г');
    const kOf = (gb: number, gc: number) => gb * 1.09 + gc * (23 * 4 + 1.5 * 9) / 100;
    await expect(ings).toContainText(`${fmt(kOf(200, 120))} ккал`);
    const total = page.locator('div', { hasText: /^Всё блюдо · / });
    await expect(total).toContainText('Всё блюдо · 320 г');
    await expect(total).toContainText(fmt(kOf(200, 120)));
    await expect(total).toContainText(String(Math.round(200 * 0.04 + 1.2 * 23)));

    // a tap on an ingredient: the same sheet as a diary entry (kcal per 100 g, tiles, own values; step 10), «Убрать из блюда»
    await ing('Гречка варёная').click();
    const s = sheet(page, 'Гречка варёная');
    await expect(s.getByText('109 ккал на 100 г', { exact: true })).toBeVisible();
    await expect(s.getByText('218', { exact: true })).toBeVisible(); // the kcal tile for 200 g
    await expect(s.getByRole('button', { name: 'Свои ккал и БЖУ' })).toBeVisible();
    await s.getByRole('button', { name: 'Меньше' }).click();
    await s.getByRole('button', { name: 'Сохранить' }).click();
    await expect(ing('Гречка варёная')).toContainText('190 г');
    await ing('Куриная грудка').click();
    await sheet(page, 'Куриная грудка').getByRole('button', { name: 'Убрать из блюда' }).click();
    await expect(ing('Куриная грудка')).toHaveCount(0);
    await expect(total).toContainText('Всё блюдо · 190 г');
    await page.getByRole('button', { name: 'Добавить ингредиент' }).click();
    await page.getByRole('button', { name: 'Добавить Куриная грудка' }).click();
    await expect(total).toContainText('Всё блюдо · 310 г');

    await done.click();
    await expect(page.getByRole('heading', { name: 'Гречка с курицей' })).toBeVisible();
    await expect(page.getByText('своё блюдо', { exact: true })).toBeVisible();
    // stored per 100 g of the whole dish (the sum of the raw weights)
    const k100 = kOf(190, 120) / 310 * 100;
    const { dishes } = await call(user.token, 'GET', '/dishes');
    expect(dishes[0]).toMatchObject({ name: 'Гречка с курицей', cookedWeight: 310 });
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
    await expect(ing('Гречка варёная')).toContainText('150 г');
    await expect(ing('Куриная грудка')).toContainText('120 г');
    await expect(total).toContainText('Всё блюдо · 270 г');
    await expect(page.getByRole('button', { name: 'Завтрак' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Ужин' })).toHaveAttribute('aria-pressed', 'false');
    await page.getByLabel('Название').fill('Мой завтрак');
    await page.getByRole('button', { name: 'Готово' }).click();
    await expect(toast(page)).toHaveText('Блюдо «Мой завтрак» сохранено');
    await expect(page).toHaveURL(new RegExp(`#/food/${D}$`));
    const after = (await call(user.token, 'GET', '/dishes')).dishes;
    expect(after.map((d: { name: string }) => d.name).sort()).toEqual(['Гречка с курицей', 'Мой завтрак']);
    expect(after.find((d: { name: string }) => d.name === 'Мой завтрак')).toMatchObject({ meals: ['breakfast'], cookedWeight: 270 });
  });

  test('own kcal and macros for a dish ingredient: the dish totals and the saved dish change, the product does not', async ({ authed: page, user }) => {
    await open(page, `food/${D}/add/lunch`);
    await page.getByRole('tab', { name: 'Блюда' }).click();
    await page.getByRole('link', { name: '+ Новое блюдо' }).click();
    await page.getByLabel('Название').fill('Своя гречка');
    await page.getByRole('button', { name: 'Добавить ингредиент' }).click();
    await search(page).fill('Гречка вар');
    await page.locator('button.row', { hasText: 'Гречка варёная' }).first().click();
    await page.getByLabel('Граммы').fill('200');
    await page.getByRole('button', { name: 'Добавить в блюдо' }).click();
    const ings = page.getByRole('region', { name: 'Ингредиенты' });
    const row = ings.locator('button.row', { hasText: 'Гречка варёная' });
    const total = page.locator('div', { hasText: /^Всё блюдо · / });
    await expect(total).toContainText('218');

    await row.click();
    let s = sheet(page, 'Гречка варёная');
    await s.getByRole('button', { name: 'Свои ккал и БЖУ' }).click();
    await expect(s.getByLabel('Калории')).toHaveValue('109');
    await s.getByLabel('Калории').fill('150');
    await s.getByLabel('Белки, г').fill('120');
    await expect(s.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    await s.getByLabel('Белки, г').fill('10');
    await expect(s.getByText('150 ккал на 100 г · свои', { exact: true })).toBeVisible();
    await expect(s.getByText('300', { exact: true })).toBeVisible(); // tiles follow the own values
    await s.getByRole('button', { name: 'Сохранить' }).click();
    await expect(row).toContainText('200 г · Б 20 Ж 2 У 42');
    await expect(row).toContainText('300');
    await expect(ings).toContainText('300 ккал');
    await expect(total).toContainText('300');

    // reopened: the block is filled with the own values
    await row.click();
    s = sheet(page, 'Гречка варёная');
    await expect(s.getByLabel('Калории')).toHaveValue('150');
    await expect(s.getByLabel('Белки, г')).toHaveValue('10');
    await s.getByRole('button', { name: 'Сохранить' }).click();

    await page.getByRole('button', { name: 'Готово' }).click();
    await expect(page.getByRole('heading', { name: 'Своя гречка' })).toBeVisible();
    const { dishes } = await call(user.token, 'GET', '/dishes');
    expect(dishes[0]).toMatchObject({ name: 'Своя гречка', cookedWeight: 200 });
    for (const [k, v] of [['kcal', 150], ['protein', 10], ['fat', 1], ['carbs', 21]] as const) expect(dishes[0][k]).toBeCloseTo(v, 6);
    const found = (await call(user.token, 'GET', `/products?q=${encodeURIComponent('Гречка варёная')}`)).products.find((p: { name: string }) => p.name === 'Гречка варёная');
    expect(found).toMatchObject({ protein: 4, fat: 1, carbs: 21, kcal: null });
  });

  test('own kcal and macros for a logged entry: the day changes, the product does not', async ({ authed: page, user }) => {
    const { entry } = await addEntry(user.token, D, 'lunch', 'Гречка варёная', 200);
    await open(page, `food/${D}`);
    const ring = page.getByRole('img', { name: /^Съедено/ });
    await expect(ring).toHaveAccessibleName(/Съедено 218 /);
    await entryRow(page, 'Гречка варёная').click();
    let s = sheet(page, 'Гречка варёная');
    await s.getByRole('button', { name: 'Свои ккал и БЖУ' }).click();
    await expect(s.getByLabel('Калории')).toHaveValue('109');
    await expect(s.getByText('На 100 г, только для этой записи')).toBeVisible();
    await s.getByLabel('Калории').fill('150');
    await s.getByLabel('Белки, г').fill('120');
    await expect(s.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    await s.getByLabel('Белки, г').fill('5');
    await expect(s).toContainText('300'); // tiles follow the own values
    await s.getByRole('button', { name: 'Сохранить' }).click();
    await expect(entryRow(page, 'Гречка варёная')).toContainText('300');
    await expect(ring).toHaveAccessibleName(/Съедено 300 /);
    const got = (await call(user.token, 'GET', `/diary?from=${D}&to=${D}`)).entries[0];
    expect(got).toMatchObject({ id: entry.id, kcal: 150, protein: 5, custom: true });
    const { product } = await call(user.token, 'GET', `/products/${got.productId}`);
    expect(product).toMatchObject({ protein: 4, kcal: null });

    // reopened: the block is filled with the own values; «Как было» goes back to the product
    await entryRow(page, 'Гречка варёная').click();
    s = sheet(page, 'Гречка варёная');
    await expect(s.getByLabel('Калории')).toHaveValue('150');
    await expect(s.getByLabel('Белки, г')).toHaveValue('5');
    await s.getByRole('button', { name: 'Как было' }).click();
    await expect(s.getByRole('button', { name: 'Свои ккал и БЖУ' })).toBeVisible();
    await s.getByRole('button', { name: 'Сохранить' }).click();
    await expect(ring).toHaveAccessibleName(/Съедено 218 /);
    expect((await call(user.token, 'GET', `/diary?from=${D}&to=${D}`)).entries[0]).toMatchObject({ kcal: null, protein: 4, custom: false });
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
    const dayBtn = (d: string) => cs.getByRole('button', { name: new RegExp(`^${WD_SHORT[weekdayIdx(d)]}\\s?${Number(d.slice(8))}$`) });
    // check yesterday while its week is shown (on a Sunday tomorrow is in the next week)
    if (weekStart(y) === weekStart(D)) await expect(dayBtn(y)).toBeDisabled();
    if (weekStart(tm) !== weekStart(D)) await cs.getByRole('button', { name: 'Следующая неделя' }).click();
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
