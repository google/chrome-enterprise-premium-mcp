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
 * @file Verifies inbound bearer ID tokens via google-auth-library JWKS.
 *
 * Use case: the MCP server in HTTP transport mode is at a trust boundary.
 * Without verification, a forged bearer string is forwarded to Google
 * verbatim. Google rejects it, but the server has no proof the bearer's
 * `aud` claim is this MCP instance ahead of the forward.
 *
 * `verifyIdToken` checks signature, `iss`, `exp`, and `aud` against the
 * caller-supplied expected audience set. Returns the verified principal on
 * success. Throws on any failure.
 */

import { OAuth2Client } from 'google-auth-library'

const sharedClient = new OAuth2Client()

export interface VerifiedPrincipal {
  /** The verified user email from the `email` claim. */
  email: string
  /** The verified Google account id from the `sub` claim. */
  sub: string
  /** The audience the token was issued for. */
  aud: string
  /** The issuer (e.g., `https://accounts.google.com`). */
  iss: string
}

/**
 * Verifies a Google-signed ID token.
 * @param token Raw JWT string from `Authorization: Bearer <token>`.
 * @param opts Options.
 * @param opts.expectedAudience Allowed `aud` values; the token's `aud` must match one.
 * @returns The verified principal.
 * @throws On signature, audience, expiry, or issuer mismatch.
 */
export async function verifyIdToken(
  token: string,
  { expectedAudience }: { expectedAudience: string | string[] },
): Promise<VerifiedPrincipal> {
  if (!token || typeof token !== 'string') {
    throw new Error('verifyIdToken: token is required')
  }
  if (!expectedAudience) {
    throw new Error('verifyIdToken: expectedAudience is required')
  }
  const ticket = await sharedClient.verifyIdToken({
    idToken: token,
    audience: expectedAudience,
  })
  const payload = ticket.getPayload()
  if (!payload) {
    throw new Error('verifyIdToken: token payload is empty')
  }
  if (!payload.email) {
    throw new Error('verifyIdToken: token has no email claim')
  }
  return {
    email: payload.email,
    sub: payload.sub,
    aud: payload.aud,
    iss: payload.iss,
  }
}

/**
 * Parses the `CEP_BEARER_AUDIENCE` env var into the form `verifyIdToken`
 * expects: a string, a string[], or undefined when unset.
 * @param raw The env-var value (or undefined).
 * @returns Parsed audience set, or undefined.
 */
export function parseExpectedAudience(raw: string | undefined): string | string[] | undefined {
  if (!raw) {
    return undefined
  }
  const parts = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  if (parts.length === 0) {
    return undefined
  }
  if (parts.length === 1) {
    return parts[0]
  }
  return parts
}
