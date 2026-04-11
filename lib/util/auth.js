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

import { GoogleAuth, OAuth2Client } from 'google-auth-library'
import { getAuthErrorMessage } from './auth-error.js'
import { TAGS } from '../constants.js'

/**
 * Retrieves an authenticated Google Cloud client.
 *
 * Creates an OAuth2 client if an auth token is provided, otherwise uses
 * Application Default Credentials (ADC) with the specified scopes.
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
 * Verifies the validity of an access token and checks the audience.
 * @param {string} accessToken - The access token to verify.
 * @param {string} [audience] - Audience to check against the token's audience.
 * @returns {Promise<object>} - The token info if valid.
 * @throws {Error} - If the token is invalid or the audience does not match.
 */
export async function verifyToken(accessToken, audience) {
  try {
    const auth = new OAuth2Client()
    const tokenInfo = await auth.getTokenInfo(accessToken)

    if (audience && tokenInfo.aud !== audience) {
      throw new Error(`Invalid audience: expected ${audience}`)
    }

    return tokenInfo
  } catch (error) {
    console.error(`${TAGS.AUTH} Error verifying access token:`, error.message)
    throw error
  }
}

/**
 * Verifies that Application Default Credentials (ADC) are set up and valid.
 *
 * attempts to retrieve an access token using the default credentials.
 * @returns {Promise<boolean>} True if credentials are valid, false otherwise.
 * @throws {Error} Never throws directly, but logs authentication errors to console.
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

/**
 * Middleware to check for OAuth token if OAuth is enabled.
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The next middleware function.
 * @returns {void} Nothing.
 */
export const oauthMiddleware = async (req, res, next) => {
  const TOOLS_CALL_METHOD = 'tools/call'
  const oauthEnabled = process.env.OAUTH_ENABLED === 'true'

  // Only enforce OAuth for tool calls if enabled
  if (!oauthEnabled || !req.body || req.body.method !== TOOLS_CALL_METHOD) {
    return next()
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Authentication required. Please provide a Bearer token.',
      },
      id: req.body.id || null,
    })
  }

  const token = authHeader.substring(7)
  try {
    const audience = process.env.GOOGLE_OAUTH_AUDIENCE
    await verifyToken(token, audience)
    next()
  } catch (error) {
    res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Invalid or expired token.',
        data: error.message,
      },
      id: req.body.id || null,
    })
  }
}

export { getAuthErrorMessage }
