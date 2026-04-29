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
 * @file Managed OAuth flow credential factory. Probe + getClient + remediation
 * in this commit; the login flow lands in the next task.
 */

import { OAuth2Client } from 'google-auth-library'
import { TokenCache } from './token_cache.js'
import { SCOPES, MANAGED_OAUTH_CLIENT_ID, MANAGED_OAUTH_CLIENT_SECRET } from '../../constants.js'

/**
 * Creates a credential object backed by the managed OAuth flow token cache.
 * @param {object} [opts] Configuration options.
 * @param {string} [opts.clientId] OAuth client id; defaults to env var or bundled managed client.
 * @param {string} [opts.clientSecret] OAuth client secret.
 * @param {string} [opts.cachePath] Token cache path; defaults to TokenCache.defaultPath().
 * @param {string[]} [opts.requiredScopes] The scope set the probe checks against; defaults to Object.values(SCOPES).
 * @returns {import('./index.js').Credential & {permissionsWarning?: boolean}} The credential object.
 */
export function oauthFlowCredential({
  clientId = process.env.CEP_OAUTH_CLIENT_ID || MANAGED_OAUTH_CLIENT_ID,
  clientSecret = process.env.CEP_OAUTH_CLIENT_SECRET || MANAGED_OAUTH_CLIENT_SECRET,
  cachePath = TokenCache.defaultPath(),
  requiredScopes = Object.values(SCOPES),
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
          `Cached OAuth tokens do not cover ${probe.missingScopes.length} required scope(s).`,
          'Re-run mcp auth login to re-consent with the full scope set.',
        ]
      }
      return ['Run mcp auth login to (re)authenticate.']
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
