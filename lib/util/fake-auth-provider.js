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

import { TAGS } from '../constants.js'
import axios from 'axios'
import { URL } from 'url' // Import URL

/**
 * A mock authentication provider for testing purposes.
 */
export class FakeAuthProvider {
  /**
   * Returns a fake auth client that redirects requests to a mock GAPI server.
   * @param {string[]} _scopes - The list of OAuth scopes (unused in this provider).
   * @param {string} [_authToken] - An optional OAuth access token (unused in this provider).
   * @returns {Promise<object>} An object simulating a Google AuthClient.
   * @throws {Error} Never throws directly, but matches the signature of real providers.
   */
  async getAuthClient(_scopes, _authToken) {
    const rootUrl = process.env.GAPI_ROOT_URL

    return {
      request: async opts => {
        const originalUrl = new URL(opts.url)
        // Construct the new URL by combining the GAPI_ROOT_URL with the pathname and search params from the original URL.
        const targetUrl = new URL(originalUrl.pathname + originalUrl.search, rootUrl)

        const method = opts.method || 'GET'
        const headers = { ...opts.headers }
        const data = opts.data

        // Ensure Content-Type is set if there's data
        if (data && !headers['Content-Type']) {
          headers['Content-Type'] = 'application/json'
        }

        try {
          const response = await axios({
            method: method,
            url: targetUrl.href, // Use the re-constructed URL
            headers: headers,
            data: data,
            validateStatus: () => true, // Don't throw on non-2xx codes
          })
          return { data: response.data, status: response.status, headers: response.headers }
        } catch (error) {
          console.error(`${TAGS.AUTH} FakeAuthProvider.request error: ${error.message}`, error)
          // Simulate a network error response
          return { data: { error: error.message }, status: 500, headers: {} }
        }
      },
      getAccessToken: async () => ({ token: 'fake-test-token' }),
      projectId: 'fake-project',
    }
  }
}
