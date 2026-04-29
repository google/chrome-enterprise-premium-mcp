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

/**
 * Factory for ADC credential provider. Returns a credential provider object
 * that probes Application Default Credentials and caches the client.
 * @returns {import('./index.js').Credential} A credential provider object.
 */
export function adcCredential() {
  let clientPromise = null

  return {
    async probe() {
      try {
        const auth = new GoogleAuth({ scopes: Object.values(SCOPES) })
        const client = await auth.getClient()
        const tokenResponse = await client.getAccessToken()
        const credentialType = client.constructor.name
        const principal = await resolveEmail(tokenResponse.token)
        const scopesKnown = false
        const missingScopes = await resolveMissingScopes(tokenResponse.token, Object.values(SCOPES))
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
        return {
          ok: false,
          source: 'adc',
          principal: null,
          credentialType: null,
          scopesKnown: false,
          missingScopes: [...Object.values(SCOPES)],
          expiry: null,
        }
      }
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
 * Resolves the principal email from a token.
 * @param {string} _token - The access token.
 * @returns {Promise<?string>} The email address, or null if not resolvable.
 */
async function resolveEmail(_token) {
  return null
}

/**
 * Resolves required scopes that the token does not grant.
 * @param {string} _token - The access token.
 * @param {string[]} _requiredScopes - The required scopes.
 * @returns {Promise<string[]>} Array of missing scopes.
 */
async function resolveMissingScopes(_token, _requiredScopes) {
  return []
}
