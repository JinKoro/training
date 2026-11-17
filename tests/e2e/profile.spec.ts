import { test, expect, open, sheet, toast, fmt, call, registerUser, login } from './fixtures';
import { kcal, suggestNorms } from '../../src/lib/calc';

test.describe('Profile', () => {
  test('changing the weight offers «Пересчитать калории?» with old → new, and recalculates', async ({ authed: page, user }) => {
    await open(page, 'profile');
    await expect(page.getByRole('link', { name: /Тренировочный день/ })).toContainText(`${fmt(kcal(user.norms.training!))} ккал`);
    await page.getByRole('link', { name: /Данные и замеры/ }).click();
    // the figure view first (numbers on the sign-up silhouette), «Изменить» opens the form
    await expect(page.getByText('80 кг').first()).toBeVisible();
    await expect(page.getByText('20 %').first()).toBeVisible();
    await page.getByRole('link', { name: 'Изменить' }).click();
    await expect(page.getByLabel('Вес, кг')).toHaveValue('80');
    await expect(page.getByLabel('Или свой процент')).toHaveValue('20');

    await page.getByLabel('Вес, кг').fill('8o');
    await expect(page.getByText('Только число, например 82,5')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    await page.getByLabel('Вес, кг').fill('86,5');
    await page.getByLabel('Шаги в день').fill('12000');
    await page.getByRole('button', { name: 'Сохранить' }).click();

    const want = suggestNorms({ sex: 'm', weight: 86.5, bodyFat: 20, steps: 12000, trainingMode: 'time', trainingMin: 60, trainingKcal: 0 }, 'keep');
    const s = sheet(page, 'Пересчитать калории?');
    await expect(s).toBeVisible();
    const tRow = s.locator('.between', { hasText: 'День тренировки' });
    await expect(tRow).toContainText(fmt(kcal(user.norms.training!)));
    await expect(tRow).toContainText(fmt(kcal(want.training!)));
    const rRow = s.locator('.between', { hasText: 'День отдыха' });
    await expect(rRow).toContainText(fmt(kcal(user.norms.rest)));
    await expect(rRow).toContainText(fmt(kcal(want.rest)));
    await s.getByRole('button', { name: 'Пересчитать' }).click();
    await expect(toast(page)).toHaveText('Калории пересчитаны');
    await expect(page).toHaveURL(/#\/profile\/body$/);
    await expect(page.getByText('86,5 кг').first()).toBeVisible();
    await page.getByRole('link', { name: '‹ Профиль' }).click();
    await expect(page.getByRole('link', { name: /Тренировочный день/ })).toContainText(`${fmt(kcal(want.training!))} ккал`);
    await expect(page.getByRole('link', { name: /День отдыха/ })).toContainText(`${fmt(kcal(want.rest))} ккал`);

    // the new data is kept
    await page.getByRole('link', { name: /Данные и замеры/ }).click();
    await page.getByRole('link', { name: 'Изменить' }).click();
    await expect(page.getByLabel('Вес, кг')).toHaveValue('86,5');
    await expect(page.getByLabel('Шаги в день')).toHaveValue('12000');
  });

  test('«Не сейчас» keeps the norms; a body-fat change also offers; a name change alone does not', async ({ authed: page, user }) => {
    await open(page, 'profile/edit');
    await page.getByLabel('Или свой процент').fill('15');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(sheet(page, 'Пересчитать калории?')).toBeVisible();
    await sheet(page, 'Пересчитать калории?').getByRole('button', { name: 'Не сейчас' }).click();
    await expect(page).toHaveURL(/#\/profile\/body$/);
    await page.getByRole('link', { name: '‹ Профиль' }).click();
    await expect(page.getByRole('link', { name: /День отдыха/ })).toContainText(`${fmt(kcal(user.norms.rest))} ккал`);

    await page.getByRole('link', { name: /Данные и замеры/ }).click();
    await page.getByRole('link', { name: 'Изменить' }).click();
    await expect(page.getByLabel('Или свой процент')).toHaveValue('15');
    // picking a figure sets its percent and lights it up
    await page.getByRole('button', { name: '25 процентов' }).click();
    await expect(page.getByLabel('Или свой процент')).toHaveValue('25');
    await expect(page.getByRole('button', { name: '25 процентов' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByLabel('Или свой процент').fill('15');
    await page.getByLabel('Имя').fill('');
    await expect(page.getByText('Как вас зовут?')).toBeVisible();
    await page.getByLabel('Имя').fill('Борис');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page).toHaveURL(/#\/profile\/body$/);
    await expect(sheet(page)).toHaveCount(0);
    await expect(page.locator('.display', { hasText: 'Борис' })).toBeVisible();
  });

  test('norms screen: edit, week budget, clear the training-day norm', async ({ authed: page, user }) => {
    await open(page, 'profile/norms');
    await expect(page.getByRole('heading', { name: 'План питания' })).toBeVisible();
    const rest = page.locator('.card', { hasText: 'День отдыха' });
    await expect(rest).toContainText(`${fmt(kcal(user.norms.rest))} ккал`);
    await page.locator('#nm-rest-0').fill('100');
    const newRest = kcal([100, user.norms.rest[1], user.norms.rest[2]]);
    await expect(rest).toContainText(`${fmt(newRest)} ккал`);
    // no program: all 7 days are ordinary days
    await expect(page.getByText('Тренировок в плане нет, все 7 дней обычные.')).toBeVisible();
    await expect(page.getByText(`${fmt(newRest * 7)} ккал`)).toBeVisible();

    await page.locator('#nm-rest-1').fill('');
    await expect(page.locator('#nm-rest-1')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    await page.locator('#nm-rest-1').fill('70');

    for (const i of [0, 1, 2]) await page.locator(`#nm-training-${i}`).fill('');
    await expect(page.locator('.card', { hasText: 'День тренировки' })).toContainText('Не задано');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page).toHaveURL(/#\/profile$/);
    await expect(page.getByRole('link', { name: /Обычный день/ })).toContainText(`${fmt(newRest)} ккал`);
    await expect(page.getByRole('link', { name: /День тренировки/ })).toContainText('Не задано');
  });

  test('password change: wrong current password, then a new one works', async ({ authed: page, user, allowErrors }) => {
    allowErrors(/http 400 POST \/api\/me\/password|status of 400/);
    await open(page, 'profile');
    await page.getByRole('link', { name: /Пароль/ }).click();
    await page.getByLabel('Текущий пароль').fill('nope-nope');
    await page.getByLabel('Новый пароль', { exact: true }).fill('short');
    await expect(page.getByText('Не меньше 8 символов')).toBeVisible();
    await page.getByLabel('Новый пароль', { exact: true }).fill('new-password-1');
    await page.getByLabel('Новый пароль ещё раз').fill('new-password-2');
    await expect(page.getByText('Пароли не совпадают')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    await page.getByLabel('Новый пароль ещё раз').fill('new-password-1');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByText('Неверный пароль')).toBeVisible();
    await page.getByLabel('Текущий пароль').fill(user.password);
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(toast(page)).toHaveText('Пароль изменён');
    await expect(page).toHaveURL(/#\/profile$/);
    const { token } = await call(null, 'POST', '/auth/login', { email: user.email, password: 'new-password-1' });
    expect(token).toBeTruthy();
  });

  test('theme choice is saved to the account', async ({ authed: page }) => {
    await open(page, 'profile');
    // the light theme is the default for a new account
    await expect(page.getByRole('button', { name: 'Светлая' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    // fixed (was a bug): the picked tile's ring waited for the account request (≈1 s on a phone) while the theme switched at once
    await page.route('**/api/me', async (r) => { if (r.request().method() === 'PATCH') await new Promise((x) => setTimeout(x, 2000)); await r.continue(); });
    const saved = page.waitForResponse((r) => r.url().endsWith('/api/me') && r.request().method() === 'PATCH');
    const reread = page.waitForResponse((r) => r.url().endsWith('/api/me') && r.request().method() === 'GET');
    await page.getByRole('button', { name: 'Тёмная' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('button', { name: 'Тёмная' })).toHaveAttribute('aria-pressed', 'true', { timeout: 300 });
    await expect(page.getByRole('button', { name: 'Светлая' })).toHaveAttribute('aria-pressed', 'false', { timeout: 300 });
    await saved; await reread; // the account copy is re-read after saving
    await page.evaluate(() => localStorage.removeItem('podhod-theme'));
    await page.reload();
    await expect(page.getByRole('button', { name: 'Тёмная' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('«Пересчитать по формуле» walks the three steps and saves new norms', async ({ page }) => {
    const u = await registerUser({ sex: 'f', weight: 60, bodyFat: 25, steps: 6000 });
    await login(page, u.token);
    await open(page, 'profile/norms');
    await page.getByRole('link', { name: 'Пересчитать по формуле' }).click();
    await expect(page.getByText('Шаг 1 из 3')).toBeVisible();
    await expect(page.getByLabel('Вес, кг')).toHaveValue('60');
    await expect(page.getByRole('button', { name: 'Женщина' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByLabel('Вес, кг').fill('58');
    await page.getByRole('button', { name: 'Дальше' }).click();
    await expect(page.getByText('Шаг 2 из 3')).toBeVisible();
    await expect(page.getByLabel('Мой процент')).toHaveValue('25');
    await page.getByRole('button', { name: 'Дальше' }).click();
    await page.getByRole('button', { name: 'Нет' }).click(); // no training
    await page.getByRole('button', { name: 'Набрать' }).click();
    const want = suggestNorms({ sex: 'f', weight: 58, bodyFat: 25, steps: 6000, trainingMode: 'none', trainingMin: 0, trainingKcal: 0 }, 'gain');
    expect(want.training).toBeNull();
    await expect(page.getByText(`${fmt(kcal(want.rest))} ккал`, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page).toHaveURL(/#\/profile\/norms/);
    await expect(page.locator('.card', { hasText: 'дни без тренировки' })).toContainText(`${fmt(kcal(want.rest))} ккал`);
    await expect(page.locator('.card', { hasText: 'если не задано' })).toContainText('Не задано');
  });
  test('body measurements: add, see the change, open the chart, edit and delete an entry', async ({ authed: page }) => {
    await open(page, 'profile/body');
    const card = page.locator('.card', { hasText: 'Замеры тела' });
    await expect(card.getByRole('link', { name: 'Вес' })).toContainText('80 кг'); // the sign-up weight
    await expect(card.getByRole('link', { name: 'Талия' })).toContainText('—');
    await card.getByRole('link', { name: 'Внести замеры' }).click();
    await expect(page.getByLabel('Вес, кг')).toHaveAttribute('placeholder', '80');
    await expect(page.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    await page.getByLabel('Талия').fill('5');
    await expect(page.getByText('От 10 до 250 см')).toBeVisible();
    await page.getByLabel('Талия').fill('84,5');
    await page.getByLabel('Вес, кг').fill('79');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(toast(page)).toHaveText('Замеры сохранены');
    await expect(page).toHaveURL(/#\/profile\/body$/);
    // one entry per date: today's weight replaces the sign-up one, and the figure follows it
    await expect(card.getByRole('link', { name: 'Вес' })).toContainText('79 кг');
    await expect(page.getByText('79 кг')).toHaveCount(2);
    // an older entry: the change is counted from it
    await card.getByRole('link', { name: 'Внести замеры' }).click();
    await page.getByRole('button', { name: 'Вчера' }).click();
    await page.getByLabel('Талия').fill('86');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(card.getByRole('link', { name: 'Талия' })).toContainText('84,5 см');
    await expect(card.getByRole('link', { name: 'Талия' })).toContainText('↓ 1,5');

    await card.getByRole('link', { name: 'Талия' }).click();
    await expect(page.getByRole('img', { name: 'Талия: 86, 84,5' })).toBeVisible();
    await expect(page.getByText('↓ 1,5 см за 3 месяца')).toBeVisible();
    await page.getByRole('button', { name: /^Запись/ }).last().click();
    await page.getByRole('button', { name: 'Удалить' }).click();
    await expect(toast(page)).toHaveText('Запись удалена');
    await expect(page.getByRole('img', { name: 'Талия: 84,5' })).toBeVisible();
    await page.getByRole('button', { name: /^Запись/ }).click();
    await page.getByRole('button', { name: 'Изменить' }).click();
    await page.getByLabel('Талия, см').fill('83');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(toast(page)).toHaveText('Сохранено');
    await expect(page.getByRole('img', { name: 'Талия: 83' })).toBeVisible();
    await page.getByRole('button', { name: /^Запись/ }).click();
    await page.getByRole('button', { name: 'Удалить' }).click();
    await expect(page.getByText('Записей пока нет')).toBeVisible();
  });
});
