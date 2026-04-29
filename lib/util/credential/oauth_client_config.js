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
 * @file Resolves the OAuth client config (client id + secret) for the managed
 * OAuth flow. Either both env-var overrides are set, or neither is, with the
 * bundled Google-managed values used as the default.
 */

import { MANAGED_OAUTH_CLIENT_ID, MANAGED_OAUTH_CLIENT_SECRET } from '../../constants.js'

/**
 * @typedef {object} OAuthClientConfig
 * @property {string} clientId The OAuth client ID.
 * @property {string} clientSecret The OAuth client secret.
 * @property {'managed'|'custom'} source The source of the configuration ('managed' or 'custom').
 */

/**
 * Resolves OAuth client configuration from environment variables or bundled defaults.
 * @param {object} [env] Environment variables object. Defaults to process.env.
 * @returns {OAuthClientConfig} OAuth client configuration object.
 * @throws {Error} When exactly one of the two env vars is set.
 */
export function resolveOAuthClientConfig(env = process.env) {
  const id = env.CEP_OAUTH_CLIENT_ID
  const secret = env.CEP_OAUTH_CLIENT_SECRET
  const idSet = typeof id === 'string' && id.length > 0
  const secretSet = typeof secret === 'string' && secret.length > 0
  if (idSet !== secretSet) {
    throw new Error(
      'Set both CEP_OAUTH_CLIENT_ID and CEP_OAUTH_CLIENT_SECRET, or unset both to use the bundled Google-managed client.',
    )
  }
  if (idSet && secretSet) {
    return { clientId: id, clientSecret: secret, source: 'custom' }
  }
  return {
    clientId: MANAGED_OAUTH_CLIENT_ID,
    clientSecret: MANAGED_OAUTH_CLIENT_SECRET,
    source: 'managed',
  }
}
