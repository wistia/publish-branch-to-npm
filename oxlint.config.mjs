import { javascriptConfig, nodeConfig, vitestConfig, vitestRules } from '@wistia/oxlint-config';
import { defineConfig } from 'oxlint';

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  ignorePatterns: ['node_modules/**', 'dist/**', 'coverage/**'],

  extends: [javascriptConfig, nodeConfig, vitestConfig],

  overrides: [
    // The shared vitest config only matches `.js`/`.ts` test files, so apply
    // the vitest rules to this repo's `.test.mjs` files as well.
    {
      files: ['**/*.test.mjs'],
      plugins: vitestRules.plugins,
      jsPlugins: vitestRules.jsPlugins,
      rules: vitestRules.rules,
    },
  ],
});
