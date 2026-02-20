import { GoogleAuth, OAuth2Client } from 'google-auth-library'
import { getAuthErrorMessage } from './auth-error.js'
import { TAGS } from '../constants.js'

/**
 * Retrieves an authenticated Google Cloud client.
 *
 * Creates an OAuth2 client if an auth token is provided, otherwise uses
 * Application Default Credentials (ADC) with the specified scopes.
 *
 * @param {string[]} scopes - The list of OAuth scopes required for the client.
 * @param {string} [authToken] - An optional OAuth access token to use directly.
 * @returns {Promise<import('google-auth-library').AuthClient>} An authenticated client instance.
 * @throws {Error} If client creation fails or credentials are invalid.
 */
export async function getAuthClient(scopes, authToken) {
    // console.log(`${TAGS.AUTH} Using REAL GoogleAuthProvider`); // Kept for logging
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

/**
 * Verifies that Application Default Credentials (ADC) are set up and valid.
 *
 * attempts to retrieve an access token using the default credentials.
 *
 * @returns {Promise<boolean>} True if credentials are valid, false otherwise.
 */
export async function ensureADCCredentials() {
    // This check is only relevant for the real auth provider
    try {
        const auth = new GoogleAuth()
        const client = await auth.getClient()
        await client.getAccessToken()
        return true
    } catch (error) {
        console.error(`${TAGS.AUTH} ✗ Authentication check failed.`)
        console.error(getAuthErrorMessage(error))
        return false
    }
}

export { getAuthErrorMessage }
