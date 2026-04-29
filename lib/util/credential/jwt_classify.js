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
 * @file Bearer-token classifier. Distinguishes Google access tokens
 * from OIDC ID tokens.
 */

/**
 * Classifies a bearer token as 'access' or 'id'. Any input that is not
 * a parseable JWT is treated as an opaque access token.
 * @param {string} token The bearer-token string from the Authorization header.
 * @returns {'access'|'id'} The token kind.
 */
export function classifyBearer(token) {
  const parts = token.split('.')
  if (parts.length !== 3) {
    return 'access'
  }
  let payload
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  } catch {
    return 'access'
  }
  if (typeof payload.scope === 'string' && payload.scope.length > 0) {
    return 'access'
  }
  if (typeof payload.email === 'string' && payload.email.length > 0) {
    return 'id'
  }
  return 'access'
}
