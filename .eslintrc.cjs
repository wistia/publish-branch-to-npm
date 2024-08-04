module.exports = {
  extends: ['@wistia/eslint-config',
        '@wistia/eslint-config/node',
        '@wistia/eslint-config/prettier',],
  env: {
    node: true,
  },
  reportUnusedDisableDirectives: true,
  parserOptions: {
    ecmaVersion: 2022,
    requireConfigFile: false,
    sourceType: 'module',
  },
  rules: {
    'import/extensions': ['error', 'always'],
    'import/no-unused-modules': 'off',
  },
  overrides: [
    // test files
    {
      files: ['*.test.mjs'],
      rules: {
        'id-length': ['error', { exceptions: ['t'] }],
      },
    },
  ],
};
