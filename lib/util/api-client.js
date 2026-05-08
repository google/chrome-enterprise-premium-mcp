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
 * @file Factory for creating authenticated Google API client instances.
 */

import { getAuthClient } from './auth.js'

/**
 * Creates a Google API client instance.
 * @param {(...args: unknown[]) => unknown} service - The googleapis service function (e.g., google.admin, google.chromemanagement).
 * @param {string} version - The API version.
 * @param {string[]} scopes - OAuth scopes required.
 * @param {string} [authToken] - Optional auth token.
 * @param {object} [apiOptions] - Additional options (e.g. rootUrl).
 * @returns {Promise<{client: object, source: string}>} An object containing the API service client instance and its credential source.
 * @throws {Error} If authentication or client creation fails.
 */
export async function createApiClient(service, version, scopes, authToken, apiOptions = {}) {
  let authClient = apiOptions.auth
  let source = 'provided'
  if (!authClient) {
    const result = await getAuthClient(scopes, authToken, apiOptions)
    authClient = result.client
    source = result.source
  }

  const options = {
    version: version,
    auth: authClient,
    ...apiOptions,
  }

  const client = service(options)
  return { client, source }
}
