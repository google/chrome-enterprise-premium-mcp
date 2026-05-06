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
import { describe, test, mock } from 'node:test'
import esmock from 'esmock'

function createMockExecFile(...handlers) {
  return mock.fn((cmd, args, opts, cb) => {
    let stdout = ''
    for (const handler of handlers) {
      const result = handler(cmd, args, opts)
      if (result !== undefined && result !== null) {
        stdout = result
        break
      }
    }
    cb(null, stdout, '')
  })
}

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

  test('When no auth token is provided, then it returns a GoogleAuth client', async () => {
    let getClientCalled = false
    const { getAuthClient } = await esmock('../../lib/util/auth.js', {
      'google-auth-library': {
        GoogleAuth: class {
          async getClient() {
            getClientCalled = true
            return {
              getAccessToken: async () => ({ token: 'mock-token' }),
            }
          }
        },
      },
    })
    const client = await getAuthClient([])
    assert.ok(client)
    assert.strictEqual(getClientCalled, true)
    assert.equal(typeof client.getAccessToken, 'function')
  })

  test('When ADC credentials are valid, then ensureADCCredentials returns true', async () => {
    // Mock console.log/error to suppress output during test
    const consoleLogMock = mock.method(console, 'log', () => {})
    const consoleErrorMock = mock.method(console, 'error', () => {})

    const { ensureADCCredentials } = await esmock('../../lib/util/auth.js', {
      'google-auth-library': {
        GoogleAuth: class {
          async getClient() {
            return {
              getAccessToken: async () => ({ token: 'mock-token' }),
            }
          }
        },
      },
    })

    const result = await ensureADCCredentials()
    assert.strictEqual(result, true)

    // Restore console mocks
    consoleLogMock.mock.restore()
    consoleErrorMock.mock.restore()
  })

  test('When ADC credentials are missing or invalid, then ensureADCCredentials returns false', async () => {
    // Mock console.error to suppress output during test
    const consoleErrorMock = mock.method(console, 'error', () => {})

    const { ensureADCCredentials } = await esmock('../../lib/util/auth.js', {
      'google-auth-library': {
        GoogleAuth: class {
          async getClient() {
            throw new Error('No ADC found')
          }
        },
      },
    })

    const result = await ensureADCCredentials()
    assert.strictEqual(result, false)

    // Restore console mocks
    consoleErrorMock.mock.restore()
  })

  describe('getAuthErrorMessage', () => {
    test('When a project with the required API enabled is found, then it is suggested', async () => {
      const mockExecFile = createMockExecFile(
        (cmd, args) => {
          if (cmd === 'gcloud' && args.includes('--version')) {
            return 'Google Cloud SDK'
          }
        },
        (cmd, args) => {
          if (cmd === 'gcloud' && args.includes('config') && args.includes('get-value')) {
            return '(unset)\n'
          }
        },
        (cmd, args) => {
          if (cmd === 'gcloud' && args.includes('projects') && args.includes('list') && args.includes('--limit=10')) {
            return 'proj-1\nproj-2\nproj-3\n'
          }
        },
        (cmd, args) => {
          if (cmd === 'gcloud' && args.includes('services') && args.includes('list')) {
            const projectIndex = args.indexOf('--project') + 1
            const projectId = args[projectIndex]
            if (projectId === 'proj-2') {
              return 'admin.googleapis.com\n'
            }
          }
        },
      )

      const { getAuthErrorMessage } = await esmock('../../lib/util/auth-error.js', {
        'node:child_process': {
          execFile: mockExecFile,
        },
      })

      const error = new Error('The admin.googleapis.com API requires a quota project, which is not set by default.')
      const message = await getAuthErrorMessage(error, { authMode: 'adc' })

      assert.match(message, /We found a potential quota project "proj-2"/)
      assert.match(message, /gcloud auth application-default set-quota-project proj-2/)
    })

    test('When no project has the API enabled, then it falls back to the most recent project', async () => {
      const mockExecFile = createMockExecFile(
        (cmd, args) => {
          if (cmd === 'gcloud' && args.includes('--version')) {
            return 'Google Cloud SDK'
          }
        },
        (cmd, args) => {
          if (cmd === 'gcloud' && args.includes('config') && args.includes('get-value')) {
            return '(unset)\n'
          }
        },
        (cmd, args) => {
          if (cmd === 'gcloud' && args.includes('projects') && args.includes('list') && args.includes('--limit=10')) {
            return 'proj-1\nproj-2\n'
          }
        },
      )

      const { getAuthErrorMessage } = await esmock('../../lib/util/auth-error.js', {
        'node:child_process': {
          execFile: mockExecFile,
        },
      })

      const error = new Error('The admin.googleapis.com API requires a quota project, which is not set by default.')
      const message = await getAuthErrorMessage(error, { authMode: 'adc' })

      assert.match(message, /We found a potential quota project "proj-1"/) // Fallback to first (most recent)
    })

    test('When no projects are found at all, then it falls back to a generic console URL message', async () => {
      const mockExecFile = createMockExecFile(
        (cmd, args) => {
          if (cmd === 'gcloud' && args.includes('--version')) {
            return 'Google Cloud SDK'
          }
        },
        (cmd, args) => {
          if (cmd === 'gcloud' && args.includes('config') && args.includes('get-value')) {
            return '(unset)\n'
          }
        },
      )

      const { getAuthErrorMessage } = await esmock('../../lib/util/auth-error.js', {
        'node:child_process': {
          execFile: mockExecFile,
        },
      })

      const error = new Error('The admin.googleapis.com API requires a quota project, which is not set by default.')
      const message = await getAuthErrorMessage(error, { authMode: 'adc' })

      assert.match(message, /Google Cloud Console/)
      assert.match(message, /console\.cloud\.google\.com\/cloud-resource-manager/)
      assert.doesNotMatch(message, /gcloud projects list/)
    })

    test('When a project is already configured in gcloud, then it uses that project directly', async () => {
      const mockExecFile = createMockExecFile(
        (cmd, args) => {
          if (cmd === 'gcloud' && args.includes('--version')) {
            return 'Google Cloud SDK'
          }
        },
        (cmd, args) => {
          if (cmd === 'gcloud' && args.includes('config') && args.includes('get-value')) {
            return 'configured-project\n'
          }
        },
      )

      const { getAuthErrorMessage } = await esmock('../../lib/util/auth-error.js', {
        'node:child_process': {
          execFile: mockExecFile,
        },
      })

      const error = new Error('The admin.googleapis.com API requires a quota project, which is not set by default.')
      const message = await getAuthErrorMessage(error, { authMode: 'adc' })

      assert.match(message, /We found a potential quota project "configured-project"/)
      assert.match(message, /gcloud auth application-default set-quota-project configured-project/)
    })

    describe('OAuth-flow mode', () => {
      test('When authMode is oauth and the error reports a missing quota project, then the remediation points at GOOGLE_CLOUD_QUOTA_PROJECT and not at a gcloud command', async () => {
        const { getAuthErrorMessage } = await import('../../lib/util/auth-error.js')
        const error = new Error('The admin.googleapis.com API requires a quota project, which is not set by default.')
        const message = await getAuthErrorMessage(error, { authMode: 'oauth' })

        assert.match(message, /GOOGLE_CLOUD_QUOTA_PROJECT/)
        assert.doesNotMatch(message, /gcloud auth application-default set-quota-project/)
        assert.doesNotMatch(message, /Please run:\ngcloud/)
      })

      test('When authMode is oauth and the error reports insufficient scopes, then the remediation points at `mcp auth login`', async () => {
        const { getAuthErrorMessage } = await import('../../lib/util/auth-error.js')
        const error = new Error('Request had insufficient authentication scopes.')
        const message = await getAuthErrorMessage(error, { authMode: 'oauth' })

        assert.match(message, /mcp auth login/)
        assert.doesNotMatch(message, /gcloud auth application-default login/)
      })

      test('When authMode is oauth and the error reports missing credentials, then the remediation suggests `mcp auth login`', async () => {
        const { getAuthErrorMessage } = await import('../../lib/util/auth-error.js')
        const error = new Error('Could not load the default credentials.')
        const message = await getAuthErrorMessage(error, { authMode: 'oauth' })

        assert.match(message, /mcp auth login/)
        assert.doesNotMatch(message, /Application Default Credentials are not set up/)
      })

      test('When authMode is oauth, then the trailing ADC paragraph is omitted', async () => {
        const { getAuthErrorMessage } = await import('../../lib/util/auth-error.js')
        const error = new Error('The admin.googleapis.com API requires a quota project, which is not set by default.')
        const message = await getAuthErrorMessage(error, { authMode: 'oauth' })

        assert.doesNotMatch(message, /Application Default Credentials are not set up/)
        assert.doesNotMatch(message, /GOOGLE_APPLICATION_CREDENTIALS environment variable/)
      })
    })
  })
})

describe('getAuthClient quota project plumbing', () => {
  test('When GOOGLE_CLOUD_QUOTA_PROJECT is set and an authToken is supplied, then quotaProjectId is applied to the OAuth2Client', async () => {
    const { getAuthClient } = await esmock('../../lib/util/auth.js', {
      'google-auth-library': {
        OAuth2Client: class {
          setCredentials(credentials) {
            this.credentials = credentials
          }
        },
      },
    })
    const previous = process.env.GOOGLE_CLOUD_QUOTA_PROJECT
    process.env.GOOGLE_CLOUD_QUOTA_PROJECT = 'my-quota-project'
    try {
      const client = await getAuthClient([], 'test-token')
      assert.equal(client.quotaProjectId, 'my-quota-project')
    } finally {
      if (previous === undefined) {
        delete process.env.GOOGLE_CLOUD_QUOTA_PROJECT
      } else {
        // eslint-disable-next-line require-atomic-updates
        process.env.GOOGLE_CLOUD_QUOTA_PROJECT = previous
      }
    }
  })

  test('When GOOGLE_CLOUD_QUOTA_PROJECT is unset, then quotaProjectId is left undefined on the OAuth2Client', async () => {
    const { getAuthClient } = await esmock('../../lib/util/auth.js', {
      'google-auth-library': {
        OAuth2Client: class {
          setCredentials(credentials) {
            this.credentials = credentials
          }
        },
      },
    })
    const previous = process.env.GOOGLE_CLOUD_QUOTA_PROJECT
    delete process.env.GOOGLE_CLOUD_QUOTA_PROJECT
    try {
      const client = await getAuthClient([], 'test-token')
      assert.equal(client.quotaProjectId, undefined)
    } finally {
      if (previous !== undefined) {
        // eslint-disable-next-line require-atomic-updates
        process.env.GOOGLE_CLOUD_QUOTA_PROJECT = previous
      }
    }
  })
})
