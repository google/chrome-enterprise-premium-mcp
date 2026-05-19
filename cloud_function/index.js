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
 * @file Cloud Run service that handles the Google OAuth redirect for the
 * Chrome Enterprise Premium MCP. Exchanges the authorization code for tokens
 * server-side, then either 302-redirects to the user's local loopback server
 * (same-machine flow) or renders a page with a copyable credentials JSON
 * (headless flow). See cloud_function/README.md for env vars and deploy steps.
 */

import http from 'node:http'
import https from 'node:https'
import { fileURLToPath, URL } from 'node:url'

import { SecretManagerServiceClient } from '@google-cloud/secret-manager'

/** Token endpoint used for the authorization-code exchange. */
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
/** Hard cap on the state parameter to prevent denial of service. */
const MAX_STATE_BYTES = 4096
/** Maximum legal TCP port. */
const MAX_PORT = 65535
/** Lowest non-privileged port the MCP loopback server is allowed to use. */
const MIN_LOOPBACK_PORT = 1024

/**
 * Reads service configuration from the process environment.
 * @param {object} [env] - The environment variable map to read.
 * @returns {{clientId: string|undefined, redirectUri: string|undefined, secretName: string|undefined}} Frozen config.
 */
export function readConfig(env = process.env) {
  const clientId = env.OAUTH_CLIENT_ID
  const redirectUri = env.REDIRECT_URI
  const secretName = env.OAUTH_CLIENT_SECRET_NAME
  return Object.freeze({ clientId, redirectUri, secretName })
}

/**
 * Builds a memoizing accessor for the OAuth client secret. The secret is
 * fetched from Secret Manager on first use and cached in memory for the
 * lifetime of the process.
 * @param {string} secretName - Full Secret Manager resource name.
 * @param {{accessSecretVersion: (req: object) => Promise<Array>}} client - Secret Manager client.
 * @returns {() => Promise<string>} Loader that resolves the cached secret.
 */
export function makeSecretLoader(secretName, client) {
  let pending = null
  return function loadSecret() {
    if (pending === null) {
      pending = (async () => {
        const [version] = await client.accessSecretVersion({ name: secretName })
        const payload = version?.payload?.data
        if (!payload) {
          throw new Error('Secret Manager returned an empty payload.')
        }
        return Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload)
      })().catch(err => {
        pending = null
        throw err
      })
    }
    return pending
  }
}

/**
 * Parses the OAuth state parameter. The MCP encodes state as a JSON string
 * carrying csrf, manual, and optional loopback_port.
 * @param {string|null|undefined} raw - The raw state query parameter.
 * @returns {{csrf: string, manual: boolean, loopbackPort: number|null}|null} Parsed state or null on validation failure.
 */
export function parseState(raw) {
  if (typeof raw !== 'string' || raw.length === 0) {
    return null
  }
  if (Buffer.byteLength(raw, 'utf8') > MAX_STATE_BYTES) {
    return null
  }
  let decoded
  try {
    decoded = JSON.parse(raw)
  } catch {
    return null
  }
  if (!decoded || typeof decoded !== 'object') {
    return null
  }
  const { csrf, manual, loopback_port: loopbackPort } = decoded
  if (typeof csrf !== 'string' || csrf.length === 0) {
    return null
  }
  if (typeof manual !== 'boolean') {
    return null
  }
  let port = null
  if (manual === false) {
    if (!Number.isInteger(loopbackPort)) {
      return null
    }
    if (loopbackPort < MIN_LOOPBACK_PORT || loopbackPort > MAX_PORT) {
      return null
    }
    port = loopbackPort
  }
  return { csrf, manual, loopbackPort: port }
}

/**
 * Builds the loopback redirect URL for the same-machine flow. The credentials
 * JSON is URL-encoded into a single ?credentials= query parameter.
 * @param {number} port - Loopback port the MCP is listening on.
 * @param {object} credentials - Credentials object to serialize.
 * @param {string} csrf - CSRF token echoed back to the loopback handler.
 * @returns {string} Fully formed redirect URL.
 */
export function buildLoopbackRedirect(port, credentials, csrf) {
  const url = new URL(`http://127.0.0.1:${port}/`)
  url.searchParams.set('credentials', JSON.stringify(credentials))
  url.searchParams.set('state', csrf)
  return url.toString()
}

/**
 * HTML-escapes a string for safe interpolation into a page body.
 * @param {unknown} value - The value to escape.
 * @returns {string} The escaped string.
 */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Renders the headless-flow page with the credentials JSON and a Copy button.
 * @param {object} credentials - Credentials object to display.
 * @returns {string} The HTML page body.
 */
export function renderManualPage(credentials) {
  const json = JSON.stringify(credentials, null, 2)
  const safe = escapeHtml(json)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Chrome Enterprise Premium MCP — sign-in complete</title>
<style>
body{font-family:system-ui,sans-serif;background:#f6f8fa;color:#1f2328;margin:0;padding:2rem;display:flex;justify-content:center}
main{max-width:640px;width:100%;background:#fff;border:1px solid #d0d7de;border-radius:8px;padding:1.5rem;box-shadow:0 1px 3px rgba(0,0,0,.06)}
h1{margin-top:0;font-size:1.25rem}
p{line-height:1.5}
pre{background:#f6f8fa;border:1px solid #d0d7de;border-radius:6px;padding:.75rem;overflow:auto;font-size:.85rem;max-height:14rem}
button{background:#1f6feb;color:#fff;border:0;border-radius:6px;padding:.5rem 1rem;font-size:.95rem;cursor:pointer}
button:hover{background:#1a5fce}
#status{margin-left:.75rem;font-size:.85rem;color:#1a7f37}
</style>
</head>
<body>
<main>
<h1>Sign-in complete</h1>
<p>Copy the JSON below and paste it back into the terminal or the <code>cep_auth</code> tool to finish signing in.</p>
<pre id="credentials">${safe}</pre>
<button id="copy" type="button">Copy JSON</button>
<span id="status" aria-live="polite"></span>
<script>
document.getElementById('copy').addEventListener('click', async () => {
  const text = document.getElementById('credentials').textContent;
  const status = document.getElementById('status');
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = 'Copied';
  } catch {
    status.textContent = 'Copy failed — select the JSON manually.';
  }
});
</script>
</main>
</body>
</html>`
}

/**
 * Renders an error page for ?error= callbacks from Google's consent screen.
 * @param {string|null|undefined} errorCode - The error code returned by Google.
 * @returns {string} The HTML page body.
 */
export function renderErrorPage(errorCode) {
  const safe = escapeHtml(errorCode || 'unknown_error')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Sign-in failed</title>
<style>
body{font-family:system-ui,sans-serif;background:#f6f8fa;color:#1f2328;margin:0;padding:2rem;display:flex;justify-content:center}
main{max-width:640px;width:100%;background:#fff;border:1px solid #d0d7de;border-radius:8px;padding:1.5rem}
h1{margin-top:0;font-size:1.25rem;color:#cf222e}
code{background:#f6f8fa;padding:.1rem .3rem;border-radius:4px}
</style>
</head>
<body>
<main>
<h1>Sign-in failed</h1>
<p>Google returned an error: <code>${safe}</code></p>
<p>Close this tab and try again from the terminal.</p>
</main>
</body>
</html>`
}

/**
 * Posts a form body to a URL over HTTPS and resolves with the response.
 * Default implementation used in production; tests inject their own.
 * @param {string} url - The URL to POST to.
 * @param {string} body - The url-encoded form body.
 * @returns {Promise<{status: number, body: string}>} The response.
 */
export function postForm(url, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'content-length': Buffer.byteLength(body),
        },
      },
      res => {
        const chunks = []
        res.on('data', chunk => chunks.push(chunk))
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') })
        })
      },
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

/**
 * Calls the Google token endpoint with the authorization code.
 * @param {object} params - Token-exchange parameters.
 * @param {string} params.code - Authorization code from the OAuth redirect.
 * @param {string} params.clientId - OAuth client ID.
 * @param {string} params.clientSecret - OAuth client secret loaded from Secret Manager.
 * @param {string} params.redirectUri - Redirect URI registered on the client.
 * @param {(url: string, body: string) => Promise<{status: number, body: string}>} [params.post] - Injected POST implementation for tests.
 * @returns {Promise<object>} The decoded token response.
 */
export async function exchangeCode({ code, clientId, clientSecret, redirectUri, post = postForm }) {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  }).toString()
  const res = await post(TOKEN_ENDPOINT, body)
  if (res.status < 200 || res.status >= 300) {
    const error = new Error(`Token exchange failed: HTTP ${res.status}`)
    error.status = res.status
    throw error
  }
  try {
    return JSON.parse(res.body)
  } catch {
    throw new Error('Token exchange returned a non-JSON body.')
  }
}

/**
 * Shapes the token-endpoint response into the credentials JSON.
 * @param {object} tokenResponse - Raw response from the token endpoint.
 * @returns {object} The credentials object.
 */
export function buildCredentials(tokenResponse) {
  const { access_token, refresh_token, scope, expires_in, id_token } = tokenResponse
  const expiry = Number.isFinite(expires_in) ? Date.now() + expires_in * 1000 : null
  return {
    access_token: access_token ?? null,
    refresh_token: refresh_token ?? null,
    scope: scope ?? null,
    expiry_date: expiry,
    id_token: id_token ?? null,
  }
}

/**
 * Sends a plain-text response with no caching.
 * @param {import('node:http').ServerResponse} res - The response object.
 * @param {number} status - HTTP status code.
 * @param {string} body - Response body.
 * @returns {void}
 */
function sendText(res, status, body) {
  res.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(body)
}

/**
 * Sends an HTML response with no caching.
 * @param {import('node:http').ServerResponse} res - The response object.
 * @param {number} status - HTTP status code.
 * @param {string} body - HTML body.
 * @returns {void}
 */
function sendHtml(res, status, body) {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(body)
}

/**
 * Sends a 302 redirect with no caching.
 * @param {import('node:http').ServerResponse} res - The response object.
 * @param {string} location - Redirect target.
 * @returns {void}
 */
function sendRedirect(res, location) {
  res.writeHead(302, { location, 'cache-control': 'no-store' })
  res.end()
}

/**
 * Handles the OAuth redirect request.
 * @param {import('node:http').IncomingMessage} req - Incoming request.
 * @param {import('node:http').ServerResponse} res - Outbound response.
 * @param {object} deps - Injected dependencies.
 * @param {object} deps.config - Service config from readConfig.
 * @param {() => Promise<string>} deps.loadSecret - Secret loader.
 * @param {(url: string, body: string) => Promise<{status: number, body: string}>} [deps.post] - Injected POST for token exchange.
 * @returns {Promise<void>} Resolves when the response has been sent.
 */
export async function handleRedirect(req, res, deps) {
  const { config, loadSecret, post = postForm } = deps
  if (!config.clientId || !config.redirectUri || !config.secretName) {
    sendText(res, 503, 'Service not configured.')
    return
  }

  const url = new URL(req.url, 'http://placeholder')
  const params = url.searchParams
  const errorCode = params.get('error')
  if (errorCode) {
    sendHtml(res, 400, renderErrorPage(errorCode))
    return
  }
  const code = params.get('code')
  if (!code) {
    sendText(res, 400, 'Missing authorization code.')
    return
  }
  const state = parseState(params.get('state'))

  let clientSecret
  try {
    clientSecret = await loadSecret()
  } catch (err) {
    console.error('Failed to load OAuth client secret:', err?.message ?? err)
    sendText(res, 500, 'Failed to load OAuth client secret.')
    return
  }

  let tokenResponse
  try {
    tokenResponse = await exchangeCode({
      code,
      clientId: config.clientId,
      clientSecret,
      redirectUri: config.redirectUri,
      post,
    })
  } catch (err) {
    console.error('Token exchange failed:', err?.message ?? err)
    sendText(res, 502, 'Token exchange failed.')
    return
  }

  const credentials = buildCredentials(tokenResponse)
  if (state && state.manual === false && state.loopbackPort) {
    const location = buildLoopbackRedirect(state.loopbackPort, credentials, state.csrf)
    sendRedirect(res, location)
    return
  }
  sendHtml(res, 200, renderManualPage(credentials))
}

/**
 * Builds the top-level request listener for the Cloud Run service.
 * @param {object} deps - Injected dependencies, passed through to handleRedirect.
 * @returns {import('node:http').Server} The HTTP server.
 */
export function createServer(deps) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://placeholder')
    if (req.method !== 'GET') {
      sendText(res, 405, 'Method Not Allowed')
      return
    }
    if (url.pathname === '/redirect') {
      handleRedirect(req, res, deps).catch(err => {
        console.error('Unhandled error in /redirect handler:', err?.message ?? err)
        if (!res.headersSent) {
          sendText(res, 500, 'Internal error.')
        }
      })
      return
    }
    if (url.pathname === '/' || url.pathname === '/healthz') {
      sendText(res, 200, 'ok')
      return
    }
    sendText(res, 404, 'Not Found')
  })
}

/**
 * Process entry point. Validates env vars, wires Secret Manager, and listens.
 * @returns {void}
 */
function main() {
  const config = readConfig()
  if (!config.secretName) {
    throw new Error('OAUTH_CLIENT_SECRET_NAME is required.')
  }
  if (!config.clientId) {
    throw new Error('OAUTH_CLIENT_ID is required.')
  }
  if (!config.redirectUri) {
    throw new Error('REDIRECT_URI is required.')
  }
  const secretClient = new SecretManagerServiceClient()
  const loadSecret = makeSecretLoader(config.secretName, secretClient)
  const server = createServer({ config, loadSecret })
  const port = Number.parseInt(process.env.PORT, 10) || 8080
  server.listen(port, () => {
    console.log(`OAuth redirect service listening on :${port}`)
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
