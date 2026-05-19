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

import { spawn, spawnSync } from 'node:child_process'
import readline from 'node:readline'
import { OAuth2Client } from 'google-auth-library'
import { TokenCache } from './token_cache.js'
import { startLoopbackServer } from './loopback_server.js'
import { canLaunchBrowser } from './auth_login.js'
import { SCOPES, MANAGED_OAUTH_CLIENT_ID, MANAGED_OAUTH_CLIENT_SECRET } from '../../constants.js'

/* Process-lifetime cache for the macOS Chrome-presence probe. */
let chromeOnMacCache

/**
 * Probes for Google Chrome on macOS via `mdfind`, caching the result for the
 * lifetime of the process. Returns false on probe failure.
 * @returns {boolean} True when a Chrome bundle is registered with Launch Services.
 */
function isChromeOnMac() {
  if (chromeOnMacCache !== undefined) {
    return chromeOnMacCache
  }
  try {
    const result = spawnSync('mdfind', ['kMDItemCFBundleIdentifier == "com.google.Chrome"'], {
      encoding: 'utf8',
      timeout: 1500,
    })
    chromeOnMacCache = result.status === 0 && typeof result.stdout === 'string' && result.stdout.trim().length > 0
  } catch {
    chromeOnMacCache = false
  }
  return chromeOnMacCache
}

/**
 * For tests: clears the process-lifetime Chrome-detection cache.
 * @returns {void}
 */
export function _resetChromeDetectionCacheForTests() {
  chromeOnMacCache = undefined
}

/**
 * Best-effort detection of whether a given binary is on PATH on POSIX systems.
 * Returns false on any failure.
 * @param {string} bin The binary to look up.
 * @param {(cmd: string, args: string[], opts: object) => {status: number|null}} spawnSyncImpl Sync spawn used for the lookup.
 * @returns {boolean} True when `command -v <bin>` exits 0.
 */
function hasOnPath(bin, spawnSyncImpl) {
  try {
    const result = spawnSyncImpl('sh', ['-c', `command -v ${bin}`], { stdio: 'ignore', timeout: 1500 })
    return result.status === 0
  } catch {
    return false
  }
}

/**
 * Best-effort activation of the foreground browser window after a launch. All
 * spawns are detached and unref'd; errors are silenced. Never blocks the
 * caller and never rejects.
 * @param {object} opts Activation parameters.
 * @param {string} opts.cmd The launch command that was used (informs which browser to activate).
 * @param {(c: string, a: string[], o: object) => import('node:child_process').ChildProcess} opts.spawnImpl Async spawn used for activation.
 * @param {(c: string, a: string[], o: object) => {status: number|null}} opts.spawnSyncImpl Sync spawn used for PATH probes.
 * @param {string} opts.platform The OS platform string.
 * @returns {void}
 */
function bringBrowserToFront({ cmd, spawnImpl, spawnSyncImpl, platform }) {
  const safeSpawn = (c, a) => {
    try {
      const child = spawnImpl(c, a, { detached: true, stdio: 'ignore' })
      child.on?.('error', () => {})
      child.unref?.()
    } catch {
      /* ignore */
    }
  }
  if (platform === 'darwin') {
    const appName = macAppNameForCommand(cmd)
    if (appName) {
      safeSpawn('osascript', ['-e', `tell application "${appName}" to activate`])
    }
    return
  }
  if (platform === 'win32') {
    const title = winAppActivateTitleForCommand(cmd)
    if (title) {
      safeSpawn('powershell', [
        '-NoProfile',
        '-Command',
        `(New-Object -ComObject WScript.Shell).AppActivate('${title}')`,
      ])
    }
    return
  }
  if (platform === 'linux') {
    if (hasOnPath('wmctrl', spawnSyncImpl)) {
      const match = linuxWmctrlTitleForCommand(cmd) || 'chrome'
      safeSpawn('wmctrl', ['-a', match])
    }
  }
}

/**
 * Maps a launch command/binary to a macOS application bundle name for `osascript ... activate`.
 * @param {string} cmd The launch command name (e.g., 'Google Chrome', 'firefox').
 * @returns {string} The macOS application name to activate.
 */
function macAppNameForCommand(cmd) {
  const lower = (cmd || '').toLowerCase()
  if (lower.includes('chrome')) {
    return 'Google Chrome'
  }
  if (lower.includes('firefox')) {
    return 'Firefox'
  }
  if (lower.includes('safari')) {
    return 'Safari'
  }
  if (lower.includes('edge') || lower.includes('msedge')) {
    return 'Microsoft Edge'
  }
  // `open` with no -a: the user's default browser. AppleScript can't target an
  // unknown app, so we fall back to Chrome — the most common default on
  // managed Workspace fleets — and silently no-op when it isn't installed.
  return 'Google Chrome'
}

/**
 * Maps a launch command/binary to a Windows window title for AppActivate.
 * @param {string} cmd The launch command name.
 * @returns {string} The window title substring AppActivate should target.
 */
function winAppActivateTitleForCommand(cmd) {
  const lower = (cmd || '').toLowerCase()
  if (lower.includes('firefox')) {
    return 'Firefox'
  }
  if (lower.includes('msedge') || lower.includes('edge')) {
    return 'Edge'
  }
  if (lower.includes('chrome')) {
    return 'Chrome'
  }
  return 'Chrome'
}

/**
 * Maps a launch command/binary to a wmctrl title substring (case-insensitive).
 * @param {string} cmd The launch command name.
 * @returns {?string} The wmctrl `-a` substring, or null when no specific match is known.
 */
function linuxWmctrlTitleForCommand(cmd) {
  const lower = (cmd || '').toLowerCase()
  if (lower.includes('firefox')) {
    return 'firefox'
  }
  if (lower.includes('chromium')) {
    return 'chromium'
  }
  if (lower.includes('chrome')) {
    return 'chrome'
  }
  return null
}

/**
 * Emits best-effort terminal-attention hints to stderr when stderr is a TTY:
 * an ASCII BEL (audio cue), then an OSC 9 desktop notification recognised by
 * iTerm2 and a handful of other terminals. Harmless escape sequences elsewhere.
 * @param {{isTTY?: boolean, write: (s: string) => void}} [stream] The output stream; defaults to process.stderr.
 * @returns {void}
 */
function emitTerminalAttention(stream = process.stderr) {
  if (!stream.isTTY) {
    return
  }
  try {
    stream.write('\x07')
    stream.write('\x1b]9;Sign in to Google in your browser\x07')
  } catch {
    /* ignore */
  }
}

/**
 * Opens the given URL in the user's default browser, with a few platform-aware
 * preferences. Returns `false` (without spawning) on SSH/headless/container
 * environments so the caller can show the paste-URL fallback. Respects
 * `$BROWSER`. On macOS, when `$BROWSER` is unset and Google Chrome is
 * installed, activates Chrome by name so the new tab comes forward. After the
 * launch attempt, also fires a best-effort window-activation spawn (osascript
 * on macOS, PowerShell AppActivate on Windows, wmctrl on Linux when present)
 * and writes a BEL + OSC 9 attention hint to stderr.
 * @param {string} url The URL to open.
 * @param {object} [deps] Injection points for tests.
 * @param {(c: string, a: string[], o: object) => import('node:child_process').ChildProcess} [deps.spawnImpl] Async spawn; defaults to node:child_process spawn.
 * @param {(c: string, a: string[], o: object) => {status: number|null}} [deps.spawnSyncImpl] Sync spawn used for PATH probes; defaults to node:child_process spawnSync.
 * @param {string} [deps.platform] OS platform; defaults to process.platform.
 * @param {{isTTY?: boolean, write: (s: string) => void}} [deps.attentionStream] Stream for BEL/OSC 9 hints; defaults to process.stderr.
 * @param {() => boolean} [deps.canLaunch] Headless/SSH check; defaults to canLaunchBrowser.
 * @returns {Promise<boolean>} Resolves true when the spawn exits 0, false otherwise.
 */
export function defaultOpenBrowser(
  url,
  {
    spawnImpl = spawn,
    spawnSyncImpl = spawnSync,
    platform = process.platform,
    attentionStream = process.stderr,
    canLaunch = canLaunchBrowser,
  } = {},
) {
  if (!canLaunch()) {
    return Promise.resolve(false)
  }
  let cmd
  let args
  if (process.env.BROWSER) {
    cmd = process.env.BROWSER
    args = [url]
  } else if (platform === 'win32') {
    cmd = 'cmd'
    args = ['/c', 'start', '', url]
  } else if (platform === 'darwin') {
    if (isChromeOnMac()) {
      cmd = 'open'
      args = ['-a', 'Google Chrome', url]
    } else {
      cmd = 'open'
      args = [url]
    }
  } else {
    cmd = 'xdg-open'
    args = [url]
  }
  // On macOS the activation target depends on which app `open` will launch.
  // `$BROWSER` (when set) names that binary directly; otherwise the macOS
  // branch above forces Chrome when present and falls back to the user's
  // default. Pass the most specific signal we have.
  const activationCmd = process.env.BROWSER || (platform === 'darwin' && args[0] === '-a' ? args[1] : cmd)
  return new Promise(resolve => {
    let child
    try {
      child = spawnImpl(cmd, args, { detached: true, stdio: 'ignore' })
    } catch {
      resolve(false)
      return
    }
    child.on('error', () => resolve(false))
    child.on('exit', code => resolve(code === 0))
    child.unref?.()
    bringBrowserToFront({ cmd: activationCmd, spawnImpl, spawnSyncImpl, platform })
    emitTerminalAttention(attentionStream)
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
    return new Error('Consent declined. Run mcp auth login again when ready.')
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
      // probe surfaces "Run mcp auth login" remediation so the user
      // re-consents.
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
        throw new Error('No cached managed-OAuth tokens. Run mcp auth login.')
      }
      const client = new OAuth2Client({ clientId, clientSecret })
      client.setCredentials(tokens)
      return client
    },

    buildRemediation(probe) {
      if (!probe || probe.ok) {
        return null
      }
      if (!probe.scopesKnown && probe.missingScopes.length === requiredScopes.length) {
        return ['Run mcp auth login to authenticate.']
      }
      if (probe.missingScopes.length > 0) {
        return [
          `Cached OAuth tokens do not cover ${probe.missingScopes.length} required scope(s):`,
          ...probe.missingScopes.map(s => `  - ${s}`),
          'Re-run mcp auth login to re-consent with the full scope set.',
        ]
      }
      return ['Run mcp auth login to (re)authenticate.']
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
        // When the access token expires, the user re-runs `mcp auth login`.
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
          throw new Error('Consent declined. Run mcp auth login again when ready.')
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
