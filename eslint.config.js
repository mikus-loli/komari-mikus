import globals from 'globals';

export default [
  {
    files: ['dist/assets/js/**/*.js'],
    ignores: ['dist/assets/js/sakura.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser
      }
    },
    rules: {
      'no-var': 'error',
      'prefer-const': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'eqeqeq': ['warn', 'smart'],
      'no-undef': 'off',
      'curly': ['warn', 'multi-line'],
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-empty': 'warn',
      'no-redeclare': 'error'
    }
  }
];
