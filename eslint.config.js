import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const ALLOWED_MATH = 'abs|min|max|sign|trunc|imul';

export default defineConfig(
  { ignores: ['**/dist/**', '**/dev-dist/**', '**/node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['packages/game/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['tools/**/*.{ts,mjs,js}', '*.config.{ts,js}', 'packages/*/vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // Regeln für den Sim-Kern (Solo-Testversion, „Regeln für den Sim-Kern“):
    // nur ganze Zahlen, Division nur über idiv(), keine Uhr, kein Zufall, feste Reihenfolge.
    files: ['packages/sim/src/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: "BinaryExpression[operator='/']", message: 'Division nur über idiv(a, b).' },
        { selector: "AssignmentExpression[operator='/=']", message: 'Division nur über idiv(a, b).' },
        {
          selector: `MemberExpression[object.name='Math'][property.name!=/^(${ALLOWED_MATH})$/]`,
          message: 'Im Sim-Kern sind nur Math.abs, min, max, sign, trunc und imul erlaubt.',
        },
        { selector: 'Literal[raw=/^[0-9]*\\.[0-9]/]', message: 'Im Sim-Kern gibt es nur ganze Zahlen.' },
        { selector: 'ForInStatement', message: 'Iteration nur über Arrays in fester Reihenfolge.' },
        {
          selector: "NewExpression[callee.name=/^(Map|Set|WeakMap|WeakSet)$/]",
          message: 'Iteration nur über Arrays in fester Reihenfolge.',
        },
        {
          selector: "CallExpression[callee.object.name='Object'][callee.property.name=/^(keys|values|entries)$/]",
          message: 'Iteration nur über Arrays in fester Reihenfolge.',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Keine Uhrzeit im Sim-Kern.' },
        { name: 'performance', message: 'Keine Uhrzeit im Sim-Kern.' },
        { name: 'window', message: 'Der Sim-Kern kennt kein DOM.' },
        { name: 'document', message: 'Der Sim-Kern kennt kein DOM.' },
        { name: 'crypto', message: 'Kein Zufall im Sim-Kern.' },
      ],
    },
  },
);
