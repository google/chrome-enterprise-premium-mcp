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
    const code = url.searchParams.get('code') ?? undefined
    const state = url.searchParams.get('state') ?? undefined
    const error = url.searchParams.get('error') ?? undefined
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(error ? renderErrorPage(error) : renderSuccessPage())
    resolveCode({ code, state, error })
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

/*
 * Shared CSS for both the success and the error landing pages. Inlined so the
 * loopback server can respond with a single self-contained document and no
 * external requests. Sized to keep each rendered page under 2 KB.
 */
const PAGE_STYLE =
  'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
  "background:#f8f9fa;font:14px/1.5 'Google Sans',Roboto,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#202124}" +
  '.card{background:#fff;padding:32px 40px;border-radius:8px;box-shadow:0 1px 2px rgba(60,64,67,.3),0 1px 3px 1px rgba(60,64,67,.15);max-width:360px;text-align:center}' +
  '.icon{width:48px;height:48px;margin:0 auto 16px;border-radius:50%;color:#fff;font-size:28px;line-height:48px}' +
  '.ok{background:#34a853}.err{background:#ea4335}' +
  'h1{margin:0 0 8px;font-size:18px;font-weight:500}' +
  'p{margin:0;color:#5f6368}' +
  ".reason{margin-top:12px;font-family:'Roboto Mono',Menlo,Consolas,monospace;font-size:12px;color:#80868b;word-break:break-word}"

/**
 * Renders the post-consent success landing page shown to the user in the
 * browser after Google redirects to the loopback URL.
 * @returns {string} A self-contained HTML document under 2 KB.
 */
function renderSuccessPage() {
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Signed in to CEP MCP</title>' +
    `<style>${PAGE_STYLE}</style></head><body>` +
    '<div class="card"><div class="icon ok">✓</div>' +
    '<h1>Signed in</h1>' +
    '<p>Chrome Enterprise Premium MCP has your credentials. You can close this window and return to your terminal.</p>' +
    '</div></body></html>'
  )
}

/**
 * Renders the post-consent error landing page shown to the user in the
 * browser when Google redirects with an `error` query parameter (typically
 * `access_denied`).
 * @param {string} reason The raw OAuth error code from the callback URL.
 * @returns {string} A self-contained HTML document under 2 KB.
 */
function renderErrorPage(reason) {
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Sign-in failed for CEP MCP</title>' +
    `<style>${PAGE_STYLE}</style></head><body>` +
    '<div class="card"><div class="icon err">✕</div>' +
    '<h1>Sign-in failed</h1>' +
    '<p>Return to your terminal. Chrome Enterprise Premium MCP will report what to try next.</p>' +
    `<p class="reason">${escapeHtml(reason)}</p>` +
    '</div></body></html>'
  )
}

/**
 * Escapes characters that have special meaning in HTML. Applied to the OAuth
 * error code before it is inlined into the error page.
 * @param {string} s The raw string to escape.
 * @returns {string} The escaped string, safe to inline in HTML body text.
 */
function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )
}
