// @ts-check
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'uploads/**', 'coverage/**'],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Nest/Prisma kod tabanında bilinçli `any` kullanımı yaygın (DTO'suz body'ler,
      // dinamik Prisma include sonuçları); bunu hata yerine kapalı tutuyoruz.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
);
