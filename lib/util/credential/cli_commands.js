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
 * @file CLI subcommand implementations for the credential layer.
 */

import { oauthFlowCredential } from './oauth_flow.js'

/**
 * Runs the `mcp login` subcommand. Constructs an OAuth flow credential,
 * opens the browser for consent, waits for the token exchange, and writes
 * tokens to the cache.
 * @param {object} [opts] Injection points for testability.
 * @param {() => ReturnType<typeof oauthFlowCredential>} [opts.credentialFactory]
 *   Factory for the OAuth credential; defaults to oauthFlowCredential.
 * @returns {Promise<void>}
 */
export async function runLoginCommand({ credentialFactory = oauthFlowCredential } = {}) {
  const cred = credentialFactory()
  console.log('Opening browser for consent...')
  await cred.runLoginFlow()
  console.log('Tokens cached. Run mcp auth-status to verify.')
}
