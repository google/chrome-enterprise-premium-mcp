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
 * @file Managed OAuth flow credential factory.
 */

import readline from 'node:readline'
import open from 'open'
import { OAuth2Client } from 'google-auth-library'
import { TokenCache } from './token_cache.js'
import { startLoopbackServer } from './loopback_server.js'
import { canLaunchBrowser } from './auth_login.js'
import { SCOPES, MANAGED_OAUTH_CLIENT_ID, MANAGED_OAUTH_CLIENT_SECRET } from '../../constants.js'
import { cliInvocation } from '../cli_invocation.js'

/**
 * Writes a single ASCII BEL to stderr when stderr is a TTY. Audible cue that
 * the consent URL is ready; harmless elsewhere.
 * @param {{isTTY?: boolean, write: (s: string) => void}} [stream] Output stream; defaults to process.stderr.
 * @returns {void}
 */
function emitTerminalBell(stream = process.stderr) {
  if (!stream.isTTY) {
    return
  }
  try {
    stream.write('\x07')
  } catch {
    /* ignore */
  }
}

/**
 * Opens the given URL in the user's default browser via the `open` package.
 * Returns `false` (without launching) when `canLaunchBrowser()` reports a
 * headless environment, so the caller can show the paste-URL fallback.
 * Honours `$BROWSER` by passing it through to `open` as the `app.name`.
 * Writes a single BEL to stderr on TTY when the launch child exits 0.
 * @param {string} url The URL to open.
 * @param {object} [deps] Injection points for tests.
 * @param {(target: string, opts?: object) => Promise<import('node:child_process').ChildProcess>} [deps.openImpl] The `open`-package function; defaults to the real import.
 * @param {{isTTY?: boolean, write: (s: string) => void}} [deps.attentionStream] Stream for the BEL cue; defaults to process.stderr.
 * @param {() => boolean} [deps.canLaunch] Headless/SSH check; defaults to canLaunchBrowser.
 * @returns {Promise<boolean>} Resolves true when the launch child exits 0, false otherwise.
 */
export async function defaultOpenBrowser(
  url,
  { openImpl = open, attentionStream = process.stderr, canLaunch = canLaunchBrowser } = {},
) {
  if (!canLaunch()) {
    return false
  }
  const opts = process.env.BROWSER ? { app: { name: process.env.BROWSER } } : undefined
  let child
  try {
    child = await openImpl(url, opts)
  } catch {
    return false
  }
  if (!child || typeof child.on !== 'function') {
    return false
  }
  return new Promise(resolve => {
    child.on('error', () => resolve(false))
    child.on('exit', code => {
      const ok = code === 0
      if (ok) {
        emitTerminalBell(attentionStream)
      }
      resolve(ok)
    })
    child.unref?.()
  })
}

/**
 * Writes the consent URL to stderr. On a TTY, the URL appears inside a
 * bright-cyan Unicode box so it stands out in a busy shell. On non-TTY
 * callers (MCP transports, log capture, piped output), a plain
 * `Open this URL to consent:\n\n<url>\n\n` block is written instead.
 * @param {string} url The consent URL to display.
 * @param {{isTTY?: boolean, write: (chunk: string) => void}} [stream] The output stream; defaults to process.stderr.
 * @returns {void}
 */
export function printConsentUrl(url, stream = process.stderr) {
  if (!stream.isTTY) {
    stream.write(`\nOpen this URL to consent:\n\n${url}\n\n`)
    return
  }
  const CYAN = '\x1b[1;36m'
  const RESET = '\x1b[0m'
  // OSC 8 hyperlink wrap: clickable in modern terminals, invisible elsewhere.
  // Zero visible width, so box-padding still uses raw url.length.
  const linkOpen = `\x1b]8;;${url}\x1b\\`
  const linkClose = '\x1b]8;;\x1b\\'
  const linkedUrl = `${linkOpen}${url}${linkClose}`
  const label = 'Open this URL in your browser to sign in:'
  const width = Math.max(label.length, url.length) + 2
  const top = '╔' + '═'.repeat(width) + '╗'
  const bot = '╚' + '═'.repeat(width) + '╝'
  const pad = (text, visibleLen = text.length) => '║ ' + text + ' '.repeat(width - visibleLen - 1) + '║'
  stream.write('\n')
  stream.write(`${CYAN}${top}${RESET}\n`)
  stream.write(`${CYAN}${pad(label)}${RESET}\n`)
  stream.write(`${CYAN}║${' '.repeat(width)}║${RESET}\n`)
  stream.write(`${CYAN}${pad(linkedUrl, url.length)}${RESET}\n`)
  stream.write(`${CYAN}${bot}${RESET}\n\n`)
}

/**
 * Extracts the OAuth code from a pasted redirect URL or returns the input as-is.
 * @param {string} input The text the user pasted.
 * @returns {?string} The code, or null if the input is empty.
 */
function extractCodeFromPaste(input) {
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }
  try {
    const url = new URL(trimmed)
    return url.searchParams.get('code')
  } catch {
    return trimmed
  }
}

/**
 * Prompts on stderr and resolves with the OAuth code parsed from stdin.
 * @param {AbortSignal} [abortSignal] Cancels the prompt; the promise resolves with null on abort.
 * @returns {Promise<?string>} The code from the pasted line, or null if aborted.
 */
function readCodeFromStdin(abortSignal) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: false })
    const onAbort = () => {
      rl.close()
      resolve(null)
    }
    abortSignal?.addEventListener('abort', onAbort, { once: true })
    rl.question('Or paste the redirect URL here (only needed if the browser is on another machine): ', answer => {
      abortSignal?.removeEventListener('abort', onAbort)
      rl.close()
      const code = extractCodeFromPaste(answer)
      if (code) {
        resolve(code)
      } else {
        reject(new Error('No authorization code provided.'))
      }
    })
  })
}

/**
 * Maps an OAuth code-exchange error to an actionable Error. Inspects
 * err.response?.data?.error (Google API shape) and falls back to err.message.
 * @param {Error & {response?: {data?: {error?: string}}}} err The raw error.
 * @param {string} clientId The OAuth client id, used in the redirect_uri_mismatch message.
 * @returns {Error} An Error with an actionable message.
 */
function mapOAuthError(err, clientId) {
  const code = err?.response?.data?.error || err?.message || ''
  if (code.includes('redirect_uri_mismatch')) {
    const idHint = typeof clientId === 'string' && clientId.length > 0 ? `${clientId.slice(0, 8)}...` : '(unset)'
    return new Error(
      `OAuth client (${idHint}) does not allow http://127.0.0.1 as a redirect URI. ` +
        `If you set CEP_OAUTH_CLIENT_ID, add http://127.0.0.1 (and http://localhost) to the ` +
        `client's allowed redirect URIs in the Google Cloud Console.`,
    )
  }
  if (code.includes('invalid_client')) {
    return new Error(
      'OAuth client config rejected by Google. Verify CEP_OAUTH_CLIENT_ID and ' +
        'CEP_OAUTH_CLIENT_SECRET refer to a current OAuth client in the same GCP project.',
    )
  }
  if (code.includes('access_denied')) {
    return new Error(`Consent declined. Run \`${cliInvocation('auth login')}\` again when ready.`)
  }
  // Treat everything else as a transient network error.
  const wrapped = new Error(`OAuth token exchange failed: ${err.message}`)
  wrapped.transient = true
  return wrapped
}

/**
 * Creates a credential object backed by the managed OAuth flow token cache.
 * @param {object} [opts] Configuration options.
 * @param {string} [opts.clientId] OAuth client id; defaults to env var or bundled managed client.
 * @param {string} [opts.clientSecret] OAuth client secret.
 * @param {string} [opts.cachePath] Token cache path; defaults to TokenCache.defaultPath().
 * @param {string[]} [opts.requiredScopes] The scope set the probe checks against; defaults to all of `SCOPES`.
 * @param {string} [opts.authUrl] Override for the OAuth authorization base URL. Defaults to the Google endpoint.
 * @param {string} [opts.tokenUrl] Override for the OAuth token exchange URL. Defaults to the Google endpoint.
 * @returns {import('./index.js').Credential & {permissionsWarning?: boolean}} The credential object.
 */
export function oauthFlowCredential({
  clientId = process.env.CEP_OAUTH_CLIENT_ID || MANAGED_OAUTH_CLIENT_ID,
  clientSecret = process.env.CEP_OAUTH_CLIENT_SECRET || MANAGED_OAUTH_CLIENT_SECRET,
  cachePath = TokenCache.defaultPath(),
  requiredScopes = Object.values(SCOPES),
  authUrl,
  tokenUrl,
} = {}) {
  const cache = new TokenCache(cachePath)

  return {
    async probe() {
      const tokens = await cache.read()
      if (!tokens) {
        return {
          ok: false,
          source: 'oauth-flow',
          principal: null,
          credentialType: null,
          scopesKnown: false,
          missingScopes: requiredScopes,
          expiry: null,
        }
      }
      const granted = new Set((tokens.scope || '').split(' ').filter(Boolean))
      const missing = requiredScopes.filter(s => !granted.has(s))
      const principal = extractEmailFromIdToken(tokens.id_token) || null
      const expiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null
      const permissionsWarning = !(await cache.modeIsTight())
      const isExpired = expiry && expiry.getTime() < Date.now()
      // The cache stores access tokens only; no refresh path. An expired
      // probe surfaces the auth-login remediation so the user re-consents.
      if (isExpired) {
        return {
          ok: false,
          source: 'oauth-flow',
          principal,
          credentialType: clientId === MANAGED_OAUTH_CLIENT_ID ? 'managed' : 'custom',
          scopesKnown: true,
          missingScopes: missing,
          expiry,
        }
      }
      return {
        ok: missing.length === 0,
        source: 'oauth-flow',
        principal,
        credentialType: clientId === MANAGED_OAUTH_CLIENT_ID ? 'managed' : 'custom',
        scopesKnown: true,
        missingScopes: missing,
        expiry,
        permissionsWarning: permissionsWarning || undefined,
      }
    },

    async getClient() {
      const tokens = await cache.read()
      if (!tokens) {
        throw new Error(
          `No cached managed-OAuth tokens. Run the \`cep_auth\` tool, or \`${cliInvocation('auth login')}\` at the shell.`,
        )
      }
      const client = new OAuth2Client({ clientId, clientSecret })
      client.setCredentials(tokens)
      return client
    },

    buildRemediation(probe) {
      if (!probe || probe.ok) {
        return null
      }
      const login = cliInvocation('auth login')
      if (!probe.scopesKnown && probe.missingScopes.length === requiredScopes.length) {
        return [`Run the \`cep_auth\` tool, or \`${login}\` at the shell, to authenticate.`]
      }
      if (probe.missingScopes.length > 0) {
        return [
          `Cached OAuth tokens do not cover ${probe.missingScopes.length} required scope(s):`,
          ...probe.missingScopes.map(s => `  - ${s}`),
          `Run the \`cep_auth\` tool, or re-run \`${login}\` at the shell, to re-consent with the full scope set.`,
        ]
      }
      return [`Run the \`cep_auth\` tool, or \`${login}\` at the shell, to (re)authenticate.`]
    },

    /**
     * Runs the installed-app OAuth flow. Opens the browser to the consent page,
     * waits for the loopback callback, exchanges the code for tokens, and writes
     * them to the cache.
     * @param {object} [opts] Injection points for testability.
     * @param {(url: string) => Promise<void>} [opts.openBrowser] Opens the browser; defaults to defaultOpenBrowser.
     * @param {(cfg: object) => import('google-auth-library').OAuth2Client} [opts.createOAuth2Client] Creates the OAuth2Client; defaults to the real constructor.
     * @param {(msg: string) => void} [opts.onStatusUpdate] Optional callback for progress messages.
     * @returns {Promise<object>} The token object returned by the code exchange.
     */
    async runLoginFlow({
      openBrowser = defaultOpenBrowser,
      createOAuth2Client = cfg => new OAuth2Client(cfg),
      onStatusUpdate,
    } = {}) {
      const server = await startLoopbackServer()
      try {
        const endpoints = {}
        if (authUrl) {
          endpoints.oauth2AuthBaseUrl = authUrl
        }
        if (tokenUrl) {
          endpoints.oauth2TokenUrl = tokenUrl
        }
        const oauth2 = createOAuth2Client({
          clientId,
          clientSecret,
          redirectUri: server.redirectUri,
          ...(Object.keys(endpoints).length > 0 ? { endpoints } : {}),
        })
        // access_type: 'online' — request an access-token-only response. The
        // server is not cleared to store refresh tokens for the first-party
        // managed OAuth client; the same policy applies to BYO clients
        // because the requested scopes are sensitive (Workspace Admin
        // Directory, Reports, Cloud Identity policies, Chrome Management).
        // When the access token expires, the user re-runs the CLI login.
        const consentUrl = oauth2.generateAuthUrl({
          access_type: 'online',
          prompt: 'consent',
          scope: requiredScopes,
        })
        if (onStatusUpdate) {
          onStatusUpdate(`Authentication required. Opening browser to consent URL: ${consentUrl}`)
        }
        printConsentUrl(consentUrl)
        const opened = await openBrowser(consentUrl)
        if (opened) {
          process.stderr.write('Tried to launch your default browser.\n')
        }
        const RED = '\x1b[1;31m'
        const RESET = '\x1b[0m'
        process.stderr.write(
          'After you consent, your browser is redirected to ' +
            `${server.redirectUri}?code=...\n` +
            '  - Browser on this machine: this command finishes by itself.\n' +
            '\n' +
            `  ${RED}** IF YOU GET A 404 OR "CONNECTION REFUSED" ON ANOTHER MACHINE **${RESET}\n` +
            `  ${RED}That is expected. Paste the full URL from your browser’s address${RESET}\n` +
            `  ${RED}bar below; the code is extracted from it automatically.${RESET}\n\n`,
        )
        if (onStatusUpdate) {
          onStatusUpdate('Waiting for authorization code from browser or stdin...')
        }
        const abort = new AbortController()
        const loopbackPromise = server.waitForCode().then(r => ({ kind: 'loopback', ...r }))
        const stdinPromise = readCodeFromStdin(abort.signal).then(c => ({ kind: 'stdin', code: c }))
        const winner = await Promise.race([loopbackPromise, stdinPromise])
        abort.abort()
        if (winner.kind === 'loopback' && winner.error === 'access_denied') {
          throw new Error(`Consent declined. Run \`${cliInvocation('auth login')}\` again when ready.`)
        }
        if (winner.kind === 'loopback' && winner.error) {
          throw new Error(`Consent failed: ${winner.error}`)
        }
        const code = winner.code
        if (!code) {
          throw new Error('No authorization code received.')
        }
        let tokens
        try {
          const result = await oauth2.getToken(code)
          tokens = result.tokens
        } catch (err) {
          throw mapOAuthError(err, clientId)
        }
        await cache.write({ ...tokens, scope: requiredScopes.join(' ') })
        if (onStatusUpdate) {
          onStatusUpdate('Authorization successful. Tokens cached.')
        }
        return tokens
      } finally {
        await server.stop()
      }
    },
  }
}

/**
 * Extracts the email claim from an ID token's payload segment without verification.
 * @param {string|undefined} idToken The raw JWT string.
 * @returns {string|null} The email claim, or null when absent or unparseable.
 */
function extractEmailFromIdToken(idToken) {
  if (!idToken) {
    return null
  }
  const parts = idToken.split('.')
  if (parts.length !== 3) {
    return null
  }
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    return payload.email || null
  } catch {
    return null
  }
}
