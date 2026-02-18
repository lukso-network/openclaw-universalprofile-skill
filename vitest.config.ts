import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['skill/tests/**/*.test.ts'],
    globals: true,
  },
});
