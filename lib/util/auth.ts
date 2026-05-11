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
 * Returns authenticated clients backed by Application Default Credentials
 * (ADC) or, when a bearer is supplied, by that token directly.
 */

import { GoogleAuth, OAuth2Client } from 'google-auth-library'
import { getAuthErrorMessage } from './auth-error.js'
import { TokenCache } from './credential/token_cache.js'

/**
 * Retrieves an authenticated Google Cloud client.
 *
 * Uses Application Default Credentials (ADC) with the supplied scopes. If
 * `authToken` is provided, returns an `OAuth2Client` pre-set with that
 * bearer instead.
 * @param {string[]} scopes - Google API scopes the client needs (used for ADC).
 * @param {string} [authToken] - Optional pre-acquired access token.
 * @returns {Promise<import('google-auth-library').AuthClient>} An authenticated client instance.
 * @throws {Error} If client creation fails or credentials are invalid.
 */
export async function getAuthClient(scopes, authToken) {
  if (authToken) {
    const auth = new OAuth2Client()
    auth.setCredentials({ access_token: authToken })
    return auth
  }

  const auth = new GoogleAuth({ scopes })
  try {
    return await auth.getClient()
  } catch (adcError) {
    const cachePath = TokenCache.defaultPath()
    const cache = new TokenCache(cachePath)
    const tokens = await cache.read()
    if (tokens) {
      if (!(await cache.modeIsTight())) {
        throw new Error(
          `OAuth token cache at ${cachePath} has loose permissions; ` +
            `refusing to read. Run \`chmod 600 ${cachePath}\` to tighten it, ` +
            `or re-run \`mcp auth login\` to recreate the file with mode 0600.`,
        )
      }
      const client = new OAuth2Client()
      client.setCredentials(tokens)
      return client
    }
    throw new Error(await getAuthErrorMessage(adcError))
  }
}

/**
 * Verifies that Application Default Credentials (ADC) are set up and valid
 * by attempting to retrieve an access token.
 * @returns {Promise<boolean>} True if credentials are valid, false otherwise.
 */
export async function ensureADCCredentials() {
  try {
    const auth = new GoogleAuth()
    const client = await auth.getClient()
    await client.getAccessToken()
    return true
  } catch {
    return false
  }
}

export { getAuthErrorMessage }
