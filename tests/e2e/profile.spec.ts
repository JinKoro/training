import { test, expect, open, sheet, toast, fmt, call, registerUser, login } from './fixtures';
import { kcal, suggestNorms } from '../../src/lib/calc';

test.describe('Profile', () => {
  test('changing the weight offers «Пересчитать калории?» with old → new, and recalculates', async ({ authed: page, user }) => {
    await open(page, 'profile');
    await expect(page.getByRole('link', { name: /Тренировочный день/ })).toContainText(`${fmt(kcal(user.norms.training!))} ккал`);
    await page.getByRole('link', { name: /Данные и замеры/ }).click();
    await expect(page.getByLabel('Вес, кг')).toHaveValue('80');
    await expect(page.getByLabel('Процент жира')).toHaveValue('20');

    await page.getByLabel('Вес, кг').fill('8o');
    await expect(page.getByText('Только число, например 82,5')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    await page.getByLabel('Вес, кг').fill('86,5');
    await page.getByLabel('Шагов в день, в среднем').fill('12000');
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
    await expect(page).toHaveURL(/#\/profile$/);
    await expect(page.getByRole('link', { name: /Тренировочный день/ })).toContainText(`${fmt(kcal(want.training!))} ккал`);
    await expect(page.getByRole('link', { name: /День отдыха/ })).toContainText(`${fmt(kcal(want.rest))} ккал`);

    // the new data is kept
    await page.getByRole('link', { name: /Данные и замеры/ }).click();
    await expect(page.getByLabel('Вес, кг')).toHaveValue('86,5');
    await expect(page.getByLabel('Шагов в день, в среднем')).toHaveValue('12000');
  });

  test('«Не сейчас» keeps the norms; a body-fat change also offers; a name change alone does not', async ({ authed: page, user }) => {
    await open(page, 'profile/edit');
    await page.getByLabel('Процент жира').fill('15');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(sheet(page, 'Пересчитать калории?')).toBeVisible();
    await sheet(page, 'Пересчитать калории?').getByRole('button', { name: 'Не сейчас' }).click();
    await expect(page).toHaveURL(/#\/profile$/);
    await expect(page.getByRole('link', { name: /День отдыха/ })).toContainText(`${fmt(kcal(user.norms.rest))} ккал`);

    await page.getByRole('link', { name: /Данные и замеры/ }).click();
    await expect(page.getByLabel('Процент жира')).toHaveValue('15');
    await page.getByLabel('Имя').fill('');
    await expect(page.getByText('Как вас зовут?')).toBeVisible();
    await page.getByLabel('Имя').fill('Борис');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page).toHaveURL(/#\/profile$/);
    await expect(sheet(page)).toHaveCount(0);
    await expect(page.locator('.display', { hasText: 'Борис' })).toBeVisible();
  });

  test('norms screen: edit, week budget, clear the training-day norm', async ({ authed: page, user }) => {
    await open(page, 'profile/norms');
    await expect(page.getByRole('heading', { name: 'Нормы питания' })).toBeVisible();
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
    await page.getByRole('button', { name: 'Светлая' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('button', { name: 'Светлая' })).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => localStorage.removeItem('podhod-theme'));
    await page.reload();
    await expect(page.getByRole('button', { name: 'Светлая' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
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
});
