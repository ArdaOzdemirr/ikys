// @ts-check
const tseslint = require('typescript-eslint');
const reactHooks = require('eslint-plugin-react-hooks');
const reactRefresh = require('eslint-plugin-react-refresh').default;
const globals = require('globals');

module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Not: eslint-plugin-react-hooks v7'nin "recommended" seti React Compiler'a
      // yönelik çok daha sıkı kurallar içeriyor (set-state-in-effect, purity, vb.).
      // Bu proje React Compiler kullanmıyor; sadece klasik/yerleşik iki kuralı alıyoruz.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Sayfa/komponentlerde Prisma/axios yanıtları sıkça `any` ile tutuluyor;
      // hata yerine kapalı tutuyoruz.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
);
