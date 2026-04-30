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
 * @file Web-redirect OAuth credential factory for the Cloud Run + Gemini
 * Enterprise topology. The redirect URI defaults to the Vertex AI Agent
 * Engine endpoint. The runtime drives the consent flow (no loopback server
 * here); this factory exposes generateConsentUrl(state) and exchangeCode(code)
 * so the runtime can fan the OAuth dance through its own UI.
 *
 * Token storage is pluggable. The default is in-memory (single-instance
 * lifetime). A real deployment plugs in the runtime's session-scoped storage.
 *
 * Refresh-token policy matches oauth_flow.js: no refresh_token is persisted.
 * On access-token expiry, the runtime re-consents.
 *
 * Reference pattern: ADK + OAuth + Gemini Enterprise
 * (https://fmind.medium.com/powering-up-your-agent-in-production-with-adk-oauth-and-gemini-enterprise-a52b0716fcba).
 */

import { OAuth2Client } from 'google-auth-library'
import { SCOPES_OAUTH } from '../../constants.js'

export const VERTEX_AGENT_ENGINE_REDIRECT_URI = 'https://vertexaisearch.cloud.google.com/oauth-redirect'

/**
 * Returns a fresh in-memory token storage instance.
 * @returns {{get: () => Promise<object|null>, set: (tokens: object) => Promise<void>, clear: () => Promise<void>}}
 */
export function inMemoryStorage() {
  let value = null
  return {
    async get() {
      return value
    },
    async set(tokens) {
      value = tokens
    },
    async clear() {
      value = null
    },
  }
}

/**
 * Web-redirect OAuth credential factory. The runtime drives consent through
 * its own UI; this factory just generates the consent URL, exchanges the
 * returned code, and exposes the resulting auth client.
 *
 * @param {object} [opts] Configuration options.
 * @param {string} [opts.clientId] OAuth client id; defaults to CEP_OAUTH_CLIENT_ID env var.
 * @param {string} [opts.clientSecret] OAuth client secret; defaults to CEP_OAUTH_CLIENT_SECRET env var.
 * @param {string} [opts.redirectUri] OAuth redirect URI. Defaults to the Vertex AI Agent Engine endpoint.
 * @param {string[]} [opts.requiredScopes] Scope list; defaults to Object.values(SCOPES_OAUTH).
 * @param {{get: () => Promise<object|null>, set: (tokens: object) => Promise<void>, clear: () => Promise<void>}} [opts.storage] Token storage. Defaults to a fresh in-memory instance.
 * @param {(cfg: object) => OAuth2Client} [opts.createOAuth2Client] OAuth2Client factory; defaults to the real constructor. Tests stub it.
 * @returns {object} The credential object plus generateConsentUrl and exchangeCode hooks.
 */
export function webOauthFlowCredential({
  clientId = process.env.CEP_OAUTH_CLIENT_ID,
  clientSecret = process.env.CEP_OAUTH_CLIENT_SECRET,
  redirectUri = VERTEX_AGENT_ENGINE_REDIRECT_URI,
  requiredScopes = Object.values(SCOPES_OAUTH),
  storage = inMemoryStorage(),
  createOAuth2Client = cfg => new OAuth2Client(cfg),
} = {}) {
  function newClient() {
    return createOAuth2Client({ clientId, clientSecret, redirectUri })
  }

  return {
    async probe() {
      const tokens = await storage.get()
      if (!tokens) {
        return {
          ok: false,
          source: 'web-oauth-flow',
          principal: null,
          credentialType: 'custom',
          scopesKnown: false,
          missingScopes: requiredScopes,
          expiry: null,
        }
      }
      const granted = new Set((tokens.scope || '').split(' ').filter(Boolean))
      const missing = requiredScopes.filter(s => !granted.has(s))
      const expiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null
      const isExpired = expiry && expiry.getTime() < Date.now()
      if (isExpired) {
        return {
          ok: false,
          source: 'web-oauth-flow',
          principal: null,
          credentialType: 'custom',
          scopesKnown: true,
          missingScopes: missing,
          expiry,
        }
      }
      return {
        ok: missing.length === 0,
        source: 'web-oauth-flow',
        principal: null,
        credentialType: 'custom',
        scopesKnown: true,
        missingScopes: missing,
        expiry,
      }
    },

    async getClient() {
      const tokens = await storage.get()
      if (!tokens) {
        throw new Error('No web-OAuth tokens in storage. Runtime must complete consent first.')
      }
      const client = newClient()
      client.setCredentials(tokens)
      return client
    },

    buildRemediation(probe) {
      if (!probe || probe.ok) return null
      if (!probe.scopesKnown && probe.missingScopes.length === requiredScopes.length) {
        return ['Runtime has not completed consent. Direct the user through the consent flow.']
      }
      if (probe.missingScopes.length > 0) {
        return [
          `Stored tokens do not cover ${probe.missingScopes.length} required scope(s).`,
          'Re-consent with the full scope set.',
        ]
      }
      return ['Stored access token has expired. Re-consent.']
    },

    /**
     * Generates the OAuth consent URL for the runtime to redirect the user to.
     * @param {string} [state] Opaque state value the runtime correlates with the redirect.
     * @returns {string} The consent URL.
     */
    generateConsentUrl(state) {
      const client = newClient()
      return client.generateAuthUrl({
        access_type: 'online',
        prompt: 'consent',
        scope: requiredScopes,
        ...(state ? { state } : {}),
      })
    },

    /**
     * Exchanges an authorization code (returned to the redirect URI by Google)
     * for tokens, strips refresh_token (policy: no refresh persistence),
     * stores the rest, and returns the access-token shape.
     * @param {string} code Authorization code from the redirect.
     * @returns {Promise<object>} The token object minus refresh_token.
     */
    async exchangeCode(code) {
      const client = newClient()
      const { tokens } = await client.getToken(code)
      const { refresh_token: _drop, ...persisted } = tokens
      await storage.set(persisted)
      return persisted
    },

    /**
     * Clears stored tokens (e.g. on session end or revocation).
     * @returns {Promise<void>} Resolves when the storage is cleared.
     */
    async clear() {
      await storage.clear()
    },
  }
}
