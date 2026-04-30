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
import { OAuth2Client } from 'google-auth-library'
import { TokenCache } from './token_cache.js'
import { startLoopbackServer } from './loopback_server.js'
import {
  SCOPES,
  MANAGED_OAUTH_CLIENT_ID,
  MANAGED_OAUTH_CLIENT_SECRET,
  MANAGED_OAUTH_CLIENT_PLACEHOLDER,
} from '../../constants.js'

/**
 * Opens the given URL in the user's default browser. Respects BROWSER env var.
 * Falls back to xdg-open (Linux), open (macOS), or start (Windows).
 * @param {string} url The URL to open.
 * @returns {Promise<void>} Resolves once the browser process spawns.
 */
function defaultOpenBrowser(url) {
  let cmd
  let args
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
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore' })
    child.on('error', reject)
    child.unref()
    resolve()
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
    return new Error(
      `OAuth client ${clientId} does not allow http://127.0.0.1 as a redirect URI. ` +
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
 * @param {string[]} [opts.requiredScopes] The scope set the probe checks against; defaults to Object.values(SCOPES).
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
      // Refresh logic lives in Task 19. For now: if expired, probe is not ok.
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
     * @returns {Promise<object>} The token object returned by the code exchange.
     */
    async runLoginFlow({ openBrowser = defaultOpenBrowser, createOAuth2Client = cfg => new OAuth2Client(cfg) } = {}) {
      if (clientId === MANAGED_OAUTH_CLIENT_PLACEHOLDER || clientSecret === MANAGED_OAUTH_CLIENT_PLACEHOLDER) {
        throw new Error(
          'Managed OAuth client is not yet provisioned. ' +
            'Set CEP_OAUTH_CLIENT_ID and CEP_OAUTH_CLIENT_SECRET to bring your own OAuth client, ' +
            'or wait until the bundled managed client is allowlisted for the scopes in lib/constants.js#SCOPES.',
        )
      }
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
        const consentUrl = oauth2.generateAuthUrl({
          access_type: 'offline',
          prompt: 'consent',
          scope: requiredScopes,
        })
        await openBrowser(consentUrl)
        const { code, error } = await server.waitForCode()
        if (error === 'access_denied') {
          throw new Error('Consent declined. Run mcp auth login again when ready.')
        }
        if (error) {
          throw new Error(`Consent failed: ${error}`)
        }
        let tokens
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
