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
