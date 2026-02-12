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

import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import esmock from 'esmock';

describe('Auth', () => {
  it('should return an auth client when an auth token is provided', async () => {
    const { getAuthClient } = await esmock('../../lib/util/auth.js', {
      'google-auth-library': {
        OAuth2Client: class {
          setCredentials() {}
        },
      },
    });
    const client = await getAuthClient([], 'test-token');
    assert.ok(client);
  });

  it('should return an auth client when no auth token is provided', async () => {
    const { getAuthClient } = await esmock('../../lib/util/auth.js', {
      'google-auth-library': {
        GoogleAuth: class {
          async getClient() {
            return {};
          }
        },
      },
    });
    const client = await getAuthClient([]);
    assert.ok(client);
  });

  it('should return true when ADC credentials are valid', async () => {
    // Mock console.log/error to suppress output during test
    const consoleLogMock = mock.method(console, 'log', () => {});
    const consoleErrorMock = mock.method(console, 'error', () => {});

    const { ensureADCCredentials } = await esmock('../../lib/util/auth.js', {
      'google-auth-library': {
        GoogleAuth: class {
          async getClient() {
            return {
              getAccessToken: async () => ({ token: 'mock-token' }),
            };
          }
        },
      },
    });

    const result = await ensureADCCredentials();
    assert.equal(result, true);
    
    // Restore console mocks
    consoleLogMock.mock.restore();
    consoleErrorMock.mock.restore();
  });

  it('should return false when ADC credentials are missing or invalid', async () => {
    // Mock console.log/error to suppress output during test
    const consoleLogMock = mock.method(console, 'log', () => {});
    const consoleErrorMock = mock.method(console, 'error', () => {});

    const { ensureADCCredentials } = await esmock('../../lib/util/auth.js', {
      'google-auth-library': {
        GoogleAuth: class {
          async getClient() {
            throw new Error('No ADC found');
          }
        },
      },
    });

    const result = await ensureADCCredentials();
    assert.equal(result, false);

    // Restore console mocks
    consoleLogMock.mock.restore();
    consoleErrorMock.mock.restore();
  });
});
