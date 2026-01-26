/* eslint-disable import/no-unresolved */
import { defineConfig } from 'eslint/config';
import wistiaBaseConfig from '@wistia/eslint-config/javascript';
import wistiaNodeConfig from '@wistia/eslint-config/node';
import wistiaVitestConfig from '@wistia/eslint-config/vitest';

// eslint-disable-next-line import/no-default-export
export default defineConfig([
  {
    // list of files to ignore
    ignores: [
      // dependencies
      '**/node_modules/**',

      // build directories
      '**/dist/**',
    ],
  },

  // Node files
  {
    files: ['**/*.mjs'],
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.mjs', '.json'],
        },
      },
    },
    extends: [wistiaBaseConfig, wistiaNodeConfig],
  },

  // Test files configuration
  {
    files: ['**/*.test.mjs'],
    extends: [wistiaVitestConfig],
  },
]);
