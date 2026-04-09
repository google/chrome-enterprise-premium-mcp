import js from '@eslint/js'
import nodePlugin from 'eslint-plugin-n'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'

export default [
  {
    ignores: ['**/dist', '**/node_modules', 'results/**'],
  },
  js.configs.recommended,
  nodePlugin.configs['flat/recommended'],
  eslintPluginPrettierRecommended,
  {
    rules: {
      // -- Formatting & style --
      curly: 'error',
      'prettier/prettier': 'error',
      'no-extra-semi': 'off',

      // -- Variable hygiene --
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      'no-use-before-define': 'off',

      // -- Bug prevention --
      eqeqeq: ['error', 'always'],
      'no-constant-binary-expression': 'error',
      'no-constructor-return': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'warn',
      'no-unmodified-loop-condition': 'error',
      'no-unreachable-loop': 'error',
      'no-unused-private-class-members': 'error',
      'no-throw-literal': 'error',
      'no-implied-eval': 'error',

      // -- Async/Promise safety --
      'no-async-promise-executor': 'error',
      'no-await-in-loop': 'off',
      'no-promise-executor-return': 'error',
      'prefer-promise-reject-errors': 'error',
      'require-atomic-updates': 'error',

      // -- Commit guards --
      'no-warning-comments': [
        'error',
        {
          terms: ['nocommit', '@nocommit', '@no-commit'],
        },
      ],

      // -- Node.js plugin overrides --
      'n/no-missing-import': 'off',
      'n/no-unpublished-import': 'off',
      'n/no-unsupported-features/node-builtins': ['error', { version: '>=18.0.0' }],
    },
  },
  {
    files: ['test/**/*.js', '**/*.test.js'],
    rules: {
      'n/no-unsupported-features/node-builtins': ['error', { version: '>=22.0.0' }],
    },
  },
]
