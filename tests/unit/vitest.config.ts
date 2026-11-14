import { defineConfig } from 'vitest/config';

process.env.TZ = 'Europe/Berlin'; // has DST: date math must not drift across the switch

export default defineConfig({
  test: {
    root: new URL('../..', import.meta.url).pathname,
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
