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

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'child_process'
import http from 'http'
import { SCOPES, BEARER_METHODS_SUPPORTED, RESPONSE_TYPES_SUPPORTED } from '../../lib/constants.js'

describe('OAuth Endpoints', () => {
  let server
  const PORT = 3005

  before(async () => {
    return new Promise((resolve, reject) => {
      server = spawn('node', ['mcp-server.js'], {
        env: {
          ...process.env,
          GCP_STDIO: 'false',
          PORT: PORT.toString(),
          OAUTH_PROTECTED_RESOURCE: `http://localhost:${PORT}/mcp`,
          OAUTH_AUTHORIZATION_SERVER: `http://localhost:${PORT}/auth/google`,
          OAUTH_AUTHORIZATION_ENDPOINT: 'https://accounts.google.com/o/oauth2/v2/auth',
          OAUTH_TOKEN_ENDPOINT: 'https://oauth2.googleapis.com/token',
        },
      })

      server.stdout.on('data', data => {
        if (data.toString().includes('Chrome Enterprise Premium MCP server listening on port')) {
          resolve()
        }
      })

      server.stderr.on('data', data => {
        console.error(`server error: ${data}`)
      })

      server.on('error', err => {
        reject(err)
      })
    })
  })

  after(() => {
    if (server) {
      server.kill()
    }
  })

  function makeRequest(path) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: PORT,
        path: path,
        method: 'GET',
      }

      const req = http.request(options, res => {
        let responseBody = ''
        res.on('data', chunk => {
          responseBody += chunk
        })

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            body: JSON.parse(responseBody),
          })
        })
      })

      req.on('error', error => {
        reject(error)
      })

      req.end()
    })
  }

  test('should return correct OAuth protected resource configuration', async () => {
    const { statusCode, body } = await makeRequest('/.well-known/oauth-protected-resource')

    assert.strictEqual(statusCode, 200)
    assert.deepStrictEqual(body, {
      resource: `http://localhost:${PORT}/mcp`,
      authorization_servers: [`http://localhost:${PORT}/auth/google`],
      scopes_supported: Object.values(SCOPES),
      bearer_methods_supported: BEARER_METHODS_SUPPORTED,
    })
  })

  test('should return correct OAuth authorization server configuration', async () => {
    const { statusCode, body } = await makeRequest('/.well-known/oauth-authorization-server')

    assert.strictEqual(statusCode, 200)
    assert.deepStrictEqual(body, {
      issuer: 'https://accounts.google.com',
      authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      token_endpoint: 'https://oauth2.googleapis.com/token',
      scopes_supported: Object.values(SCOPES),
      response_types_supported: RESPONSE_TYPES_SUPPORTED,
    })
  })
})
