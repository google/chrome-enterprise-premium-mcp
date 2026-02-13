import js from '@eslint/js'
import nodePlugin from 'eslint-plugin-n'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'

export default [
    {
        ignores: ['**/dist', '**/node_modules'],
    },
    js.configs.recommended,
    nodePlugin.configs['flat/recommended'],
    eslintPluginPrettierRecommended,
    {
        rules: {
            curly: 'error',
            'prettier/prettier': 'error',
            'no-extra-semi': 'off',
            'n/no-unsupported-features/es-syntax': [
                'error',
                {
                    ignores: ['modules'],
                },
            ],
            'no-use-before-define': 'off',
            'no-warning-comments': [
                'error',
                {
                    terms: ['nocommit', '@nocommit', '@no-commit'],
                },
            ],
            'no-unused-vars': 'off',
            'n/no-missing-import': 'off',
            'n/no-unsupported-features/node-builtins': 'off',
            'n/no-unpublished-import': 'off',
        },
    },
]
