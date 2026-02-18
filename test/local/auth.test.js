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
import { describe, it, mock } from 'node:test'
import esmock from 'esmock'

describe('Auth', () => {
    it('should return an auth client when an auth token is provided', async () => {
        const { getAuthClient } = await esmock('../../lib/util/auth.js', {
            'google-auth-library': {
                OAuth2Client: class {
                    setCredentials() {}
                },
            },
        })
        const client = await getAuthClient([], 'test-token')
        assert.ok(client)
    })

    it('should return an auth client when no auth token is provided', async () => {
        const { getAuthClient } = await esmock('../../lib/util/auth.js', {
            'google-auth-library': {
                GoogleAuth: class {
                    async getClient() {
                        return {}
                    }
                },
            },
        })
        const client = await getAuthClient([])
        assert.ok(client)
    })

    it('should return true when ADC credentials are valid', async () => {
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
        assert.equal(result, true)

        // Restore console mocks
        consoleLogMock.mock.restore()
        consoleErrorMock.mock.restore()
    })

    it('should return false when ADC credentials are missing or invalid', async () => {
        // Mock console.log/error to suppress output during test
        const consoleLogMock = mock.method(console, 'log', () => {})
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
        assert.equal(result, false)

        // Restore console mocks
        consoleLogMock.mock.restore()
        consoleErrorMock.mock.restore()
    })

    describe('getAuthErrorMessage', () => {
        it('should suggest project with enabled API if found', async () => {
            const mockExecFileSync = mock.fn((cmd, args) => {
                if (cmd === 'gcloud' && args.includes('--version')) {
                    return 'Google Cloud SDK'
                }
                if (cmd === 'gcloud' && args.includes('config') && args.includes('get-value')) {
                    return '(unset)\n'
                }

                // Return 3 projects
                if (
                    cmd === 'gcloud' &&
                    args.includes('projects') &&
                    args.includes('list') &&
                    args.includes('--limit=10')
                ) {
                    return 'proj-1\nproj-2\nproj-3\n'
                }

                // Check for services list on specific projects
                if (cmd === 'gcloud' && args.includes('services') && args.includes('list')) {
                    const projectIndex = args.indexOf('--project') + 1
                    const projectId = args[projectIndex]

                    if (projectId === 'proj-1') {
                        return ''
                    } // Not enabled on proj-1
                    if (projectId === 'proj-2') {
                        return 'admin.googleapis.com\n'
                    } // Enabled on proj-2
                    return ''
                }

                return ''
            })

            const { getAuthErrorMessage } = await esmock('../../lib/util/auth-error.js', {
                'node:child_process': {
                    execFileSync: mockExecFileSync,
                },
            })

            const error = new Error(
                'The admin.googleapis.com API requires a quota project, which is not set by default.',
            )
            const message = getAuthErrorMessage(error)

            assert.match(message, /We found a potential quota project "proj-2"/)
            assert.match(message, /gcloud auth application-default set-quota-project proj-2/)
        })

        it('should fallback to most recent project if API check fails or not found', async () => {
            const mockExecFileSync = mock.fn((cmd, args) => {
                if (cmd === 'gcloud' && args.includes('--version')) {
                    return 'Google Cloud SDK'
                }
                if (cmd === 'gcloud' && args.includes('config') && args.includes('get-value')) {
                    return '(unset)\n'
                }

                if (
                    cmd === 'gcloud' &&
                    args.includes('projects') &&
                    args.includes('list') &&
                    args.includes('--limit=10')
                ) {
                    return 'proj-1\nproj-2\n'
                }

                if (cmd === 'gcloud' && args.includes('services') && args.includes('list')) {
                    return '' // Not enabled on any
                }

                return ''
            })

            const { getAuthErrorMessage } = await esmock('../../lib/util/auth-error.js', {
                'node:child_process': {
                    execFileSync: mockExecFileSync,
                },
            })

            const error = new Error(
                'The admin.googleapis.com API requires a quota project, which is not set by default.',
            )
            const message = getAuthErrorMessage(error)

            assert.match(message, /We found a potential quota project "proj-1"/) // Fallback to first (most recent)
        })

        it('should fall back to generic message with console URL if no project is found', async () => {
            const mockExecFileSync = mock.fn((cmd, args) => {
                if (cmd === 'gcloud' && args.includes('--version')) {
                    return 'Google Cloud SDK'
                }
                if (cmd === 'gcloud' && args.includes('config') && args.includes('get-value')) {
                    return '(unset)\n'
                }
                if (cmd === 'gcloud' && args.includes('projects') && args.includes('list')) {
                    return ''
                }
                return ''
            })

            const { getAuthErrorMessage } = await esmock('../../lib/util/auth-error.js', {
                'node:child_process': {
                    execFileSync: mockExecFileSync,
                },
            })

            const error = new Error(
                'The admin.googleapis.com API requires a quota project, which is not set by default.',
            )
            const message = getAuthErrorMessage(error)

            assert.match(message, /Google Cloud Console/)
            assert.match(message, /console.cloud.google.com\/cloud-resource-manager/)
            assert.doesNotMatch(message, /gcloud projects list/)
        })

        it('should use configured project if available', async () => {
            const mockExecFileSync = mock.fn((cmd, args) => {
                if (cmd === 'gcloud' && args.includes('--version')) {
                    return 'Google Cloud SDK'
                }
                if (cmd === 'gcloud' && args.includes('config') && args.includes('get-value')) {
                    return 'configured-project\n'
                }
                return ''
            })

            const { getAuthErrorMessage } = await esmock('../../lib/util/auth-error.js', {
                'node:child_process': {
                    execFileSync: mockExecFileSync,
                },
            })

            const error = new Error(
                'The admin.googleapis.com API requires a quota project, which is not set by default.',
            )
            const message = getAuthErrorMessage(error)

            assert.match(message, /We found a potential quota project "configured-project"/)
            assert.match(message, /gcloud auth application-default set-quota-project configured-project/)
        })
    })
})
