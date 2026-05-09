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
*/ /*
Copyright 2026 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
/usr/local/google/home/feel/chrome-enterprise-premium-mcp/lib/util/api-client.ts
*/

/**
 * @file Factory for creating authenticated Google API client instances.
 */

import { getAuthClient } from './auth.js'
import { OAuth2Client } from 'google-auth-library'

export interface ApiOptions {
  auth?: OAuth2Client
  rootUrl?: string
  [key: string]: unknown
}

export interface ApiClientOptions {
  version: string
  auth: OAuth2Client | undefined
  rootUrl?: string
  [key: string]: unknown
}

/**
 * Creates a Google API client instance.
 * @param service The googleapis service function (e.g., google.admin, google.chromemanagement).
 * @param version The API version.
 * @param scopes OAuth scopes required.
 * @param authToken Optional auth token.
 * @param apiOptions Additional options (e.g. rootUrl).
 * @returns The API service client instance.
 */
export async function createApiClient<T>(
  service: (options: ApiClientOptions) => T,
  version: string,
  scopes: string[],
  authToken?: string,
  apiOptions: ApiOptions = {},
): Promise<T> {
  let authClient: OAuth2Client | undefined = apiOptions.auth
  if (!authClient) {
    authClient = await getAuthClient(scopes, authToken)
  }

  const options: ApiClientOptions = {
    version: version,
    auth: authClient,
    ...apiOptions,
  }

  const client = service(options)
  return client
}
