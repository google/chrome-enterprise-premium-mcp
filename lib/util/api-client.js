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
