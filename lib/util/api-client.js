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

import { google } from 'googleapis'
import { getAuthClient } from './auth.js'
import { TAGS } from '../constants.js'

/**
 * Creates a Google API client instance.
 * @param {Function} service - The googleapis service function (e.g., google.admin, google.chromemanagement).
 * @param {string} version - The API version.
 * @param {string[]} scopes - OAuth scopes required.
 * @param {string} [authToken] - Optional auth token.
 * @param {object} [apiOptions={}] - Additional options (currently not used for rootUrl here).
 * @returns {Promise<object>} The API service client instance.
 */
export async function createApiClient(service, version, scopes, authToken, apiOptions = {}) {
  const authClient = await getAuthClient(scopes, authToken)

  const options = {
    version: version,
    auth: authClient,
  }

  const client = service(options)
  return client
}
