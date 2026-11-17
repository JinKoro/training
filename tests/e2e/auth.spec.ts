import { test, expect, registerUser, login, open, tab, fmt } from './fixtures';
import { energy, suggestNorms, kcal } from '../../src/lib/calc';

test.describe('Registration wizard', () => {
  test('all four steps with validation, then the week screen and the profile', async ({ page }) => {
    await open(page, 'login');
    await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();
    await page.getByRole('link', { name: 'Зарегистрироваться' }).click();
    await expect(page).toHaveURL(/#\/register/);
    await expect(page.getByText('Шаг 1 из 4')).toBeVisible();

    const create = page.getByRole('button', { name: 'Создать аккаунт' });
    await expect(create).toBeDisabled();

    // Step 1: messages appear for touched fields only.
    const name = page.getByLabel('Имя');
    await name.fill('Аня');
    await name.fill('');
    await expect(page.getByText('Как вас зовут?')).toBeVisible();
    await name.fill('Аня');
    await expect(page.getByText('Как вас зовут?')).toBeHidden();

    const email = page.getByLabel('Почта');
    await email.fill('anya@');
    await expect(page.getByText('Похоже, в почте опечатка')).toBeVisible();
    const addr = `reg-${Date.now()}@test.dev`;
    await email.fill(addr);
    await expect(page.getByText('Похоже, в почте опечатка')).toBeHidden();

    await page.getByLabel('Пароль', { exact: true }).fill('short');
    await expect(page.getByText('Не меньше 8 символов')).toBeVisible();
    await page.getByLabel('Пароль', { exact: true }).fill('password123');
    await page.getByLabel('Пароль ещё раз').fill('password12');
    await expect(page.getByText('Пароли не совпадают')).toBeVisible();
    await expect(create).toBeDisabled();
    await page.getByLabel('Пароль ещё раз').fill('password123');
    await expect(create).toBeEnabled();
    await create.click();

    // The account exists right after step 1; the body steps only fill the profile (no way back to step 1).
    await expect(page.getByText('Шаг 2 из 4')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('podhod-token'))).toBeTruthy();
    await expect(page.getByRole('button', { name: '‹ Назад' })).toHaveCount(0);

    // Step 2: «О себе»
    await expect(page.getByRole('heading', { name: 'О себе' })).toBeVisible();
    await page.getByRole('button', { name: 'Женщина' }).click();
    await expect(page.getByRole('button', { name: 'Женщина' })).toHaveAttribute('aria-pressed', 'true');
    const birth = page.getByLabel('Дата рождения');
    await birth.pressSequentially('31022000');
    await expect(birth).toHaveValue('31.02.2000'); // mask
    await expect(page.getByText('Формат ДД.ММ.ГГГГ')).toBeVisible();
    await birth.fill('');
    await birth.pressSequentially('01012099');
    await expect(page.getByText('Вы ещё не родились')).toBeVisible();
    await birth.fill('');
    await birth.pressSequentially('15051990');
    await expect(page.getByText(/^3\d (год|года|лет)$/)).toBeVisible(); // age hint
    await page.getByLabel('Вес, кг').fill('20');
    await expect(page.getByText('Меньше 30 кг? Проверьте вес')).toBeVisible();
    await page.getByLabel('Вес, кг').fill('62,5');
    await page.getByLabel('Рост, см').fill('50');
    await expect(page.getByText('Меньше 100 см? Проверьте рост')).toBeVisible();
    await page.getByLabel('Рост, см').fill('168');
    await page.getByRole('button', { name: 'Дальше' }).click();

    // Step 3: body fat — a figure sets the field, the field highlights the nearest figure.
    await expect(page.getByText('Шаг 3 из 4')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Дальше' })).toBeDisabled();
    await page.getByRole('button', { name: '25 процентов' }).click();
    await expect(page.getByLabel('Мой процент')).toHaveValue('25');
    await expect(page.getByRole('button', { name: '25 процентов' })).toHaveAttribute('aria-pressed', 'true');
    // lean mass 62.5 * 0.75 = 46.9
    await expect(page.getByText('46,9 кг')).toBeVisible();
    await page.getByLabel('Мой процент').fill('70');
    await expect(page.getByText('Больше 60 %? Проверьте')).toBeVisible();
    await page.getByLabel('Мой процент').fill('27');
    await expect(page.getByRole('button', { name: '25 процентов' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Дальше' }).click();

    // Step 4: expenditure and suggested calories follow the formula.
    await expect(page.getByText('Шаг 4 из 4')).toBeVisible();
    await page.getByLabel('Шагов в день').fill('abc');
    await expect(page.getByText('Только целое число')).toBeVisible();
    await page.getByLabel('Шагов в день').fill('9000');
    await page.getByLabel('Минут за тренировку').fill('45');
    await page.getByRole('button', { name: 'Похудеть' }).click();
    const input = { sex: 'f' as const, weight: 62.5, bodyFat: 27, steps: 9000, trainingMode: 'time' as const, trainingMin: 45, trainingKcal: 0 };
    const en = energy(input);
    const norms = suggestNorms(input, 'lose');
    const card = page.locator('.card', { hasText: 'Расход в день' });
    await expect(card.getByText(fmt(en.bmr), { exact: true })).toBeVisible();
    await expect(card.getByText(`+${fmt(en.training)}`, { exact: true })).toBeVisible();
    const offer = page.locator('div', { hasText: /^Предлагаемые калории/ }).last();
    await expect(page.getByText(`${fmt(kcal(norms.training!))} ккал`, { exact: true })).toBeVisible();
    await expect(page.getByText(`${fmt(kcal(norms.rest))} ккал`, { exact: true })).toBeVisible();
    void offer;

    await expect(page.getByText(/Расчёт примерный.*не медицинская рекомендация/)).toBeVisible();

    // Back keeps the body data.
    await page.getByRole('button', { name: '‹ Назад' }).click();
    await page.getByRole('button', { name: '‹ Назад' }).click();
    await expect(page.getByText('Шаг 2 из 4')).toBeVisible();
    await expect(page.getByLabel('Вес, кг')).toHaveValue('62,5');
    await page.getByRole('button', { name: 'Дальше' }).click();
    await page.getByRole('button', { name: 'Дальше' }).click();
    await page.getByRole('button', { name: 'Готово' }).click();

    // Signed in: empty week, then the profile shows what was entered.
    await expect(page).toHaveURL(/#\/week/);
    await expect(page.getByText('Плана тренировок пока нет')).toBeVisible();
    await tab(page, 'Профиль').click();
    await expect(page.getByText(addr)).toBeVisible();
    await expect(page.locator('.display', { hasText: 'Аня' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Тренировочный день/ })).toContainText(`${fmt(kcal(norms.training!))} ккал`);
    await expect(page.getByRole('link', { name: /День отдыха/ })).toContainText(`${fmt(kcal(norms.rest))} ккал`);
    // a woman sees the women's ready-made programs
    await tab(page, 'Спорт').click();
    await expect(page.getByRole('link', { name: /Fullbody/ })).toHaveCount(3);
  });

  test('an e-mail that is taken is refused on step 1', async ({ page, allowErrors }) => {
    allowErrors(/http 409 POST \/api\/auth\/register|status of 409/);
    const existing = await registerUser();
    await open(page, 'register');
    await page.getByLabel('Имя').fill('Пётр');
    await page.getByLabel('Почта').fill(existing.email);
    await page.getByLabel('Пароль', { exact: true }).fill('password123');
    await page.getByLabel('Пароль ещё раз').fill('password123');
    await page.getByRole('button', { name: 'Создать аккаунт' }).click();
    await expect(page.getByText('Эта почта уже занята')).toBeVisible();
    await expect(page.getByText('Шаг 1 из 4')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Создать аккаунт' })).toBeDisabled();
  });

  const step1 = async (page: import('@playwright/test').Page) => {
    await open(page, 'register');
    await page.getByLabel('Имя').fill('Олег');
    await page.getByLabel('Почта').fill(`skip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.dev`);
    await page.getByLabel('Пароль', { exact: true }).fill('password123');
    await page.getByLabel('Пароль ещё раз').fill('password123');
    await page.getByRole('button', { name: 'Создать аккаунт' }).click();
    await expect(page.getByText('Шаг 2 из 4')).toBeVisible();
  };

  test('«Пропустить» on «О себе» skips everything: no calories, the week and food show what was eaten only', async ({ page }) => {
    await step1(page);
    await page.getByRole('button', { name: 'Пропустить', exact: true }).click();
    await expect(page).toHaveURL(/#\/week/);
    await expect(page.getByText('План калорий не задан')).toBeVisible();
    await expect(page.getByText('Бюджет на неделю')).toHaveCount(0);
    await tab(page, 'Еда').click();
    await expect(page.getByText('План калорий не задан')).toBeVisible();
    await expect(page.getByText('Съедено за день')).toBeVisible();
    await expect(page.getByText(/Осталось/)).toHaveCount(0);
    await tab(page, 'Профиль').click();
    await expect(page.getByRole('link', { name: /Калории в день/ })).toContainText('Рассчитать');
    // «Рассчитать» opens the calculation: after it the calories are set
    await page.getByRole('link', { name: /Калории в день/ }).click();
    await page.getByRole('button', { name: 'Мужчина' }).click();
    await page.getByLabel('Дата рождения').pressSequentially('01011990');
    await page.getByLabel('Вес, кг').fill('80');
    await page.getByLabel('Рост, см').fill('180');
    await page.getByRole('button', { name: 'Дальше' }).click();
    await page.getByLabel('Мой процент').fill('18');
    await page.getByRole('button', { name: 'Дальше' }).click();
    await page.getByLabel('Шагов в день').fill('8000');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page).toHaveURL(/#\/profile\/norms/);
    await open(page, 'food');
    await expect(page.getByText(/Осталось \d/)).toBeVisible();
    await expect(page.getByText('План калорий не задан')).toHaveCount(0);
  });

  test('«Пропустить» on «Процент жира» keeps step 2; on «Расход и план» keeps the body fat too', async ({ page }) => {
    await step1(page);
    await page.getByRole('button', { name: 'Женщина' }).click();
    await page.getByLabel('Дата рождения').pressSequentially('01011995');
    await page.getByLabel('Вес, кг').fill('58');
    await page.getByLabel('Рост, см').fill('165');
    await page.getByRole('button', { name: 'Дальше' }).click();
    await expect(page.getByText(/^Сколько в теле жира/)).toBeVisible();
    await page.getByRole('button', { name: 'Пропустить', exact: true }).click();
    await expect(page).toHaveURL(/#\/week/);
    await open(page, 'profile/body');
    await expect(page.getByText('58 кг')).toBeVisible();
    await expect(page.getByText('165')).toBeVisible();
    await expect(page.getByText('Женщина · 31 год')).toBeVisible();

    await page.evaluate(() => localStorage.removeItem('podhod-token'));
    await page.reload();
    await step1(page);
    await page.getByLabel('Дата рождения').pressSequentially('01011990');
    await page.getByLabel('Вес, кг').fill('90');
    await page.getByLabel('Рост, см').fill('185');
    await page.getByRole('button', { name: 'Дальше' }).click();
    await page.getByLabel('Мой процент').fill('22');
    await page.getByRole('button', { name: 'Дальше' }).click();
    await expect(page.getByRole('heading', { name: 'Расход и план' })).toBeVisible();
    await expect(page.getByText('в среднем за обычный день')).toBeVisible();
    await page.getByRole('button', { name: 'Пропустить расчёт' }).click();
    await expect(page).toHaveURL(/#\/week/);
    await expect(page.getByText('План калорий не задан')).toBeVisible();
    await open(page, 'profile/body');
    await expect(page.getByText('22 %')).toBeVisible();
  });
});

test.describe('Login / logout', () => {
  test('logout, wrong password, then login', async ({ page, user, allowErrors }) => {
    allowErrors(/http 401 POST \/api\/auth\/login|status of 401/);
    await login(page, user.token);
    await open(page, 'profile');
    await expect(page.getByText(user.email)).toBeVisible();
    await page.getByRole('button', { name: 'Выйти' }).click();
    await expect(page).toHaveURL(/#\/login/);
    await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('podhod-token'))).toBeNull();

    const btn = page.getByRole('button', { name: 'Войти' });
    await expect(btn).toBeDisabled();
    await page.getByLabel('Почта').fill(user.email);
    await page.getByLabel('Пароль', { exact: true }).fill('wrong-password');
    await btn.click();
    await expect(page.getByText('Неверная почта или пароль')).toBeVisible();
    // The eye shows and hides the password.
    const pass = page.getByLabel('Пароль', { exact: true });
    await expect(pass).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Показать пароль' }).click();
    await expect(pass).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Скрыть пароль' }).click();
    await expect(pass).toHaveAttribute('type', 'password');
    await expect(page.getByLabel('Пароль', { exact: true })).toHaveAttribute('aria-invalid', 'true');

    await page.getByLabel('Пароль', { exact: true }).fill(user.password);
    // e-mail case and spaces do not matter
    await page.getByLabel('Почта').fill(`  ${user.email.toUpperCase()}  `);
    await btn.click();
    await expect(page).toHaveURL(/#\/week/);
    await expect(tab(page, 'Неделя')).toHaveAttribute('aria-current', 'page');
  });

  test('an expired session goes back to the login screen', async ({ page, user, allowErrors }) => {
    allowErrors(/401/);
    await login(page, user.token);
    await open(page, 'week');
    await expect(tab(page, 'Неделя')).toBeVisible();
    await page.evaluate(() => localStorage.setItem('podhod-token', 'deadbeef'));
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();
  });
});

test.describe('Delete the account', () => {
  test('wrong password is refused; the right one deletes the account and signs out', async ({ page, user, allowErrors }) => {
    allowErrors(/http 400 DELETE \/api\/me|status of 400|http 401|status of 401/);
    await login(page, user.token);
    await open(page, 'profile');
    await page.getByRole('link', { name: /Удалить аккаунт/ }).click();
    await expect(page.getByText('Удалится навсегда')).toBeVisible();
    await expect(page.getByText(/Продукты, которые вы добавили в общую библиотеку/)).toBeVisible();
    const del = page.getByRole('button', { name: 'Удалить аккаунт навсегда' });
    await expect(del).toBeDisabled();
    await page.getByLabel('Пароль для подтверждения').fill('wrong-password');
    await del.click();
    await expect(page.getByText('Неверный пароль')).toBeVisible();
    await page.getByLabel('Пароль для подтверждения').fill(user.password);
    await del.click();
    await expect(page).toHaveURL(/#\/login/);
    await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('podhod-token'))).toBeNull();
  });
});
