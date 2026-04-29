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

/**
 * @file Ephemeral HTTP server for the OAuth installed-app code-callback step.
 */

import http from 'node:http'

/**
 * Starts an HTTP server bound to 127.0.0.1 on a random port. Returns an object with
 * the redirect URI, a function that returns a promise resolving with the OAuth code-callback
 * query parameters when the server receives a request, and a stop function.
 * @returns {Promise<{redirectUri: string, waitForCode: () => Promise<{code?: string, state?: string, error?: string}>, stop: () => Promise<void>}>}
 * An object containing:
 * - redirectUri: The full URI where the OAuth provider should redirect (e.g., http://127.0.0.1:12345/)
 * - waitForCode: A function returning a promise that resolves with code, state, and/or error parameters
 * - stop: A function that shuts down the HTTP server
 */
export async function startLoopbackServer() {
  let resolveCode
  const codePromise = new Promise(resolve => {
    resolveCode = resolve
  })

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end('<html><body><p>You may close this window.</p></body></html>')
    resolveCode({
      code: url.searchParams.get('code') ?? undefined,
      state: url.searchParams.get('state') ?? undefined,
      error: url.searchParams.get('error') ?? undefined,
    })
  })

  await new Promise(resolve => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const port = server.address().port

  return {
    redirectUri: `http://127.0.0.1:${port}/`,
    waitForCode: () => codePromise,
    stop: () =>
      new Promise(resolve => {
        server.close(() => {
          resolve()
        })
      }),
  }
}
