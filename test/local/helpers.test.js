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

import { describe, test, before } from 'node:test'
import assert from 'node:assert/strict'
import esmock from 'esmock'
import { logger, LogLevel } from '../../lib/util/logger.js'

const LOG_LEVEL_OFF = 4

describe('Helpers', () => {
  describe('callWithRetry', () => {
    let callWithRetry

    before(async () => {
      const helpersModule = await esmock('../../lib/util/helpers.js', {
        '../../lib/util/auth.js': {
          getAuthErrorMessage: () =>
            'The API requires a quota project. gcloud auth application-default set-quota-project. Your credentials have insufficient scopes',
        },
        '../../lib/constants.js': {
          DEFAULT_CONFIG: {
            MAX_RETRIES: 3,
            INITIAL_BACKOFF_MS: 1,
            FIRST_RETRY_BACKOFF_MS: 1,
          },
          TAGS: { API: '[api]' },
          ERROR_MESSAGES: {
            INSUFFICIENT_SCOPES: 'Request had insufficient authentication scopes.',
            QUOTA_PROJECT_NOT_SET: 'API requires a quota project, which is not set by default',
          },
        },
      })
      callWithRetry = helpersModule.callWithRetry
    })

    test('When function succeeds, then it returns the result immediately', async () => {
      const result = await callWithRetry(async () => 'success', 'test')
      assert.strictEqual(result, 'success')
    })

    test('When PERMISSION_DENIED (code 7) occurs, then it retries and eventually succeeds', async () => {
      let attempts = 0
      const fn = async () => {
        attempts++
        if (attempts === 1) {
          const error = new Error('Permission denied')
          error.code = 7
          throw error
        }
        return 'success'
      }

      const result = await callWithRetry(fn, 'test retry')
      assert.strictEqual(result, 'success')
      assert.strictEqual(attempts, 2)
    })

    test('When PERMISSION_DENIED (code 7) occurs repeatedly, then it fails after max retries', async () => {
      let attempts = 0
      const fn = async () => {
        attempts++
        const error = new Error('Permission denied')
        error.code = 7
        throw error
      }

      await assert.rejects(
        async () => {
          await callWithRetry(fn, 'test max retries')
        },
        { code: 7 },
      )
      // Max retries is 3, so 1 initial + 3 retries = 4 attempts total
      assert.strictEqual(attempts, 4)
    })

    test('When QUOTA_PROJECT_NOT_SET error occurs, then it throws a helpful message and does not retry', async () => {
      logger.setLevel(LOG_LEVEL_OFF) // Suppress expected error logs
      try {
        let attempts = 0
        const quotaError = new Error(
          'Your application is authenticating by using local Application Default Credentials. The admin.googleapis.com API requires a quota project, which is not set by default.',
        )

        await assert.rejects(
          async () => {
            await callWithRetry(async () => {
              attempts++
              throw quotaError
            }, 'test quota error')
          },
          err => {
            return (
              err.message.includes('The API requires a quota project') &&
              err.message.includes('gcloud auth application-default set-quota-project')
            )
          },
        )
        assert.strictEqual(attempts, 1)
      } finally {
        logger.setLevel(LogLevel.ERROR) // Restore level
      }
    })

    test('When INSUFFICIENT_SCOPES error occurs, then it throws a helpful message and does not retry', async () => {
      logger.setLevel(LOG_LEVEL_OFF) // Suppress expected error logs
      try {
        let attempts = 0
        const scopeError = new Error('Request had insufficient authentication scopes.')

        await assert.rejects(
          async () => {
            await callWithRetry(async () => {
              attempts++
              throw scopeError
            }, 'test scope error')
          },
          err => {
            return err.message.includes('Your credentials have insufficient scopes')
          },
        )
        assert.strictEqual(attempts, 1)
      } finally {
        logger.setLevel(LogLevel.ERROR) // Restore level
      }
    })
  })
})
