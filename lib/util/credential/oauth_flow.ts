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

import { spawn } from 'node:child_process'
import readline from 'node:readline'
import { OAuth2Client, Credentials, OAuth2ClientOptions } from 'google-auth-library'
import { TokenCache } from './token_cache.js'
import { startLoopbackServer } from './loopback_server.js'
import {
  OAUTH_SCOPES,
  MANAGED_OAUTH_CLIENT_ID,
  MANAGED_OAUTH_CLIENT_SECRET,
  MANAGED_OAUTH_CLIENT_PLACEHOLDER,
} from '../../constants.js'
import { Credential, CredentialProbe } from './index.js'
import { isObject, getString, getNumber } from '../helpers.js'

class TransientError extends Error {
  transient = true
}

/**
 * Opens the given URL in the user's default browser. Respects BROWSER env var.
 * @param url The URL to open.
 * @returns Resolves once the browser process spawns, returning true if successful.
 */
function defaultOpenBrowser(url: string): Promise<boolean> {
  let cmd: string
  let args: string[]
  if (process.env.BROWSER) {
    cmd = process.env.BROWSER
    args = [url]
  } else if (process.platform === 'win32') {
    cmd = 'cmd'
    args = ['/c', 'start', '', url]
  } else if (process.platform === 'darwin') {
    cmd = 'open'
    args = [url]
  } else {
    cmd = 'xdg-open'
    args = [url]
  }
  return new Promise(resolve => {
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore' })
    child.on('error', () => resolve(false))
    child.on('exit', code => resolve(code === 0))
    child.unref()
  })
}

/**
 * Extracts the OAuth code from a pasted redirect URL or returns the input as-is.
 * @param input The text the user pasted.
 * @returns The code, or null if the input is empty.
 */
function extractCodeFromPaste(input: string): string | null {
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
 * @param abortSignal Cancels the prompt; the promise resolves with null on abort.
 * @returns The code from the pasted line, or null if aborted.
 */
function readCodeFromStdin(abortSignal?: AbortSignal): Promise<string | null> {
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

interface GoogleApiError {
  response?: {
    data?: {
      error?: string
    }
  }
  message?: string
}

function isGoogleApiError(err: unknown): err is GoogleApiError {
  if (typeof err !== 'object' || err === null) {
    return false
  }
  if ('response' in err && err.response !== undefined) {
    const response = err.response
    if (typeof response !== 'object' || response === null) {
      return false
    }
    if ('data' in response && response.data !== undefined) {
      const data = response.data
      if (typeof data !== 'object' || data === null) {
        return false
      }
    }
  }
  return true
}

/**
 * Maps an OAuth code-exchange error to an actionable Error.
 * @param err The raw error.
 * @param clientId The OAuth client id.
 * @returns An Error with an actionable message.
 */
function mapOAuthError(err: unknown, clientId: string): Error {
  let code = ''
  let message = ''
  if (isGoogleApiError(err)) {
    code = err.response?.data?.error || err.message || ''
    message = err.message || ''
  } else if (err instanceof Error) {
    code = err.message || ''
    message = err.message
  }

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
  return new TransientError(`OAuth token exchange failed: ${message}`)
}

export interface OauthFlowOptions {
  clientId?: string
  clientSecret?: string
  cachePath?: string
  requiredScopes?: string[]
  authUrl?: string
  tokenUrl?: string
}

export interface LoginFlowOptions {
  openBrowser?: (url: string) => Promise<boolean>
  createOAuth2Client?: (cfg: OAuth2ClientOptions) => OAuth2Client
}

interface LoopbackWinner {
  kind: 'loopback'
  code?: string | null
  error?: string | null
}

interface StdinWinner {
  kind: 'stdin'
  code: string | null
}

type Winner = LoopbackWinner | StdinWinner

/**
 * Creates a credential object backed by the managed OAuth flow token cache.
 * @param opts Configuration options.
 * @returns The credential object.
 */
export function oauthFlowCredential({
  clientId = process.env.CEP_OAUTH_CLIENT_ID || MANAGED_OAUTH_CLIENT_ID,
  clientSecret = process.env.CEP_OAUTH_CLIENT_SECRET || MANAGED_OAUTH_CLIENT_SECRET,
  cachePath = TokenCache.defaultPath(),
  requiredScopes = OAUTH_SCOPES,
  authUrl,
  tokenUrl,
}: OauthFlowOptions = {}): Credential & { runLoginFlow: (opts?: LoginFlowOptions) => Promise<Credentials> } {
  const cache = new TokenCache(cachePath)

  return {
    async probe(): Promise<CredentialProbe> {
      const tokens = await cache.read()
      if (!tokens || !isObject(tokens)) {
        return {
          ok: false,
          source: 'oauth-flow',
          principal: null,
          credentialType: null,
          scopesKnown: false,
          missingScopes: requiredScopes,
          expiry: null,
          quotaProject: null,
        }
      }
      const scopeStr = getString(tokens, 'scope') || ''
      const granted = new Set(scopeStr.split(' ').filter(Boolean))
      const missing = requiredScopes.filter(s => !granted.has(s))

      const idToken = getString(tokens, 'id_token')
      const principal = extractEmailFromIdToken(idToken) || null

      const expiryDate = getNumber(tokens, 'expiry_date')
      const expiry = expiryDate ? new Date(expiryDate) : null

      const permissionsWarning = !(await cache.modeIsTight())
      const isExpired = expiry && expiry.getTime() < Date.now()

      if (isExpired) {
        return {
          ok: false,
          source: 'oauth-flow',
          principal,
          credentialType: clientId === MANAGED_OAUTH_CLIENT_ID ? 'managed' : 'custom',
          scopesKnown: true,
          missingScopes: missing,
          expiry,
          quotaProject: null,
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
        quotaProject: null,
      }
    },

    async getClient(): Promise<OAuth2Client> {
      const tokens = await cache.read()
      if (!tokens || !isObject(tokens)) {
        throw new Error('No cached managed-OAuth tokens. Run mcp auth login.')
      }
      const client = new OAuth2Client({ clientId, clientSecret })

      // Construct clean, type-safe Credentials object structurally without casts
      const credentials: Credentials = {
        access_token: getString(tokens, 'access_token'),
        refresh_token: getString(tokens, 'refresh_token'),
        scope: getString(tokens, 'scope'),
        token_type: getString(tokens, 'token_type'),
        expiry_date: getNumber(tokens, 'expiry_date'),
        id_token: getString(tokens, 'id_token'),
      }
      client.setCredentials(credentials)
      return client
    },

    buildRemediation(probe: CredentialProbe): string[] | null {
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

    async runLoginFlow({
      openBrowser = defaultOpenBrowser,
      createOAuth2Client = (cfg: OAuth2ClientOptions) => new OAuth2Client(cfg),
    }: LoginFlowOptions = {}): Promise<Credentials> {
      if (clientId === MANAGED_OAUTH_CLIENT_PLACEHOLDER || clientSecret === MANAGED_OAUTH_CLIENT_PLACEHOLDER) {
        throw new Error(
          'Managed OAuth client is not yet provisioned. ' +
            'Set CEP_OAUTH_CLIENT_ID and CEP_OAUTH_CLIENT_SECRET to bring your own OAuth client, ' +
            'or wait until the bundled managed client is allowlisted for the scopes in lib/constants.js#SCOPES.',
        )
      }
      const server = await startLoopbackServer()
      try {
        const endpoints: Record<string, string> = {}
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

        const consentUrl = oauth2.generateAuthUrl({
          access_type: 'online',
          prompt: 'consent',
          scope: requiredScopes,
        })
        process.stderr.write(`\nOpen this URL to consent:\n\n${consentUrl}\n\n`)
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
        const abort = new AbortController()

        const loopbackPromise: Promise<Winner> = server.waitForCode().then(r => {
          let code: string | null = null
          let error: string | null = null
          if (isObject(r)) {
            code = getString(r, 'code') || null
            error = getString(r, 'error') || null
          }
          const res: LoopbackWinner = {
            kind: 'loopback',
            code,
            error,
          }
          return res
        })

        const stdinPromise: Promise<Winner> = readCodeFromStdin(abort.signal).then(c => {
          const res: StdinWinner = {
            kind: 'stdin',
            code: c,
          }
          return res
        })

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
        let tokens: Credentials
        try {
          const result = await oauth2.getToken(code)
          tokens = result.tokens
        } catch (err) {
          throw mapOAuthError(err, clientId)
        }
        await cache.write({ ...tokens, scope: requiredScopes.join(' ') })
        return tokens
      } finally {
        await server.stop()
      }
    },
  }
}

/**
 * Extracts the email claim from an ID token's payload segment without verification.
 * @param idToken The raw JWT string.
 * @returns The email claim, or null when absent or unparseable.
 */
function extractEmailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) {
    return null
  }
  const parts = idToken.split('.')
  if (parts.length !== 3) {
    return null
  }
  try {
    const payload: unknown = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    if (isObject(payload)) {
      return getString(payload, 'email') || null
    }
  } catch {
    // Ignore parse failures; fall through.
  }
  return null
}
