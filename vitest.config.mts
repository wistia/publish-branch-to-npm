import { defineConfig } from 'vitest/config'; // eslint-disable-line import/no-extraneous-dependencies

// eslint-disable-next-line import/no-default-export
export default defineConfig({
  test: {
    include: ['src/*.test.mjs'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json'],
      reportOnFailure: true,
      include: ['src'],
    },
  },
});
