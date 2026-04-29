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
 * @file ADC factory. Wraps Application Default Credentials in the Credential contract.
 */

import { GoogleAuth } from 'google-auth-library'
import { SCOPES } from '../../constants.js'
import { buildAuthRemediationLines } from '../auth_messages.js'

/** Cap the two-network-call probe so a slow or offline environment does not stall boot. */
const PROBE_TIMEOUT_MS = 8000

const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo'

/**
 * Factory for ADC credential provider. Returns a credential provider object
 * that probes Application Default Credentials and caches the client.
 * @returns {import('./index.js').Credential} A credential provider object.
 */
export function adcCredential() {
  let clientPromise = null

  return {
    async probe() {
      const requiredScopes = Object.values(SCOPES)

      // Test-mode short-circuit: no network calls during fake-API runs.
      if (process.env.GOOGLE_API_ROOT_URL) {
        return {
          ok: false,
          source: 'adc',
          principal: null,
          credentialType: null,
          scopesKnown: false,
          missingScopes: [],
          expiry: null,
        }
      }

      const empty = {
        ok: false,
        source: 'adc',
        principal: null,
        credentialType: null,
        scopesKnown: false,
        missingScopes: [...requiredScopes],
        expiry: null,
      }

      const work = (async () => {
        try {
          const auth = new GoogleAuth({ scopes: requiredScopes })
          const client = await auth.getClient()
          const { token } = await client.getAccessToken()
          if (!token) {
            return empty
          }

          const credentialType = client.constructor?.name || null
          const principal = await resolveEmail(token, client.email || null)
          const { scopesKnown, missingScopes } = await resolveScopes(token, requiredScopes)

          clientPromise = Promise.resolve(client)
          return {
            ok: missingScopes.length === 0,
            source: 'adc',
            principal,
            credentialType,
            scopesKnown,
            missingScopes,
            expiry: null,
          }
        } catch {
          return empty
        }
      })()

      let timer
      const timeout = new Promise(resolve => {
        timer = setTimeout(() => resolve(empty), PROBE_TIMEOUT_MS)
      })
      const result = await Promise.race([work, timeout])
      clearTimeout(timer)
      return result
    },

    async getClient() {
      if (!clientPromise) {
        const auth = new GoogleAuth({ scopes: Object.values(SCOPES) })
        clientPromise = auth.getClient()
      }
      return clientPromise
    },

    buildRemediation(probe, requiredScopes) {
      return buildAuthRemediationLines(probe, requiredScopes)
    },
  }
}

/**
 * Resolves the principal email from the tokeninfo endpoint, falling back to
 * the client-supplied email (available on service-account JWT clients).
 * @param {string} token - The access token.
 * @param {string|null} clientEmail - Email from the auth client, if any.
 * @returns {Promise<?string>} The email address, or null if not resolvable.
 */
async function resolveEmail(token, clientEmail) {
  try {
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    const res = await globalThis.fetch(`${TOKENINFO_URL}?access_token=${encodeURIComponent(token)}`)
    if (res.ok) {
      const data = await res.json()
      return clientEmail || data.email || null
    }
  } catch {
    // Network or parse failure; fall through.
  }
  return clientEmail
}

/**
 * Queries the tokeninfo endpoint for the granted scope list, then diffs it
 * against the required scopes. The cloud-platform implicit-scope rule applies:
 * a granted `cloud-platform` scope satisfies any `service.management*`
 * requirement (matches Google's IAM behavior).
 *
 * Returns `scopesKnown: false` when tokeninfo could not be reached or rejected
 * the token (e.g. some self-signed JWT flows).
 * @param {string} token - The access token.
 * @param {string[]} required - Scopes the server needs.
 * @returns {Promise<{scopesKnown: boolean, missingScopes: string[]}>} Scope check result.
 */
async function resolveScopes(token, required) {
  try {
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    const res = await globalThis.fetch(`${TOKENINFO_URL}?access_token=${encodeURIComponent(token)}`)
    if (res.ok) {
      const data = await res.json()
      const granted = data.scope ? data.scope.split(' ') : []
      const missingScopes = diffScopes(granted, required)
      return { scopesKnown: true, missingScopes }
    }
  } catch {
    // tokeninfo rejects opaque or self-signed JWT tokens; surface as unknown.
  }
  return { scopesKnown: false, missingScopes: [...required] }
}

/**
 * Diffs granted scopes against required scopes, applying the cloud-platform
 * implicit-scope rule.
 * @param {string[]} granted - Scopes the token actually grants.
 * @param {string[]} required - Scopes the server needs.
 * @returns {string[]} Required scopes not covered by the token.
 */
function diffScopes(granted, required) {
  const grantedSet = new Set(granted)
  const hasCloudPlatform = grantedSet.has('https://www.googleapis.com/auth/cloud-platform')
  return required.filter(s => {
    if (grantedSet.has(s)) {
      return false
    }
    if (hasCloudPlatform && s.startsWith('https://www.googleapis.com/auth/service.management')) {
      return false
    }
    return true
  })
}
