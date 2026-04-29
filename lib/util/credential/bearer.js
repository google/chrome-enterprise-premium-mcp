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
 * @file Bearer token factory. Detects access tokens and OIDC ID tokens,
 * routing each to the appropriate auth path.
 */

import { OAuth2Client, JWT } from 'google-auth-library'
import { jwtVerify } from 'jose'
import { classifyBearer } from './jwt_classify.js'
import { JwkCache } from './jwk_cache.js'
import { SCOPES } from '../../constants.js'

const GOOGLE_JWKS = new JwkCache('https://www.googleapis.com/oauth2/v3/certs')

/**
 * Factory for bearer token credential provider. Classifies the token at
 * construction time. Access tokens go through OAuth2Client; ID tokens are
 * verified against Google's JWK set and drive DWD impersonation via JWT.
 * @param {string} token The bearer token from the Authorization header.
 * @param {object} [opts] Options.
 * @param {string} [opts.requestHost] The request Host header value, used to derive the expected audience.
 * @param {string} [opts.expectedAudience] Explicit audience to validate against; overrides requestHost derivation.
 * @param {import('jose').JWTVerifyGetKey} [opts.jwks] JWKS resolver; defaults to Google's public key endpoint.
 * @param {import('google-auth-library').JWT} [opts.jwtClient] Pre-built JWT client for DWD; skips `new JWT()`
 *   and `authorize()`. Test-only — production callers omit this option.
 * @returns {import('./index.js').Credential} The credential object.
 */
export function bearerCredential(
  token,
  {
    requestHost,
    expectedAudience = process.env.CEP_OAUTH_EXPECTED_AUDIENCE,
    jwks = GOOGLE_JWKS.jwks,
    jwtClient: injectedJwtClient,
  } = {},
) {
  const kind = classifyBearer(token)

  return {
    async probe() {
      return {
        ok: true,
        source: kind === 'id' ? 'bearer-id' : 'bearer-access',
        principal: null,
        credentialType: null,
        scopesKnown: false,
        missingScopes: [],
        expiry: null,
      }
    },

    async getClient() {
      if (kind === 'access') {
        const auth = new OAuth2Client()
        auth.setCredentials({ access_token: token })
        return auth
      }

      const audience = expectedAudience || (requestHost ? `https://${requestHost}` : undefined)

      let payload
      try {
        const verified = await jwtVerify(token, jwks, {
          issuer: ['https://accounts.google.com', 'accounts.google.com'],
          audience,
        })
        payload = verified.payload
      } catch (err) {
        if (err.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED' && err.claim === 'aud') {
          throw new Error(
            'ID token audience does not match this server. Verify the client is calling the correct service URL.',
          )
        }
        throw new Error(
          "Bearer is an OIDC ID token, but the signature does not verify against Google's public keys. Reject as unauthenticated.",
        )
      }

      if (injectedJwtClient) {
        return injectedJwtClient
      }

      const jwtClient = new JWT({ subject: payload.email, scopes: Object.values(SCOPES) })
      try {
        await jwtClient.authorize()
      } catch {
        throw new Error(
          "Server cannot impersonate the requesting user. Configure domain-wide delegation for the server's service account in the Workspace Admin Console with the scopes from lib/constants.js#SCOPES.",
        )
      }

      return jwtClient
    },

    buildRemediation: () => null,
  }
}
