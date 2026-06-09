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
 * @file Bearer-token verification used by HTTP-mode middleware.
 *
 * The middleware itself lives in mcp-server.js (it owns the Express
 * res/req plumbing). This module isolates the decision logic so it
 * can be unit-tested without booting an HTTP server.
 */

/**
 * Verify a bearer token against the expected audience and (optionally) a
 * locked principal sub. Returns a plain object describing the outcome —
 * `{ok: true, principal}` on accept, `{ok: false, status, message}` on
 * reject. Callers map the result onto an HTTP response.
 *
 * `verify` is injected so callers can stub it in tests.
 * @param {string} token - The bearer token (without the `Bearer ` prefix).
 * @param {object} options - Verification options.
 * @param {string|string[]} options.expectedAudience - Audience(s) accepted.
 * @param {string} [options.lockedSub] - When non-empty, the principal's `sub` must equal this value, otherwise a 403 result is returned.
 * @param {(token: string, opts: {expectedAudience: string|string[]}) => Promise<object>} options.verify - The token verifier (e.g. `verifyToken`).
 * @returns {Promise<{ok: true, principal: object} | {ok: false, status: number, message: string, error?: Error}>} Verification outcome.
 */
export async function verifyBearerToken(token, { expectedAudience, lockedSub, verify }) {
  let principal
  try {
    principal = await verify(token, { expectedAudience })
  } catch (err) {
    return { ok: false, status: 401, message: 'Bearer token verification failed', error: err }
  }
  if (lockedSub && principal.sub !== lockedSub) {
    return { ok: false, status: 403, message: 'Principal not authorized for this deployment', principal }
  }
  return { ok: true, principal }
}
