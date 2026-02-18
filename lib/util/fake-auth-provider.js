import { TAGS } from '../constants.js'
import axios from 'axios'
import { URL } from 'url' // Import URL

export class FakeAuthProvider {
    async getAuthClient(scopes, authToken) {
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
