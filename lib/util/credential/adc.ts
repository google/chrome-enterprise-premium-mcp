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

import { GoogleAuth, JWT, AuthClient } from 'google-auth-library'
import { SCOPES } from '../../constants.js'
import { buildAuthRemediationLines } from '../auth_messages.js'
import { Credential, CredentialProbe } from './index.js'
import { isObject, getString } from '../helpers.js'

/** Cap the two-network-call probe so a slow or offline environment does not stall boot. */
const PROBE_TIMEOUT_MS = 8000

const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo'

/**
 * Factory for ADC credential provider. Returns a credential provider object
 * that probes Application Default Credentials and caches the client.
 * @returns A credential provider object.
 */
export function adcCredential(): Credential {
  let clientPromise: Promise<AuthClient> | null = null

  const requiredScopes = Object.values(SCOPES)

  // Test-mode short-circuit: no network calls during fake-API runs.
  const empty: CredentialProbe = {
    ok: false,
    source: 'adc',
    principal: null,
    credentialType: null,
    scopesKnown: false,
    missingScopes: [...requiredScopes],
    quotaProject: null,
    expiry: null,
  }

  return {
    async probe(): Promise<CredentialProbe> {
      // Test-mode short-circuit: no network calls during fake-API runs.
      if (process.env.GOOGLE_API_ROOT_URL) {
        return empty
      }

      const work = (async (): Promise<CredentialProbe> => {
        try {
          const auth = new GoogleAuth({ scopes: requiredScopes })
          const client = await auth.getClient()
          const { token } = await client.getAccessToken()
          if (!token) {
            return empty
          }

          const credentialType = client.constructor?.name || null

          // Use instanceof type guard to safely check for email property on JWT clients
          const clientEmail = client instanceof JWT ? client.email : null
          const principal = await resolveEmail(token, clientEmail || null)

          const { scopesKnown, missingScopes } = await resolveScopes(token, requiredScopes)
          const quotaProject = process.env.GOOGLE_CLOUD_QUOTA_PROJECT || client.quotaProjectId || null

          clientPromise = Promise.resolve(client)
          return {
            ok: missingScopes.length === 0,
            source: 'adc',
            principal,
            credentialType,
            scopesKnown,
            missingScopes,
            quotaProject,
            expiry: null,
          }
        } catch {
          return empty
        }
      })()

      let timer: NodeJS.Timeout | undefined
      const timeout = new Promise<CredentialProbe>(resolve => {
        timer = setTimeout(() => resolve(empty), PROBE_TIMEOUT_MS)
      })
      const result = await Promise.race([work, timeout])
      if (timer) {
        clearTimeout(timer)
      }
      return result
    },

    async getClient(): Promise<AuthClient> {
      if (!clientPromise) {
        const auth = new GoogleAuth({ scopes: requiredScopes })
        clientPromise = auth.getClient()
      }
      return clientPromise
    },

    buildRemediation(probe: CredentialProbe, requiredScopes: string[]): string[] | null {
      return buildAuthRemediationLines(probe, requiredScopes)
    },
  }
}

/**
 * Resolves the principal email from the tokeninfo endpoint, falling back to
 * the client-supplied email (available on service-account JWT clients).
 * @param token The access token.
 * @param clientEmail Email from the auth client, if any.
 * @returns The email address, or null if not resolvable.
 */
async function resolveEmail(token: string, clientEmail: string | null): Promise<string | null> {
  try {
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    const res = await globalThis.fetch(`${TOKENINFO_URL}?access_token=${encodeURIComponent(token)}`)
    if (res.ok) {
      const data = await res.json()
      if (isObject(data)) {
        return clientEmail || getString(data, 'email') || null
      }
    }
  } catch {
    // Network or parse failure; fall through.
  }
  return clientEmail
}

/**
 * Queries the tokeninfo endpoint for the granted scope list, then diffs it
 * against the required scopes.
 * @param token The access token.
 * @param required Scopes the server needs.
 * @returns Scope check result.
 */
async function resolveScopes(
  token: string,
  required: string[],
): Promise<{ scopesKnown: boolean; missingScopes: string[] }> {
  try {
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    const res = await globalThis.fetch(`${TOKENINFO_URL}?access_token=${encodeURIComponent(token)}`)
    if (res.ok) {
      const data = await res.json()
      if (isObject(data)) {
        const scopeStr = getString(data, 'scope')
        const granted = scopeStr ? scopeStr.split(' ') : []
        const missingScopes = diffScopes(granted, required)
        return { scopesKnown: true, missingScopes }
      }
    }
  } catch {
    // tokeninfo rejects opaque or self-signed JWT tokens; surface as unknown.
  }
  return { scopesKnown: false, missingScopes: [...required] }
}

/**
 * Diffs granted scopes against required scopes, applying the cloud-platform
 * implicit-scope rule.
 * @param granted Scopes the token actually grants.
 * @param required Scopes the server needs.
 * @returns Required scopes not covered by the token.
 */
function diffScopes(granted: string[], required: string[]): string[] {
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
