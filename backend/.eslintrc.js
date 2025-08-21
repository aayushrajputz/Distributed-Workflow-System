module.exports = {
  env: {
    browser: false,
    commonjs: true,
    es6: true,
    node: true,
    jest: true,
  },
  extends: [
    'airbnb-base',
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  rules: {
    'no-console': 'off',
    'no-underscore-dangle': ['error', { allow: ['_id', '__v'] }],
    'consistent-return': 'off',
    'func-names': 'off',
    'object-shorthand': 'off',
    'no-process-exit': 'off',
    'no-param-reassign': 'off',
    'no-return-await': 'off',
    'no-unused-vars': ['error', { argsIgnorePattern: 'next' }],
    'class-methods-use-this': 'off',
  },
};
