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

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import esmock from 'esmock'

describe('Auth', () => {
  test('When an auth token is provided, then it returns an OAuth2 client', async () => {
    const { getAuthClient } = await esmock('../../lib/util/auth.js', {
      'google-auth-library': {
        OAuth2Client: class {
          setCredentials(credentials) {
            assert.deepStrictEqual(credentials, { access_token: 'test-token' })
          }
        },
      },
    })
    const client = await getAuthClient([], 'test-token')
    assert.ok(client)
  })

  test('When GOOGLE_APPLICATION_CREDENTIALS points at an SA key, then it returns a JWT bound to that key', async () => {
    let observedConfig = null
    const fakeKey = {
      type: 'service_account',
      client_email: 'svc@example.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\nstub\n-----END PRIVATE KEY-----\n',
    }
    const { getAuthClient } = await esmock('../../lib/util/auth.js', {
      'node:fs/promises': {
        readFile: async () => JSON.stringify(fakeKey),
      },
      'google-auth-library': {
        JWT: class {
          constructor(cfg) {
            observedConfig = cfg
          }
        },
      },
    })

    const previous = process.env.GOOGLE_APPLICATION_CREDENTIALS
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/fake-key.json'
    try {
      const client = await getAuthClient(['https://www.googleapis.com/auth/cloud-platform'])
      assert.ok(client)
      assert.strictEqual(observedConfig.email, 'svc@example.iam.gserviceaccount.com')
      assert.deepStrictEqual(observedConfig.scopes, ['https://www.googleapis.com/auth/cloud-platform'])
      assert.strictEqual(observedConfig.subject, undefined)
    } finally {
      if (previous === undefined) {
        delete process.env.GOOGLE_APPLICATION_CREDENTIALS
      } else {
        // eslint-disable-next-line require-atomic-updates
        process.env.GOOGLE_APPLICATION_CREDENTIALS = previous
      }
    }
  })

  test('When CEP_IMPERSONATE_SUBJECT is set, then the JWT is built with that subject for DWD', async () => {
    let observedConfig = null
    const fakeKey = {
      type: 'service_account',
      client_email: 'svc@example.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\nstub\n-----END PRIVATE KEY-----\n',
    }
    const { getAuthClient } = await esmock('../../lib/util/auth.js', {
      'node:fs/promises': {
        readFile: async () => JSON.stringify(fakeKey),
      },
      'google-auth-library': {
        JWT: class {
          constructor(cfg) {
            observedConfig = cfg
          }
        },
      },
    })

    const prevCred = process.env.GOOGLE_APPLICATION_CREDENTIALS
    const prevSub = process.env.CEP_IMPERSONATE_SUBJECT
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/fake-key.json'
    process.env.CEP_IMPERSONATE_SUBJECT = 'admin@example.com'
    try {
      await getAuthClient(['https://www.googleapis.com/auth/admin.directory.user'])
      assert.strictEqual(observedConfig.subject, 'admin@example.com')
    } finally {
      if (prevCred === undefined) {
        delete process.env.GOOGLE_APPLICATION_CREDENTIALS
      } else {
        // eslint-disable-next-line require-atomic-updates
        process.env.GOOGLE_APPLICATION_CREDENTIALS = prevCred
      }
      if (prevSub === undefined) {
        delete process.env.CEP_IMPERSONATE_SUBJECT
      } else {
        // eslint-disable-next-line require-atomic-updates
        process.env.CEP_IMPERSONATE_SUBJECT = prevSub
      }
    }
  })

  test('When GOOGLE_APPLICATION_CREDENTIALS points at a non-SA key, then it throws', async () => {
    const { getAuthClient } = await esmock('../../lib/util/auth.js', {
      'node:fs/promises': {
        readFile: async () =>
          JSON.stringify({ type: 'authorized_user', client_id: 'x', client_secret: 'y', refresh_token: 'z' }),
      },
    })

    const previous = process.env.GOOGLE_APPLICATION_CREDENTIALS
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/fake-key.json'
    try {
      await assert.rejects(() => getAuthClient([]), /not "service_account"/)
    } finally {
      if (previous === undefined) {
        delete process.env.GOOGLE_APPLICATION_CREDENTIALS
      } else {
        // eslint-disable-next-line require-atomic-updates
        process.env.GOOGLE_APPLICATION_CREDENTIALS = previous
      }
    }
  })

  describe('getAuthErrorMessage', () => {
    test('When the error reports SERVICE_DISABLED for a BYO OAuth client owner project, then the remediation lists the required APIs and points at the BYO walkthrough', async () => {
      const { getAuthErrorMessage } = await import('../../lib/util/auth-error.js')
      const error = new Error(
        'Admin SDK API has not been used in project 123456789 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/admin.googleapis.com/overview?project=123456789 then retry.',
      )
      const message = getAuthErrorMessage(error)

      assert.match(message, /admin\.googleapis\.com/)
      assert.match(message, /gcloud services enable/)
      assert.match(message, /auth-bring-your-own-oauth-client\.md/)
    })

    test('When the error reports insufficient scopes, then the remediation points at `mcp auth login`', async () => {
      const { getAuthErrorMessage } = await import('../../lib/util/auth-error.js')
      const error = new Error('Request had insufficient authentication scopes.')
      const message = getAuthErrorMessage(error)

      assert.match(message, /mcp auth login/)
    })
  })
})
