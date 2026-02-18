import { GoogleAuth, OAuth2Client } from 'google-auth-library'
import { getAuthErrorMessage } from './auth-error.js'
import { TAGS } from '../constants.js'

export class GoogleAuthProvider {
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
