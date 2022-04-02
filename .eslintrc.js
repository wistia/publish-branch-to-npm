module.exports = {
  extends: ['@wistia/eslint-config/base'],
  env: {
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    requireConfigFile: false,
    sourceType: 'module',
  },
  rules: {
    'import/extensions': ['error', 'always'],
  },
};
