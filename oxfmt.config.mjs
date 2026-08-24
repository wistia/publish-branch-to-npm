import { oxfmtConfig } from '@wistia/oxlint-config/oxfmtConfig';
import { defineConfig } from 'oxfmt';

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  ...oxfmtConfig,
  ignorePatterns: ['node_modules/**', 'dist/**', 'coverage/**'],
});
