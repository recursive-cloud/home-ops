// eslint.config.mjs
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'

export default [
  {
    files: ['**/*.ts'],

    languageOptions: {
      parser: tsparser,
      sourceType: 'module',
    },

    plugins: {
      '@typescript-eslint': tseslint,
    },

    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': 'error',
      'no-console': 'warn',
    },

    ignores: ['node_modules/', 'sdks/**'],
  },
]
