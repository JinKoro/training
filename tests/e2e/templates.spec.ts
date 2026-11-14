import { test, expect, open, sheet, toast, today, weekdayIdx, addDays, WD_SHORT, createProgram, registerUser, login, call, type Page } from './fixtures';
import { templateById, templateDay, weightFor } from '../../src/lib/templates';

const kg = (n: number) => String(n).replace('.', ',');
const dayBtns = (page: Page) => page.locator('.col', { has: page.getByText('Дни тренировок', { exact: true }) }).last();

test.describe('Ready-made programs', () => {
  test('a man sees «Сила и масса» at three levels; a woman sees «Фулбади»', async ({ page }) => {
    const m = await registerUser({ sex: 'm' });
    await login(page, m.token);
    await open(page, 'sport');
    await expect(page.getByText('Готовые программы')).toBeVisible();
    const list = page.locator('.list', { has: page.locator('a[href^="#/template/"]') });
    await expect(list.locator('a')).toHaveCount(3);
    await expect(list.locator('a').nth(0)).toContainText('Сила и масса');
    await expect(list.locator('a').nth(0)).toContainText('новичок');
    await expect(list.locator('a').nth(1)).toContainText('любитель');
    await expect(list.locator('a').nth(2)).toContainText('продвинутый');
    await expect(list.locator('a').nth(0)).toContainText('13 недель · 3 раза в неделю');
    await expect(page.getByText('Фулбади')).toHaveCount(0);

    // switching the sex in the profile switches the list
    await open(page, 'profile/edit');
    await page.getByRole('button', { name: 'Женщина' }).click();
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page).toHaveURL(/#\/profile$/);
    await open(page, 'sport');
    await expect(list.locator('a')).toHaveCount(3);
    await expect(list.locator('a').nth(0)).toContainText('Фулбади');
    await expect(list.locator('a').nth(0)).toContainText('12 недель');
  });

  test('template screen shows the blocks and the weeks', async ({ authed: page }) => {
    await open(page, 'sport');
    await page.locator('a[href="#/template/m1"]').click();
    await expect(page.getByRole('heading', { name: 'Сила и масса' })).toBeVisible();
    await expect(page.getByText('любитель').first()).toBeVisible();
    await expect(page.locator('.card', { hasText: 'Нагрузка по неделям' })).toContainText('Адаптациянедели 1–2');
    await expect(page.locator('.card', { hasText: 'Нагрузка по неделям' })).toContainText('Разгрузканеделя 11');
    await page.getByRole('button', { name: 'Неделя 12' }).click();
    await expect(page.getByText('Пик', { exact: true }).last()).toBeVisible();
    const t = templateById('m1')!;
    const day = templateDay(t, 12, 0);
    const mon = page.locator('.card', { hasText: 'Понедельник' });
    await expect(mon).toContainText(`${day.length} упр.`);
    await expect(mon).toContainText(`${day[0].sets}×${day[0].reps}`);
    await expect(mon).toContainText('дропсет'); // last accessory of a peak week, levels 1–2
  });

  test('start: 3 days, weights, «Не знаю», replace the current program; the copy has the level and weights', async ({ authed: page, user }) => {
    await createProgram(user.token, { name: 'Моя старая', weeks: 4, days: { 1: [{ name: 'Жим штанги лёжа', sets: 3, reps: '10' }] } });
    const t = templateById('m0')!;
    await open(page, 'template/m0');
    await page.getByRole('button', { name: 'Начать программу' }).click();
    await expect(page.getByRole('heading', { name: 'Старт программы' })).toBeVisible();

    // weekdays: today + two more, so the first workout is today
    const wd = weekdayIdx(today());
    const want = [wd, (wd + 2) % 7, (wd + 4) % 7].sort((a, b) => a - b);
    const days = dayBtns(page);
    for (const i of [0, 2, 4]) if (!want.includes(i)) await days.getByRole('button', { name: WD_SHORT[i], exact: true }).click();
    const pressed = async () => (await Promise.all([0, 1, 2, 3, 4, 5, 6].map((i) => days.getByRole('button', { name: WD_SHORT[i], exact: true }).getAttribute('aria-pressed')))).filter((x) => x === 'true').length;
    const start = page.getByRole('button', { name: 'Начать', exact: true });
    if (await pressed() < 3) {
      await expect(page.getByText(/Выберите ещё \d (день|дня)/)).toBeVisible();
      await expect(start).toBeDisabled();
    }
    for (const i of want) if ((await days.getByRole('button', { name: WD_SHORT[i], exact: true }).getAttribute('aria-pressed')) !== 'true') await days.getByRole('button', { name: WD_SHORT[i], exact: true }).click();
    const extra = [0, 1, 2, 3, 4, 5, 6].find((i) => !want.includes(i))!;
    await days.getByRole('button', { name: WD_SHORT[extra], exact: true }).click();
    await expect(page.getByText('Нужно 3 дня, уберите лишний')).toBeVisible();
    await expect(start).toBeDisabled();
    await days.getByRole('button', { name: WD_SHORT[extra], exact: true }).click();
    await expect(page.getByText(/Первая тренировка — .*, \d+ /)).toContainText('Первая тренировка — ');

    // weights
    const bench = page.getByLabel('Жим штанги лёжа');
    await bench.fill('0');
    await expect(page.getByText('Число, например 47,5')).toBeVisible();
    await expect(start).toBeDisabled();
    await bench.fill('6o');
    await expect(bench).toHaveValue('6'); // letters are dropped
    await bench.fill('60');
    const w1 = weightFor(60, 8, 12, t.load[0]);
    await expect(page.getByText(`Неделя 1 · 3×12 · ${kg(w1)} кг`)).toBeVisible();
    await page.locator('.card', { hasText: 'Тяга верхнего блока к груди' }).getByRole('button', { name: 'Не знаю' }).click();
    await expect(page.locator('.card', { hasText: 'Тяга верхнего блока к груди' })).toContainText('Подберём на первой тренировке');
    await page.getByLabel('Жим ногами, стандартная').fill('100');
    await expect(start).toBeEnabled();
    await start.click();

    const confirm = sheet(page, 'Начать программу');
    await expect(confirm).toContainText('Начать «Сила и масса»?');
    await expect(confirm).toContainText('«Моя старая» перестанет быть текущей');
    await confirm.getByRole('button', { name: 'Начать' }).click();
    await expect(toast(page)).toHaveText('Программа «Сила и масса» начата');
    await expect(page).toHaveURL(/#\/sport$/);

    const current = page.locator('a', { hasText: 'ИДЁТ СЕЙЧАС' });
    await expect(current).toContainText('Сила и масса');
    await expect(current).toContainText('новичок');
    const mine = page.locator('.list', { hasText: '+ Программа' });
    await expect(mine.locator('a', { hasText: 'Сила и масса' })).toContainText('новичок');
    await expect(mine.locator('a', { hasText: 'Сила и масса' })).toContainText('13 недель · 3 раза в неделю');
    await expect(mine.locator('a', { hasText: 'Моя старая' })).toBeVisible();
    // today is a training day of the new program
    await expect(page.locator('.card', { hasText: 'Начать' }).first()).toBeVisible();

    // the copy: level tag on its screen, weights in the editor
    await mine.locator('a', { hasText: 'Сила и масса' }).click();
    await expect(page.getByRole('heading', { name: 'Сила и масса' })).toBeVisible();
    await expect(page.getByText('новичок')).toBeVisible();
    await page.getByRole('button', { name: 'Меню' }).click();
    await sheet(page, 'Программа').getByRole('link', { name: 'Изменить' }).click();
    await page.getByRole('button', { name: 'Неделя 1', exact: true }).click();
    await page.locator('.chips .chip', { hasText: WD_SHORT[want[0]] }).click();
    const row = (n: string) => page.locator('div.a-in.col', { has: page.getByText(n, { exact: true }) });
    await expect(row('Жим штанги лёжа').getByLabel('Вес')).toHaveValue(kg(w1));
    await expect(row('Тяга верхнего блока к груди').getByLabel('Вес')).toHaveValue('');
    await expect(row('Жим ногами, стандартная').getByLabel('Вес')).toHaveValue(kg(weightFor(100, 8, 12, t.load[0])));
    await expect(row('Сгибания рук с гантелями').getByLabel('Вес')).toHaveValue('');
    await expect(row('Жим штанги лёжа').getByLabel('Повторы')).toHaveValue('12');
    // deload week 11: 2×10 at 70 %
    await page.getByRole('button', { name: 'Неделя 11' }).click();
    await page.locator('.chips .chip', { hasText: WD_SHORT[want[0]] }).click();
    await expect(row('Жим штанги лёжа').getByLabel('Подходы')).toHaveValue('2');
    await expect(row('Жим штанги лёжа').getByLabel('Вес')).toHaveValue(kg(weightFor(60, 8, 10, t.load[10])));

    // every template exercise made it into the copy
    const { programs } = await call(user.token, 'GET', '/programs');
    const copy = programs.find((p: { level: number | null }) => p.level === 0);
    for (let w = 1; w <= t.weeks; w++) {
      want.forEach((d, i) => expect(copy.plan[String(w)][String(d)].length, `week ${w} day ${d}`).toBe(templateDay(t, w, i).length));
    }
    expect(copy.startDate).toBe(addDays(today(), -wd));
  });

  test('without a current program it starts at once; the first workout may be next week', async ({ authed: page, user }) => {
    await open(page, 'template/m2');
    await page.getByRole('button', { name: 'Начать программу' }).click();
    const wd = weekdayIdx(today());
    const days = dayBtns(page);
    // only days before today in the week -> first workout next week
    if (wd >= 3) {
      for (const i of [0, 2, 4]) await days.getByRole('button', { name: WD_SHORT[i], exact: true }).click();
      for (const i of [0, 1, 2]) await days.getByRole('button', { name: WD_SHORT[i], exact: true }).click();
      await expect(page.getByText(/Первая тренировка — понедельник/)).toBeVisible();
    }
    for (const l of templateById('m2')!.lifts) await page.locator('.card', { hasText: l }).getByRole('button', { name: 'Не знаю' }).click();
    await page.getByRole('button', { name: 'Начать', exact: true }).click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(page).toHaveURL(/#\/sport$/);
    await expect(page.locator('a', { hasText: 'ИДЁТ СЕЙЧАС' })).toContainText('продвинутый');
    const { programs } = await call(user.token, 'GET', '/programs');
    expect(programs).toHaveLength(1);
    expect(programs[0].level).toBe(2);
    if (wd >= 3) expect(programs[0].startDate).toBe(addDays(today(), 7 - wd));
  });
});
