import { test, expect, open, fmt } from './fixtures';
import { kcal } from '../../src/lib/calc';

/**
 * The worker takes "today" from the X-Local-Date header and falls back to the UTC date; the app never sends the
 * header. Run the browser in a zone whose date differs from UTC right now (UTC+14 when it is already tomorrow
 * there, UTC−12 when it is still yesterday) and save norms "from today".
 */
const ahead = new Date().getUTCHours() >= 10; // +14 h crosses midnight
const tz = ahead ? 'Pacific/Kiritimati' : 'Etc/GMT+12';
const localDay = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86400000).toLocaleDateString('sv-SE', { timeZone: tz });

test.use({ timezoneId: tz });

// fixed (was a bug): src/lib/api.ts never sends X-Local-Date, so the worker (worker/src/api.js todayOf) dates norms, profile
// changes, a new program's start week and the «copy to today» check by the UTC day. Outside UTC, around midnight,
// norms saved "today" either start tomorrow (today still shows the old norm) or overwrite yesterday's.
test('norms saved today apply from the local today, not from the UTC date', async ({ authed: page, user }) => {
  expect(localDay()).not.toBe(new Date().toISOString().slice(0, 10)); // the setup really differs from UTC
  await open(page, 'profile/norms');
  await page.locator('#nm-rest-0').fill('100');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page).toHaveURL(/#\/profile$/);
  const newRest = kcal([100, user.norms.rest[1], user.norms.rest[2]]);
  // today uses the new norm
  await expect(page.getByRole('link', { name: /День отдыха/ })).toContainText(`${fmt(newRest)} ккал`, { timeout: 3000 });
  // yesterday keeps the old one
  await open(page, `food/${localDay(-1)}`);
  await expect(page.getByRole('img', { name: `Съедено 0 из ${kcal(user.norms.rest)} ккал` })).toBeVisible({ timeout: 3000 });
});
