import { test, expect, open, today, addDays, weekdayIdx, weekStart, createProgram, addEntry, fmt, dayMonth, WD_SHORT, login, registerUser } from './fixtures';
import { kcal } from '../../src/lib/calc';

const WD_CAP = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const MONTH_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const RU = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const joinDays = (idx: number[]) => { const n = idx.map((i) => RU[i]); return n.length <= 1 ? n.join('') : `${n.slice(0, -1).join(', ')} и ${n[n.length - 1]}`; };

test.describe('Week screen', () => {
  test('a new account sees the empty week with the budget and the two calls to action', async ({ authed: page, user }) => {
    await open(page, 'week');
    await expect(page.getByText('Плана тренировок пока нет')).toBeVisible();
    await expect(page.locator('span', { hasText: 'Бюджет на неделю' }).locator('..')).toContainText(fmt(7 * kcal(user.norms.rest)));
    await page.getByRole('link', { name: 'Добавьте первый приём пищи' }).click();
    await expect(page).toHaveURL(new RegExp(`#/food/${today()}/add/breakfast`));
    await open(page, 'week');
    await page.getByRole('link', { name: 'Создать программу' }).click();
    await expect(page.getByText('Новая программа')).toBeVisible();
  });

  test('budget, bars, day panel, workout card buttons, other weeks, macros', async ({ authed: page, user }) => {
    const D = today(), wd = weekdayIdx(D);
    const days: Record<number, { name: string; sets: number; reps: string; kg: string }[]> = { [wd]: [{ name: 'Жим штанги лёжа', sets: 3, reps: '10', kg: '50' }] };
    const next = wd < 6 ? wd + 1 : null;
    if (next !== null) days[next] = [{ name: 'Приседания со штангой', sets: 3, reps: '8', kg: '70' }];
    const p = await createProgram(user.token, { name: 'Неделька', weeks: 2, days });
    await addEntry(user.token, D, 'breakfast', 'Гречка варёная', 200); // 218 kcal
    const T = kcal(user.norms.training!), R = kcal(user.norms.rest);
    const nT = next === null ? 1 : 2;
    const B = nT * T + (7 - nT) * R;
    await open(page, 'week');

    await expect(page.getByText('Осталось на неделю')).toBeVisible();
    const budget = page.getByRole('link', { name: 'Калории и БЖУ за неделю' });
    await expect(budget).toContainText(fmt(B - 218));
    if (wd < 6) {
      const rest = Array.from({ length: 6 - wd }, (_, i) => wd + 1 + i);
      const x = Math.round((B - Math.max(218, T)) / rest.length);
      await expect(budget).toContainText(`Доешьте сегодня норму, и на ${joinDays(rest)} останется по ${fmt(x)}`);
    }
    // today's panel
    await expect(page.getByText(`Сегодня, ${dayMonth(D)}`)).toBeVisible();
    await expect(page.getByText('День тренировки', { exact: true })).toBeVisible();
    const food = page.locator(`a[href="#/food/${D}"]`);
    await expect(food).toContainText('Еда · пока');
    await expect(food).toContainText(`218 / ${fmt(T)} ккал`);
    await expect(page.locator('.card', { hasText: 'Грудь' })).toContainText('1 упражнение');
    await expect(page.getByRole('link', { name: 'Начать тренировку' })).toHaveAttribute('href', `#/day/${D}`);

    // a future training day: «Открыть план»
    if (next !== null) {
      await page.getByRole('button', { name: new RegExp(`^${WD_SHORT[next]}`) }).click();
      const d2 = addDays(D, 1);
      await expect(page.getByText(`${WD_CAP[next]}, ${dayMonth(d2)}`)).toBeVisible();
      await expect(page.locator('.card', { hasText: 'Ноги' })).toContainText('по плану');
      await expect(page.locator(`a[href="#/food/${d2}"]`)).toContainText('Еда · план');
      await page.getByRole('link', { name: 'Открыть план' }).click();
      await expect(page).toHaveURL(new RegExp(`#/program/${p.id}$`));
      await page.goBack();
      await page.getByRole('button', { name: 'К сегодня' }).click();
      await expect(page.getByText(`Сегодня, ${dayMonth(D)}`)).toBeVisible();
    }
    // a past day in this week (before the program existed): rest day
    if (wd > 0) {
      await page.getByRole('button', { name: new RegExp(`^${WD_SHORT[wd - 1]}`) }).click();
      await expect(page.getByText('День отдыха', { exact: true })).toBeVisible();
      await expect(page.getByText('Тренировки нет, день отдыха').or(page.getByText('Можно провести тренировку из программы'))).toBeVisible();
    }

    // next week: plan budget
    await page.getByRole('button', { name: 'Следующая неделя' }).click();
    await expect(page).toHaveURL(/#\/week\/1$/);
    await expect(page.getByText('Бюджет на неделю')).toBeVisible();
    const nTn = Object.keys(days).length;
    await expect(budget).toContainText(fmt(nTn * T + (7 - nTn) * R));
    await expect(budget).toContainText(`${nTn} ${nTn === 1 ? 'тренировочный день' : 'тренировочных дня'} по ${fmt(T)} и ${7 - nTn} ${7 - nTn === 5 ? 'дней' : 'дней'} отдыха по ${fmt(R)}`);
    // previous week: what was eaten
    await page.getByRole('button', { name: 'Предыдущая неделя' }).click();
    await page.getByRole('button', { name: 'Предыдущая неделя' }).click();
    await expect(page).toHaveURL(/#\/week\/-1$/);
    await expect(page.getByText('Съедено за неделю')).toBeVisible();
    await expect(budget).toContainText(`Меньше бюджета на ${fmt(7 * R)} ккал из ${fmt(7 * R)}`);

    // macros screen for this week
    await open(page, 'week');
    await budget.click();
    await expect(page).toHaveURL(/#\/week-macros\/0$/);
    await expect(page.getByRole('heading', { name: 'Баланс БЖУ' })).toBeVisible();
    await expect(page.getByText(/^Неделя 1 · /)).toBeVisible();
    const protein = page.locator('.card', { hasText: 'Белки' });
    const goalP = nT * user.norms.training![0] + (7 - nT) * user.norms.rest[0];
    await expect(protein).toContainText(`8 из ${fmt(goalP)} г за неделю`); // 200 g buckwheat = 8 g protein
    await page.getByRole('link', { name: '‹ Неделя' }).click();
    await expect(page).toHaveURL(/#\/week\/0$/);
  });

  test('a rest day can host a session of the week that is not trained yet', async ({ authed: page, user }) => {
    const D = today(), wd = weekdayIdx(D);
    test.skip(wd === 6, 'needs a later training day in this week');
    await createProgram(user.token, { name: 'Перенос', weeks: 1, days: { 6: [{ name: 'Жим штанги лёжа', sets: 2, reps: '5', kg: '40' }] } });
    await open(page, 'week');
    await expect(page.getByText('День отдыха', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Можно провести тренировку из программы' }).click();
    await expect(page).toHaveURL(new RegExp(`#/day/${D}`));
    await expect(page.getByRole('heading', { name: 'Тренировки нет' })).toBeVisible();
    const other = page.locator('.card', { hasText: 'Воскресенье · 1 упражнение' });
    await other.getByRole('button', { name: 'Начать' }).click();
    await expect(page.getByText('Упражнение 1 из 1 · подход 1 из 2')).toBeVisible();
    await page.getByRole('button', { name: 'Сделал' }).click();
    await page.getByRole('button', { name: 'Пропустить отдых' }).click();
    await page.getByRole('button', { name: 'Сделал' }).click();
    await page.getByRole('button', { name: 'Продолжить' }).click();
    // today is now the training day; Sunday is no longer planned
    await expect(page.getByText('✓ выполнено 100%')).toBeVisible();
    await page.getByRole('button', { name: /^Вс/ }).click();
    await expect(page.locator('div.muted', { hasText: /^День отдыха$/ })).toBeVisible();
  });
});

test.describe('Calendar', () => {
  test('month grid, day panel, month switching', async ({ authed: page, user }) => {
    const D = today();
    await addEntry(user.token, D, 'lunch', 'Гречка варёная', 100);
    await open(page, 'calendar');
    const month = Number(D.slice(5, 7)) - 1, year = D.slice(0, 4);
    await expect(page.getByRole('heading', { name: `${MONTH_NOM[month]} ${year}` })).toBeVisible();
    await expect(page.getByText(`Сегодня, ${dayMonth(D)}`)).toBeVisible();
    await expect(page.getByText('идёт день')).toBeVisible();
    await expect(page.locator('.card', { hasText: 'Еда' })).toContainText('109');
    await expect(page.getByRole('link', { name: 'Добавить еду' })).toHaveAttribute('href', `#/food/${D}`);
    await page.getByRole('button', { name: 'Следующий месяц' }).click();
    await expect(page.getByRole('heading', { name: `${MONTH_NOM[(month + 1) % 12]} ${month === 11 ? Number(year) + 1 : year}` })).toBeVisible();
    await expect(page.getByText('впереди')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Запланировать еду' })).toBeVisible();
    await page.getByRole('button', { name: 'К сегодня' }).click();
    await expect(page.getByText(`Сегодня, ${dayMonth(D)}`)).toBeVisible();
    // the week link from the calendar returns to this week
    await page.getByRole('link', { name: '‹ Неделя' }).click();
    await expect(page).toHaveURL(/#\/week\/0$/);
  });

  // fixed (was a bug): the week screen's calendar button links to the week's Monday (#/calendar/<monday>), so when the week
  // started in the previous month (e.g. Wednesday 2 December, week from 30 November) the calendar opens on the
  // previous month with Monday selected instead of today. src/screens/Week.tsx (WeekHeader href).
  test('calendar button on the week opens the current month with today selected', async ({ page }) => {
    const u = await registerUser();
    await createProgram(u.token, { name: 'Любая', weeks: 8, days: { 0: [{ name: 'Жим штанги лёжа', sets: 3, reps: '10', kg: '' }] } }); // not the empty week
    await login(page, u.token);
    await page.clock.setFixedTime(new Date('2026-12-02T10:00:00Z'));
    await open(page, 'week');
    await page.getByRole('link', { name: 'Календарь' }).click();
    await expect(page.getByRole('heading', { name: 'Декабрь 2026' })).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Сегодня, 2 декабря')).toBeVisible();
  });
});
void weekStart;
