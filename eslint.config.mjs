/*
Copyright 2026 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/ import js from '@eslint/js'
import nodePlugin from 'eslint-plugin-n'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import jsdoc from 'eslint-plugin-jsdoc'
import notice from 'eslint-plugin-notice'

const currentYear = new Date().getFullYear()
const copyrightHeader = `/*
Copyright ${currentYear} Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/`

export default [
  {
    ignores: ['**/dist', '**/node_modules', 'results/**', '.worktrees/**'],
  },
  js.configs.recommended,
  nodePlugin.configs['flat/recommended'],
  eslintPluginPrettierRecommended,
  jsdoc.configs['flat/recommended'],
  {
    plugins: {
      notice,
    },
    rules: {
      // -- Google Standards --
      'notice/notice': [
        'error',
        {
          template: copyrightHeader,
          onNonMatching: 'replace',
        },
      ],

      // -- JSDoc --

      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: false,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
          contexts: ['ExportNamedDeclaration > FunctionDeclaration', 'ExportDefaultDeclaration > FunctionDeclaration'],
        },
      ],
      'jsdoc/check-alignment': 'error',
      'jsdoc/check-indentation': 'error',
      'jsdoc/check-param-names': 'error',
      'jsdoc/check-tag-names': 'error',
      'jsdoc/check-types': 'error',
      'jsdoc/valid-types': 'error',
      'jsdoc/require-description': 'error',
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-param-type': 'error',
      'jsdoc/require-returns': 'error',
      'jsdoc/require-returns-description': 'error',
      'jsdoc/require-returns-type': 'error',

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
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-description': 'off',
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-param-type': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/require-returns-description': 'off',
      'jsdoc/require-returns-type': 'off',
      'jsdoc/require-property-description': 'off',
      'jsdoc/check-alignment': 'off',
      'jsdoc/check-indentation': 'off',
      'jsdoc/check-param-names': 'off',
      'jsdoc/check-tag-names': 'off',
      'jsdoc/check-types': 'off',
      'jsdoc/valid-types': 'off',
      'n/no-unsupported-features/node-builtins': ['error', { version: '>=22.0.0' }],
    },
  },
]
