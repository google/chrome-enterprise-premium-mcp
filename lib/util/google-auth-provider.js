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
 * @fileoverview Production auth provider backed by Google Cloud credentials.
 *
 * Wraps google-auth-library to provide OAuth2 or Application Default
 * Credentials, used by the MCP server for all real API calls.
 */

import { GoogleAuth, OAuth2Client } from 'google-auth-library'
import { getAuthErrorMessage } from './auth-error.js'

/**
 * Real implementation of the authentication provider using Google Auth Library.
 */
export class GoogleAuthProvider {
  /**
   * Retrieves an authenticated Google Cloud client.
   * @param {string[]} scopes - The list of OAuth scopes required for the client.
   * @param {string} [authToken] - An optional OAuth access token to use directly.
   * @returns {Promise<import('google-auth-library').AuthClient>} An authenticated client instance.
   * @throws {Error} If client creation fails or credentials are invalid.
   */
  async getAuthClient(scopes, authToken) {
    if (authToken) {
      const auth = new OAuth2Client()
      auth.setCredentials({ access_token: authToken })
      return auth
    }

    const auth = new GoogleAuth({ scopes })
    try {
      return await auth.getClient()
    } catch (error) {
      throw new Error(getAuthErrorMessage(error))
    }
  }
}
