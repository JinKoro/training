import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: new URL('../..', import.meta.url).pathname,
    include: ['tests/api/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['tests/api/globalSetup.ts'],
    // One wrangler dev instance shared by all files; files run one after another to keep D1 load predictable.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
