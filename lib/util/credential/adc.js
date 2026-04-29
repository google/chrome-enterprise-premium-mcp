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
 * @returns {import('./index.js').Credential}
 */
export function adcCredential() {
  let cachedClient = null

  return {
    async probe() {
      try {
        const auth = new GoogleAuth({ scopes: Object.values(SCOPES) })
        const client = await auth.getClient()
        const tokenResponse = await client.getAccessToken()
        const credentialType = client.constructor.name
        const principal = await resolveEmail(tokenResponse.token)
        const scopesKnown = !!tokenResponse.token
        const missingScopes = await resolveMissingScopes(tokenResponse.token, Object.values(SCOPES))
        cachedClient = client
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
      if (cachedClient) return cachedClient
      const auth = new GoogleAuth({ scopes: Object.values(SCOPES) })
      cachedClient = await auth.getClient()
      return cachedClient
    },
    buildRemediation(probe, requiredScopes) {
      // Reuse the existing helper. The legacy AdcProbeResult shape is a subset of CredentialProbe.
      return buildAuthRemediationLines(probe, requiredScopes)
    },
  }
}

async function resolveEmail(_token) {
  // Stubbed in this task. Real implementation lands in Task 3 (it currently lives in mcp-server.js).
  return null
}

async function resolveMissingScopes(_token, _requiredScopes) {
  // Stubbed in this task; the real tokeninfo call lives in mcp-server.js today.
  return []
}
