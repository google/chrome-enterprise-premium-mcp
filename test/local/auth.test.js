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

  test('When no tokens exist and we are in stdio mode, then getAuthClient throws immediately without opening browser', async () => {
    const previous = process.env.GOOGLE_APPLICATION_CREDENTIALS
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS
    try {
      const { getAuthClient } = await esmock('../../lib/util/auth.js', {
        '../../lib/util/gcp.js': {
          isStdioMode: () => true,
        },
        '../../lib/util/credential/token_cache.js': {
          TokenCache: class {
            static defaultPath() {
              return '/tmp/fake-path'
            }
            constructor() {}
            async readEnforcingMode() {
              return null
            }
          },
        },
      })

      await assert.rejects(() => getAuthClient(['some-scope']), /Authentication required. Run the `cep_auth` tool/)
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

    test('When the error reports SERVICE_DISABLED for the default managed OAuth project, then it instructs to reach out to a Chrome Enterprise Premium team member', async () => {
      const { getAuthErrorMessage } = await import('../../lib/util/auth-error.js')
      const error = new Error(
        'Admin SDK API has not been used in project 947770278602 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/admin.googleapis.com/overview?project=947770278602 then retry.',
      )
      const message = getAuthErrorMessage(error)

      assert.match(message, /default Google-managed 1P OAuth project/)
      assert.match(message, /reach out to a Chrome Enterprise Premium team member/)
      assert.match(message, /enable the missing API on project 947770278602/)
      assert.match(message, /check_and_enable_cep_api/)
    })

    test('When the error reports insufficient scopes, then the remediation points at the CLI login command', async () => {
      const { getAuthErrorMessage } = await import('../../lib/util/auth-error.js')
      const error = new Error('Request had insufficient authentication scopes.')
      const message = getAuthErrorMessage(error)

      assert.match(message, /auth login/)
      assert.match(message, /cep_auth/)
    })
  })

  test('When cep_auth_clear is called, then it clears the token cache and resets sessionState', async () => {
    let cacheCleared = false
    const { registerAuthTools } = await esmock('../../tools/definitions/auth.js', {
      '../../lib/util/credential/token_cache.js': {
        TokenCache: class {
          static defaultPath() {
            return '/tmp/fake-path'
          }
          constructor() {}
          async clear() {
            cacheCleared = true
          }
        },
      },
    })

    const handlers = {}
    const mockServer = {
      registerTool: (name, schema, handler) => {
        handlers[name] = handler
      },
    }

    const sessionState = {
      customerId: 'C0123456',
      cachedRootOrgUnitId: 'id:fakeOUId1',
    }

    registerAuthTools(mockServer, {}, sessionState)

    const clearHandler = handlers['cep_auth_clear']
    assert.ok(clearHandler)

    await clearHandler({}, { requestInfo: { headers: { authorization: 'Bearer token' } } })

    assert.ok(cacheCleared)
    assert.strictEqual(sessionState.customerId, null)
    assert.strictEqual(sessionState.cachedRootOrgUnitId, null)
  })

  describe('CEP_AUTH_MODE configuration', () => {
    test('When CEP_AUTH_MODE is bearer-only and token is provided, then it returns OAuth2 client', async () => {
      const { getAuthClient } = await esmock('../../lib/util/auth.js', {
        'google-auth-library': {
          OAuth2Client: class {
            setCredentials(credentials) {
              assert.deepStrictEqual(credentials, { access_token: 'test-token' })
            }
          },
        },
      })
      const prevMode = process.env.CEP_AUTH_MODE
      process.env.CEP_AUTH_MODE = 'bearer-only'
      try {
        const client = await getAuthClient([], 'test-token')
        assert.ok(client)
      } finally {
        if (prevMode === undefined) {
          delete process.env.CEP_AUTH_MODE
        } else {
          process.env.CEP_AUTH_MODE = prevMode
        }
      }
    })

    test('When CEP_AUTH_MODE is bearer-only and token is missing, then it throws even if SA credentials exist', async () => {
      const { getAuthClient } = await esmock('../../lib/util/auth.js', {
        'node:fs/promises': {
          readFile: async () => JSON.stringify({ type: 'service_account', client_email: 'x', private_key: 'y' }),
        },
      })
      const prevMode = process.env.CEP_AUTH_MODE
      const prevCred = process.env.GOOGLE_APPLICATION_CREDENTIALS
      process.env.CEP_AUTH_MODE = 'bearer-only'
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/fake-key.json'
      try {
        await assert.rejects(() => getAuthClient([]), /strict "bearer-only" mode/)
      } finally {
        if (prevMode === undefined) {
          delete process.env.CEP_AUTH_MODE
        } else {
          process.env.CEP_AUTH_MODE = prevMode
        }
        if (prevCred === undefined) {
          delete process.env.GOOGLE_APPLICATION_CREDENTIALS
        } else {
          process.env.GOOGLE_APPLICATION_CREDENTIALS = prevCred
        }
      }
    })

    test('When CEP_AUTH_MODE is service-account-only and SA key exists, then it returns JWT client even if token is provided', async () => {
      let jwtInstantiated = false
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
            constructor() {
              jwtInstantiated = true
            }
          },
        },
      })
      const prevMode = process.env.CEP_AUTH_MODE
      const prevCred = process.env.GOOGLE_APPLICATION_CREDENTIALS
      process.env.CEP_AUTH_MODE = 'service-account-only'
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/fake-key.json'
      try {
        const client = await getAuthClient([], 'ignored-token')
        assert.ok(client)
        assert.ok(jwtInstantiated)
      } finally {
        if (prevMode === undefined) {
          delete process.env.CEP_AUTH_MODE
        } else {
          process.env.CEP_AUTH_MODE = prevMode
        }
        if (prevCred === undefined) {
          delete process.env.GOOGLE_APPLICATION_CREDENTIALS
        } else {
          process.env.GOOGLE_APPLICATION_CREDENTIALS = prevCred
        }
      }
    })

    test('When CEP_AUTH_MODE is service-account-only and SA key is missing, then it throws', async () => {
      const { getAuthClient } = await esmock('../../lib/util/auth.js', {})
      const prevMode = process.env.CEP_AUTH_MODE
      const prevCred = process.env.GOOGLE_APPLICATION_CREDENTIALS
      process.env.CEP_AUTH_MODE = 'service-account-only'
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS
      try {
        await assert.rejects(() => getAuthClient([]), /GOOGLE_APPLICATION_CREDENTIALS is not set/)
      } finally {
        if (prevMode === undefined) {
          delete process.env.CEP_AUTH_MODE
        } else {
          process.env.CEP_AUTH_MODE = prevMode
        }
        if (prevCred === undefined) {
          delete process.env.GOOGLE_APPLICATION_CREDENTIALS
        } else {
          process.env.GOOGLE_APPLICATION_CREDENTIALS = prevCred
        }
      }
    })

    test('When CEP_AUTH_MODE is invalid, then it throws during client acquisition', async () => {
      const { getAuthClient } = await esmock('../../lib/util/auth.js', {})
      const prevMode = process.env.CEP_AUTH_MODE
      process.env.CEP_AUTH_MODE = 'invalid-mode'
      try {
        await assert.rejects(() => getAuthClient([]), /Invalid CEP_AUTH_MODE/)
      } finally {
        if (prevMode === undefined) {
          delete process.env.CEP_AUTH_MODE
        } else {
          process.env.CEP_AUTH_MODE = prevMode
        }
      }
    })
  })

  describe('guardedToolCall delegation guard', () => {
    test('When running in SA mode and calling a tool with requiresDelegation=true without CEP_IMPERSONATE_SUBJECT, then it returns pre-flight error', async () => {
      const { guardedToolCall } = await import('../../tools/utils/wrapper.js')
      const prevCred = process.env.GOOGLE_APPLICATION_CREDENTIALS
      const prevSub = process.env.CEP_IMPERSONATE_SUBJECT
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/fake-key.json'
      delete process.env.CEP_IMPERSONATE_SUBJECT
      try {
        const wrapped = guardedToolCall(
          {
            requiresDelegation: true,
            skipAutoResolve: true,
            handler: async () => ({ content: [{ type: 'text', text: 'should not run' }] }),
          },
          {},
          {},
        )
        const result = await wrapped({}, {})
        assert.strictEqual(result.isError, true)
        assert.match(result.content[0].text, /requires domain-wide delegation/i)
      } finally {
        if (prevCred === undefined) {
          delete process.env.GOOGLE_APPLICATION_CREDENTIALS
        } else {
          process.env.GOOGLE_APPLICATION_CREDENTIALS = prevCred
        }
        if (prevSub === undefined) {
          delete process.env.CEP_IMPERSONATE_SUBJECT
        } else {
          process.env.CEP_IMPERSONATE_SUBJECT = prevSub
        }
      }
    })

    test('When running in SA mode and calling a tool with requiresDelegation=false without CEP_IMPERSONATE_SUBJECT, then it runs handler and skips OAuth check', async () => {
      const { guardedToolCall } = await import('../../tools/utils/wrapper.js')
      const prevCred = process.env.GOOGLE_APPLICATION_CREDENTIALS
      const prevSub = process.env.CEP_IMPERSONATE_SUBJECT
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/fake-key.json'
      delete process.env.CEP_IMPERSONATE_SUBJECT
      try {
        let handlerRan = false
        const wrapped = guardedToolCall(
          {
            requiresDelegation: false,
            skipAutoResolve: true,
            handler: async () => {
              handlerRan = true
              return { content: [{ type: 'text', text: 'ok' }] }
            },
          },
          {},
          {},
        )
        const result = await wrapped({}, {})
        assert.strictEqual(handlerRan, true)
        assert.strictEqual(result.content[0].text, 'ok')
      } finally {
        if (prevCred === undefined) {
          delete process.env.GOOGLE_APPLICATION_CREDENTIALS
        } else {
          process.env.GOOGLE_APPLICATION_CREDENTIALS = prevCred
        }
        if (prevSub === undefined) {
          delete process.env.CEP_IMPERSONATE_SUBJECT
        } else {
          process.env.CEP_IMPERSONATE_SUBJECT = prevSub
        }
      }
    })
  })

  describe('Step 2 mode-aware error remediation', () => {
    test('When DWD unauthorized_client error occurs, then getAuthErrorMessage returns DWD admin console instructions', async () => {
      const { getAuthErrorMessage } = await import('../../lib/util/auth-error.js')
      const error = new Error(
        '401 unauthorized_client: Client is unauthorized to retrieve access tokens using this method.',
      )
      const message = getAuthErrorMessage(error)
      assert.match(message, /Domain-Wide Delegation \(DWD\) authorization failed/)
      assert.match(message, /admin\.google\.com/)
    })

    test('When running in Service Account mode, then getAuthErrorMessage for insufficient scopes never mentions cep_auth', async () => {
      const { getAuthErrorMessage } = await import('../../lib/util/auth-error.js')
      const prevCred = process.env.GOOGLE_APPLICATION_CREDENTIALS
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/fake-key.json'
      try {
        const error = new Error('Request had insufficient authentication scopes.')
        const message = getAuthErrorMessage(error)
        assert.match(message, /Verify the Domain-Wide Delegation OAuth scopes/)
        assert.doesNotMatch(message, /cep_auth/)
      } finally {
        if (prevCred === undefined) {
          delete process.env.GOOGLE_APPLICATION_CREDENTIALS
        } else {
          process.env.GOOGLE_APPLICATION_CREDENTIALS = prevCred
        }
      }
    })
  })
})
