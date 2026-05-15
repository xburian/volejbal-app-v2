import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  // Global ignores
  { ignores: ['dist/**', 'dist-api/**', 'node_modules/**'] },

  // Base JS recommended
  js.configs.recommended,

  // TypeScript recommended (type-aware disabled for speed)
  ...tseslint.configs.recommended,

  // Main source files
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // ── Unused code detection ──
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
      'no-unused-vars': 'off', // defer to TS version

      // ── React hooks ──
      ...reactHooks.configs.recommended.rules,
      // Data loading in useEffect is a standard pattern — disable this rule
      'react-hooks/set-state-in-effect': 'off',

      // ── React Refresh ──
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // ── Relaxed rules for this project ──
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },

  // services/storage.ts — useApi() is a regular function, not a hook
  {
    files: ['services/storage.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },

  // Test files — relax some rules
  {
    files: ['**/*.test.{ts,tsx}', 'setupTests.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
);


