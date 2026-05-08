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
*/

import js from '@eslint/js'
import nodePlugin from 'eslint-plugin-n'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import jsdoc from 'eslint-plugin-jsdoc'
import notice from 'eslint-plugin-notice'
import tseslint from 'typescript-eslint'

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

// List of files that have been fully migrated to TypeScript and should be
// subject to strict, type-aware linting rules.
const migratedFiles = [
  'lib/util/helpers.ts',
  'lib/constants.ts',
  'lib/util/auth_messages.ts',
  'lib/util/auth.ts',
  'lib/util/api-client.ts',
  'lib/util/cel_validator.ts',
  'lib/util/connector_policy_helper.ts',
  'lib/util/credential/index.ts',
  'lib/util/credential/adc.ts',
  'lib/util/credential/oauth_flow.ts',
  'lib/util/credential/jwt_verifier.ts',
  'lib/api/admin_sdk_client.ts',
  'lib/api/cloud_identity_client.ts',
  'lib/api/chrome_management_client.ts',
  'lib/api/chrome_policy_client.ts',
  'lib/api/service_usage_client.ts',
  'tools/definitions/shared.ts',
  'tools/utils/wrapper.ts',
  'tools/definitions/get_customer_id.ts',
  'tools/definitions/get_dlp_rule.ts',
  'tools/definitions/list_dlp_rules.ts',
  'tools/definitions/list_detectors.ts',
  'tools/definitions/delete_agent_dlp_rule.ts',
  'tools/definitions/delete_detector.ts',
  'tools/definitions/create_chrome_dlp_rule.ts',
  'tools/utils/detector.ts',
  'tools/utils/org-unit.ts',
  'tools/utils/dynamic_docs.ts',
  'tools/definitions/create_regex_detector.ts',
  'tools/definitions/create_url_list_detector.ts',
  'tools/definitions/create_word_list_detector.ts',
  'tools/definitions/create_default_dlp_rules.ts',
  'tools/definitions/check_and_enable_cep_api.ts',
  'tools/definitions/check_cep_subscription.ts',
  'tools/definitions/check_seb_extension_status.ts',
  'tools/definitions/check_user_cep_license.ts',
  'tools/definitions/count_browser_versions.ts',
  'tools/definitions/enable_chrome_enterprise_connectors.ts',
  'tools/definitions/get_chrome_activity_log.ts',
  'tools/definitions/get_connector_policy.ts',
  'tools/definitions/install_seb_extension.ts',
  'tools/definitions/knowledge.ts',
  'tools/definitions/list_customer_profiles.ts',
  'tools/definitions/list_org_units.ts',
  'tools/definitions/diagnose_environment.ts',
  'tools/index.ts',
  'test/helpers/integration/tools/harness.ts',
  'test/helpers/integration/tools/tool_utils.ts',
  'test/helpers/integration/tools/client_factory.ts',
  'test/run-utils.ts',
  'test/run-unit.ts',
  'test/run-integration.ts',
  'test/run-all.ts',
  'lib/util/feature_flags.ts',
  'lib/util/logger.ts',
  'lib/util/gcp.ts',
]

// Map the recommended type-checked rules to apply ONLY to fully migrated files.
const typeCheckedConfigs = tseslint.configs.recommendedTypeChecked.map(config => ({
  ...config,
  files: migratedFiles,
}))

export default tseslint.config(
  {
    ignores: ['**/dist', '**/node_modules', 'results/**', '.worktrees/**', '.claude/**', '.gemini/**', '.opencode/**'],
  },
  {
    // Restrict the TypeScript parser service scope to migrated files
    files: migratedFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended, // Apply standard TS rules globally
  ...typeCheckedConfigs,           // Apply strict type-aware rules to migrated files
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
          publicOnly: true,
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
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
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
    files: ['test/**/*.js', '**/*.test.js', 'test/**/*.ts', '**/*.test.ts'],
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
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    // TypeScript specific overrides: JSDoc types are redundant in TS
    files: ['**/*.ts'],
    rules: {
      'jsdoc/require-param-type': 'off',
      'jsdoc/require-returns-type': 'off',
      'jsdoc/check-types': 'off',
      'jsdoc/valid-types': 'off',
      'jsdoc/require-param': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/check-param-names': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
)
