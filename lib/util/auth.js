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
 * @file Authentication utilities for Google API clients.
 *
 * Three credential sources, mutually exclusive and resolved in this order:
 * 1. Bearer pass-through (`authToken`)—used by HTTP-mode handlers that
 * forward an inbound user ID token to Google.
 * 2. Service-account key via `GOOGLE_APPLICATION_CREDENTIALS`—built into a
 * `JWT` directly (no `GoogleAuth` wrapper), so domain-wide-delegation can
 * be enabled by setting `CEP_IMPERSONATE_SUBJECT` to the user to act as.
 * 3. Cached OAuth-flow tokens written by `mcp auth login`.
 */

import fs from 'node:fs/promises'
import { JWT, OAuth2Client } from 'google-auth-library'
import { TokenCache } from './credential/token_cache.js'
import { isStdioMode } from './gcp.js'
import { SCOPES } from '../constants.js'

/**
 * Module-level cache of JWT credentials, keyed on the inputs that affect
 * token minting. Reusing the same JWT instance across calls preserves
 * google-auth-library's internal access-token cache; rebuilding it would
 * force a fresh IAM round-trip on every getAuthClient() call.
 *
 * Assumes GOOGLE_APPLICATION_CREDENTIALS, CEP_IMPERSONATE_SUBJECT, and the
 * scope set are set at process startup and do not change at runtime. Tests
 * that mutate those env vars between calls reset the cache via
 * `esmock`, which loads a fresh module instance per test.
 * @type {Map<string, JWT>}
 */
const jwtCache = new Map()

/**
 * Builds (or returns a cached) `JWT` credential from a service-account key
 * file. Honors CEP_IMPERSONATE_SUBJECT for domain-wide delegation.
 * @param {string} keyPath - Path to the service-account JSON key file.
 * @param {string[]} scopes - Scopes to request when minting access tokens.
 * @returns {Promise<JWT>} The JWT credential.
 * @throws {Error} If the file cannot be read, is not JSON, or is not an SA key.
 */
async function jwtFromServiceAccountFile(keyPath, scopes) {
  const subject = (process.env.CEP_IMPERSONATE_SUBJECT || '').trim()
  const cacheKey = `${keyPath}\n${subject}\n${[...scopes].sort().join(' ')}`
  const cached = jwtCache.get(cacheKey)
  if (cached) {
    return cached
  }
  let raw
  try {
    raw = await fs.readFile(keyPath, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(
        `GOOGLE_APPLICATION_CREDENTIALS points at ${keyPath}, but no file exists there. ` +
          `Either fix the path or unset the variable to use the OAuth-flow cache.`,
      )
    }
    throw err
  }
  let key
  try {
    key = JSON.parse(raw)
  } catch (err) {
    throw new Error(`GOOGLE_APPLICATION_CREDENTIALS at ${keyPath} is not valid JSON: ${err.message}`)
  }
  if (key.type !== 'service_account') {
    throw new Error(
      `GOOGLE_APPLICATION_CREDENTIALS at ${keyPath} is type "${key.type}", not "service_account". ` +
        `Provide a service-account key file, or unset the variable to use the OAuth-flow cache.`,
    )
  }
  const jwt = new JWT({
    email: key.client_email,
    key: key.private_key,
    scopes,
    subject: subject || undefined,
  })
  jwtCache.set(cacheKey, jwt)
  return jwt
}

/**
 * Returns an authenticated client for Google API calls.
 * @param {string[]} scopes - Scopes the client needs (used by the SA-key path).
 * @param {string} [authToken] - Optional pre-acquired bearer token.
 * @param {object} [apiOptions] - Optional options containing status logging callbacks.
 * @returns {Promise<import('google-auth-library').AuthClient>} An authenticated client.
 * @throws {Error} If no credential source resolves.
 */
export async function getAuthClient(scopes, authToken, apiOptions = {}) {
  if (authToken) {
    const auth = new OAuth2Client()
    auth.setCredentials({ access_token: authToken })
    return auth
  }

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (credPath) {
    return jwtFromServiceAccountFile(credPath, scopes)
  }

  const cache = new TokenCache(TokenCache.defaultPath())
  let tokens = await cache.readEnforcingMode()

  if (tokens) {
    const granted = new Set((tokens.scope || '').split(' ').filter(Boolean))
    const missing = scopes.filter(s => !granted.has(s))
    const expiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null
    const isExpired = expiry && expiry.getTime() < Date.now()

    if (missing.length > 0 || isExpired) {
      tokens = null
    }
  }

  if (!tokens) {
    if (isStdioMode()) {
      const { startToolAuth, canLaunchBrowser } = await import('./credential/auth_login.js')
      if (canLaunchBrowser()) {
        if (apiOptions.onStatusUpdate) {
          apiOptions.onStatusUpdate('Authentication required. Opening browser for Google OAuth consent...')
        }
        const result = await startToolAuth({ scopes: scopes.length > 0 ? scopes : Object.values(SCOPES) })
        if (result.status === 'completed') {
          if (apiOptions.onStatusUpdate) {
            apiOptions.onStatusUpdate('Authorization successful. Tokens cached.')
          }
          tokens = await cache.readEnforcingMode()
        } else {
          throw new Error('Sign-in did not complete inline. Run `mcp auth login` or `cep_auth`.')
        }
      } else {
        throw new Error('Headless environment detected. Please run `cep_auth` tool or `mcp auth login`.')
      }
    } else {
      throw new Error(
        'No Google credentials configured. Either:\n' +
          '  - Run `mcp auth login` to authenticate as yourself (recommended for local use), or\n' +
          '  - Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON key file (Cloud Run / hosted), or\n' +
          '  - Send a Google-issued bearer token in the Authorization header (HTTP transport).',
      )
    }
  }
  const client = new OAuth2Client()
  client.setCredentials(tokens)
  return client
}
