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

import { OAuth2Client } from 'google-auth-library'
import { AdminSdkClient } from '../../../../lib/api/admin_sdk_client.js'
import { CloudIdentityClient } from '../../../../lib/api/cloud_identity_client.js'
import { ChromePolicyClient } from '../../../../lib/api/chrome_policy_client.js'
import { ChromeManagementClient } from '../../../../lib/api/chrome_management_client.js'
import { ServiceUsageClient } from '../../../../lib/api/service_usage_client.js'
import { ApiClients } from '../../../../tools/utils/wrapper.js'

import { FeatureFlags } from '../../../../lib/util/feature_flags.js'

export interface HarnessOptions {
  rootUrl?: string
  backend?: 'fake' | 'real' | (string & {})
  featureFlags?: FeatureFlags
  [key: string]: unknown
}

/**
 * Instantiates and wires the API clients for test integration.
 * Redirects clients to the fake backend when process.env.CEP_BACKEND is 'fake'.
 * @param options Harness configuration options.
 * @returns API clients mapped strictly.
 */
export function getApiClients(options: HarnessOptions = {}): ApiClients {
  const backend = options.backend || process.env.CEP_BACKEND || (process.env.GOOGLE_API_ROOT_URL ? 'fake' : 'real')
  const rootUrl = options.rootUrl || process.env.GOOGLE_API_ROOT_URL || 'http://localhost:8008'

  if (backend === 'real') {
    console.log('[FACTORY] Using REAL API clients (Ambient Authority/ADC)')
    return {
      adminSdk: new AdminSdkClient(),
      cloudIdentity: new CloudIdentityClient(),
      chromePolicy: new ChromePolicyClient(),
      chromeManagement: new ChromeManagementClient(),
      serviceUsage: new ServiceUsageClient(),
    }
  }

  const fakeAuth = new OAuth2Client()
  fakeAuth.setCredentials({ access_token: 'fake-integration-token' })

  return {
    adminSdk: new AdminSdkClient({ rootUrl, auth: fakeAuth }),
    cloudIdentity: new CloudIdentityClient({ rootUrl, auth: fakeAuth }),
    chromePolicy: new ChromePolicyClient({ rootUrl, auth: fakeAuth }),
    chromeManagement: new ChromeManagementClient({ rootUrl, auth: fakeAuth }),
    serviceUsage: new ServiceUsageClient({ rootUrl, auth: fakeAuth }),
  }
}
