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
 * @file Shared building blocks for the agent-initiated sign-in flow.
 *
 * Two callers consume this module: the `cep_auth` tool (which runs the
 * browser-and-loopback flow on behalf of the agent) and `tools/utils/wrapper.js`
 * (which calls `isTokenLocallyValid` as a cheap pre-flight before every tool
 * handler). The CLI keeps its own flow in `oauth_flow.js#runLoginFlow` because
 * it reads the pasted redirect URL from stdin — something a tool handler in
 * stdio mode cannot do (stdin is owned by the MCP transport).
 */

/* eslint-disable require-atomic-updates */
/* `pendingAuth` is intentionally single-flight: a fresh `startToolAuth` replaces
   any in-flight pending state, and `completeToolAuth` consumes it. The reassign-
   after-await pattern that triggers this rule is the intended behavior. */

import { randomBytes } from 'node:crypto'
import fsSync from 'node:fs'
import { OAuth2Client } from 'google-auth-library'
import { TokenCache } from './token_cache.js'
import { startLoopbackServer } from './loopback_server.js'
import { resolveOAuthClientConfig } from './oauth_client_config.js'
import { defaultOpenBrowser } from './oauth_flow.js'
import { SCOPES } from '../../constants.js'

const DEFAULT_AWAIT_CALLBACK_MS = 90_000
const PENDING_TTL_MS = 5 * 60 * 1000

let pendingAuth = null

/**
 * @typedef {object} TokenValidity
 * @property {boolean} ok True when the cache holds a non-expired access token.
 * @property {'missing'|'expired'|'malformed'} [reason] The failure mode when `ok` is false.
 * @property {Date|null} [expiresAt] The token's expiry timestamp, when known.
 */

/**
 * Reads the OAuth token cache and reports whether it holds a usable access
 * token. Local check only — does not call Google.
 * @param {object} [opts] Optional overrides for tests.
 * @param {number} [opts.now] The "now" timestamp in ms; defaults to Date.now().
 * @param {string} [opts.cachePath] The cache file path; defaults to TokenCache.defaultPath().
 * @param {string[]} [opts.scopes] Optional scopes to check for coverage.
 * @returns {Promise<TokenValidity>} Whether the cache holds a usable token, and why not when not.
 */
export async function isTokenLocallyValid({
  now = Date.now(),
  cachePath = TokenCache.defaultPath(),
  scopes = [],
} = {}) {
  const cache = new TokenCache(cachePath)
  const tokens = await cache.read()
  if (!tokens) {
    return { ok: false, reason: 'missing' }
  }
  if (!tokens.access_token) {
    return { ok: false, reason: 'malformed' }
  }

  // 1. Check expiration first (most common and unambiguous failure)
  if (tokens.expiry_date) {
    const expiresAt = new Date(tokens.expiry_date)
    if (expiresAt.getTime() < now) {
      return { ok: false, reason: 'expired', expiresAt }
    }
  }

  // 2. Check for scope coverage
  if (scopes.length > 0) {
    const granted = new Set((tokens.scope || '').split(' ').filter(Boolean))
    const missing = scopes.filter(s => !granted.has(s))
    if (missing.length > 0) {
      return { ok: false, reason: 'insufficient' }
    }
  }

  const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null
  return { ok: true, expiresAt }
}

/**
 * Reports whether this process can plausibly launch a desktop browser.
 * Conservative — when in doubt, returns true and lets the launch attempt fail.
 * Returns false on SSH sessions, Linux without a display server, and common
 * container indicators (`/.dockerenv`, `docker`/`kubepods` in `/proc/1/cgroup`).
 * @param {object} [opts] Optional overrides for tests.
 * @param {object} [opts.env] The environment to inspect; defaults to process.env.
 * @param {string} [opts.platform] The OS platform string; defaults to process.platform.
 * @param {{existsSync: (p: string) => boolean, readFileSync: (p: string, enc: string) => string}} [opts.fs] Filesystem accessor; defaults to node:fs.
 * @returns {boolean} True when a browser is likely launchable.
 */
export function canLaunchBrowser({ env = process.env, platform = process.platform, fs = fsSync } = {}) {
  if (env.SSH_CONNECTION || env.SSH_TTY) {
    return false
  }
  if (platform === 'linux' && !env.DISPLAY && !env.WAYLAND_DISPLAY) {
    return false
  }
  if (platform === 'linux' || platform === 'darwin') {
    try {
      if (fs.existsSync('/.dockerenv')) {
        return false
      }
    } catch {
      /* ignore */
    }
  }
  if (platform === 'linux') {
    try {
      const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8')
      if (/\b(?:docker|kubepods)\b/.test(cgroup)) {
        return false
      }
    } catch {
      /* ignore */
    }
  }
  return true
}

/**
 * @typedef {object} StartToolAuthResult
 * @property {'completed'|'awaiting'} status The outcome of the start call.
 * @property {string} [authUrl] The consent URL; present when status is 'awaiting'.
 * @property {boolean} [browserAttempted] Whether a browser launch was attempted; present when status is 'awaiting'.
 * @property {boolean} [browserOpened] Whether a browser process spawned successfully; present when status is 'awaiting'.
 * @property {'managed'|'custom'} [source] Which OAuth client was resolved.
 * @property {Date|null} [expiresAt] For 'completed', when the new token expires; for 'awaiting', when this pending sign-in expires.
 */

/**
 * Starts the agent-initiated sign-in flow. Generates state and PKCE, starts
 * the loopback callback server, best-effort opens the browser, and waits a
 * short window for the callback. If the callback fires within the window the
 * code is exchanged and the cache written; otherwise the pending sign-in is
 * stashed in module state and the caller receives the consent URL so the
 * agent can prompt the user to paste it back.
 * @param {object} [opts] Injection points for testability.
 * @param {object} [opts.env] The environment; defaults to process.env.
 * @param {(url: string) => Promise<boolean>} [opts.openBrowser] Best-effort browser launcher.
 * @param {(args: {env: object}) => boolean} [opts.browserAvailable] Browser-availability check.
 * @param {() => Promise<object>} [opts.startServer] Loopback-server factory.
 * @param {(cfg: object) => OAuth2Client} [opts.oauth2ClientFactory] OAuth client factory.
 * @param {(env: object) => object} [opts.configResolver] OAuth client-config resolver.
 * @param {string} [opts.cachePath] Token cache path.
 * @param {string[]} [opts.scopes] Scopes to request on the consent screen.
 * @param {number} [opts.awaitCallbackMs] How long to wait for the callback before returning the paste-back path.
 * @returns {Promise<StartToolAuthResult>} The flow result — either 'completed' (signed in) or 'awaiting' (URL ready for paste-back).
 */
export async function startToolAuth({
  env = process.env,
  openBrowser = defaultOpenBrowser,
  browserAvailable = canLaunchBrowser,
  startServer = startLoopbackServer,
  oauth2ClientFactory = cfg => new OAuth2Client(cfg),
  configResolver = resolveOAuthClientConfig,
  cachePath = TokenCache.defaultPath(),
  scopes = Object.values(SCOPES),
  awaitCallbackMs = readTimeoutMs(env),
} = {}) {
  const config = configResolver(env)
  if (pendingAuth) {
    await pendingAuth.cancel().catch(() => {})
    pendingAuth = null
  }

  const server = await startServer()
  const oauth2 = oauth2ClientFactory({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: server.redirectUri,
  })
  const { codeVerifier, codeChallenge } = await oauth2.generateCodeVerifierAsync()
  const state = randomBytes(16).toString('hex')
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'online',
    prompt: 'consent',
    scope: scopes,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  const pending = {
    state,
    codeVerifier,
    oauth2,
    server,
    scopes,
    cachePath,
    expiresAt: Date.now() + PENDING_TTL_MS,
    cancel: async () => {
      try {
        await server.stop()
      } catch {
        /* ignore */
      }
    },
  }
  pendingAuth = pending

  const browserAttempted = browserAvailable({ env })
  let browserOpened = false
  if (browserAttempted) {
    try {
      browserOpened = (await openBrowser(authUrl)) === true
    } catch {
      browserOpened = false
    }
  }

  const callbackPromise = server.waitForCode().then(r => ({ kind: 'callback', ...r }))
  let timeoutHandle
  const timeoutPromise = new Promise(resolve => {
    // No browser opened means no callback can arrive, so we skip the wait to avoid process hang.
    const effectiveWaitMs = browserAttempted ? awaitCallbackMs : 0
    timeoutHandle = setTimeout(() => resolve({ kind: 'timeout' }), effectiveWaitMs)
  })
  const winner = await Promise.race([callbackPromise, timeoutPromise])
  clearTimeout(timeoutHandle)

  if (winner.kind === 'callback') {
    if (winner.error) {
      pendingAuth = null
      await pending.cancel()
      throw mapCallbackError(winner.error)
    }
    if (winner.state !== state) {
      pendingAuth = null
      await pending.cancel()
      throw makeError(
        'STATE_MISMATCH',
        'Sign-in failed: state mismatch. The callback came from a different sign-in attempt.',
      )
    }
    if (!winner.code) {
      pendingAuth = null
      await pending.cancel()
      throw makeError('NO_CODE', 'Sign-in failed: the callback URL had no `code` parameter.')
    }
    const tokens = await exchangeAndCache({ oauth2, code: winner.code, codeVerifier, scopes, cachePath })
    pendingAuth = null
    await pending.cancel()
    return {
      status: 'completed',
      source: config.source,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    }
  }

  // Timeout — leave loopback running so a late callback or a pasted-back URL still works.
  setTimeout(() => {
    if (pendingAuth === pending) {
      pendingAuth = null
      pending.cancel()
    }
  }, PENDING_TTL_MS).unref?.()

  return {
    status: 'awaiting',
    authUrl,
    browserAttempted,
    browserOpened,
    source: config.source,
    expiresAt: new Date(pending.expiresAt),
  }
}

/**
 * Completes the agent-initiated sign-in by exchanging a pasted-back redirect
 * URL for a token. Requires a prior `startToolAuth` in the same process.
 * @param {object} opts The completion parameters.
 * @param {string} opts.redirectUrl The full URL the browser was redirected to.
 * @returns {Promise<{status: 'completed', expiresAt: Date|null}>} The completion result.
 * @throws {Error} With `.code` set to one of: NO_PENDING_AUTH, BAD_REDIRECT_URL, NO_CODE, STATE_MISMATCH, plus any error thrown by the token exchange.
 */
export async function completeToolAuth({ redirectUrl }) {
  if (!pendingAuth) {
    throw makeError('NO_PENDING_AUTH', 'No sign-in is in progress. Run the cep_auth tool with no arguments first.')
  }
  let parsed
  try {
    parsed = new URL(redirectUrl)
  } catch {
    throw makeError(
      'BAD_REDIRECT_URL',
      `That doesn't look like a redirect URL. Expected http://127.0.0.1:PORT/?code=...&state=... — got: ${truncate(redirectUrl, 80)}`,
    )
  }
  const code = parsed.searchParams.get('code')
  const returnedState = parsed.searchParams.get('state')
  const callbackError = parsed.searchParams.get('error')
  if (callbackError) {
    throw mapCallbackError(callbackError)
  }
  if (!code) {
    throw makeError(
      'NO_CODE',
      'No `code` parameter found in the URL. The full URL should contain `?code=...&state=...`.',
    )
  }
  if (returnedState !== pendingAuth.state) {
    throw makeError(
      'STATE_MISMATCH',
      'State mismatch. The URL is from a different sign-in attempt. Run the cep_auth tool with no arguments to start over.',
    )
  }
  const pending = pendingAuth
  const tokens = await exchangeAndCache({
    oauth2: pending.oauth2,
    code,
    codeVerifier: pending.codeVerifier,
    scopes: pending.scopes,
    cachePath: pending.cachePath,
  })
  pendingAuth = null
  await pending.cancel()
  return {
    status: 'completed',
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
  }
}

/**
 * For tests: clears the module-scoped pending-auth state.
 * @returns {Promise<void>} Resolves once any in-flight pending sign-in is cancelled.
 */
export async function _resetPendingAuthForTests() {
  if (pendingAuth) {
    await pendingAuth.cancel().catch(() => {})
    pendingAuth = null
  }
}

/**
 * Exchanges an OAuth authorization code for tokens and writes them to the cache.
 * @param {object} args The exchange parameters.
 * @param {object} args.oauth2 The OAuth2Client to use for the exchange.
 * @param {string} args.code The authorization code from the consent callback.
 * @param {string} args.codeVerifier The PKCE code verifier matching the challenge sent at consent.
 * @param {string[]} args.scopes The scopes requested at consent (persisted into the cache).
 * @param {string} args.cachePath The token cache file path.
 * @returns {Promise<object>} The token object returned by the exchange.
 */
async function exchangeAndCache({ oauth2, code, codeVerifier, scopes, cachePath }) {
  const result = await oauth2.getToken({ code, codeVerifier })
  const tokens = result.tokens
  const cache = new TokenCache(cachePath)
  await cache.write({ ...tokens, scope: scopes.join(' ') })
  return tokens
}

/**
 * Reads the callback-wait timeout from the environment, falling back to the default.
 * @param {object} env The environment to read CEP_AUTH_TIMEOUT_MS from.
 * @returns {number} The timeout in milliseconds.
 */
function readTimeoutMs(env) {
  const raw = env.CEP_AUTH_TIMEOUT_MS
  if (!raw) {
    return DEFAULT_AWAIT_CALLBACK_MS
  }
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_AWAIT_CALLBACK_MS
}

/**
 * Creates an Error with a `.code` field for callers to switch on.
 * @param {string} code The error code (e.g., 'STATE_MISMATCH').
 * @param {string} message The human-readable error message.
 * @returns {Error} The constructed error.
 */
function makeError(code, message) {
  const err = new Error(message)
  err.code = code
  return err
}

/**
 * Maps an OAuth callback `error=...` parameter to an Error with a stable code.
 * @param {string} code The raw error parameter from the callback URL.
 * @returns {Error} The mapped error.
 */
function mapCallbackError(code) {
  if (code === 'access_denied') {
    return makeError(
      'ACCESS_DENIED',
      'Consent declined. Run the cep_auth tool with no arguments when ready to try again.',
    )
  }
  return makeError('CALLBACK_ERROR', `Sign-in failed at the consent step: ${code}`)
}

/**
 * Returns the input truncated to at most `n` characters with a trailing ellipsis.
 * @param {string} s The string to truncate.
 * @param {number} n The maximum length before truncation.
 * @returns {string} The truncated string.
 */
function truncate(s, n) {
  if (typeof s !== 'string') {
    return String(s)
  }
  return s.length > n ? `${s.slice(0, n)}...` : s
}
