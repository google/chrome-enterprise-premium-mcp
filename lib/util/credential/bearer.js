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
 * @file Bearer token factory. Wraps a static access token in the Credential contract.
 */

import { OAuth2Client } from 'google-auth-library'

/**
 * Factory for bearer token credential provider. Returns a credential provider object
 * that treats a static access token as an available credential (access-token branch only).
 * @param {string} token - The bearer access token.
 * @returns {import('./index.js').Credential} A credential provider object.
 */
export function bearerCredential(token) {
  return {
    async probe() {
      return {
        ok: true,
        source: 'bearer-access',
        principal: null,
        credentialType: null,
        scopesKnown: false,
        missingScopes: [],
        expiry: null,
      }
    },
    async getClient() {
      const auth = new OAuth2Client()
      auth.setCredentials({ access_token: token })
      return auth
    },
    buildRemediation(_probe, _requiredScopes) {
      return null
    },
  }
}
