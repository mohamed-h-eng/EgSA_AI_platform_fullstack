import js from '@eslint/js'
import boundaries from 'eslint-plugin-boundaries'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const el = (type) => ({ element: { type } })

/** Another feature may be imported ONLY through its public index.ts. */
const featureIndex = {
  to: { element: { type: 'feature' }, file: { path: '**/features/*/index.ts' } },
}

export default defineConfig([
  globalIgnores(['dist', 'coverage']),

  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
  },

  // shadcn/ui files export variants/helpers next to components.
  {
    files: ['src/shared/ui/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  /*
   * Feature-scoped architecture (.agent/rules/frontend-architecture.md):
   *   app → features/<x>/index.ts → shared  (src/main.tsx is the bootstrap file, not an element)
   *   - a feature may import another feature ONLY through its index.ts
   *   - shared never imports features or app
   */
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': {
        typescript: { alwaysTryTypes: true, project: './tsconfig.app.json' },
      },
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app' },
        { type: 'feature', pattern: 'src/features/*', capture: ['feature'] },
        { type: 'shared', pattern: 'src/shared' },
        { type: 'styles', pattern: 'src/styles' },
        { type: 'test', pattern: 'src/test' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            // Files inside the same element (e.g. within one feature) may import each other freely.
            { allow: [{ dependency: { relationship: { to: 'internal' } } }] },
            {
              from: el('app'),
              allow: [{ to: el('app') }, { to: el('shared') }, { to: el('styles') }, featureIndex],
            },
            { from: el('feature'), allow: [{ to: el('shared') }, featureIndex] },
            { from: el('shared'), allow: [{ to: el('shared') }] },
            { from: el('test'), allow: [{ to: el('test') }, { to: el('shared') }] },
            // Test files anywhere may use the shared test helpers in src/test.
            { from: { file: { path: '**/__tests__/**' } }, allow: [{ to: el('test') }] },
          ],
        },
      ],
    },
  },
])
