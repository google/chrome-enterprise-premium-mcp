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
import { RealAdminSdkClient } from '../../../../lib/api/real_admin_sdk_client.js'
import { RealCloudIdentityClient } from '../../../../lib/api/real_cloud_identity_client.js'
import { RealChromePolicyClient } from '../../../../lib/api/real_chrome_policy_client.js'
import { RealChromeManagementClient } from '../../../../lib/api/real_chrome_management_client.js'
import { RealServiceUsageClient } from '../../../../lib/api/real_service_usage_client.js'

export function getApiClients(options = {}) {
  const backend = options.backend || process.env.CEP_BACKEND || (process.env.GOOGLE_API_ROOT_URL ? 'fake' : 'real')
  const rootUrl = options.rootUrl || process.env.GOOGLE_API_ROOT_URL || 'http://localhost:8008'

  if (backend === 'real') {
    console.log('[FACTORY] Using REAL API clients (Ambient Authority/ADC)')
    return {
      adminSdk: new RealAdminSdkClient(),
      cloudIdentity: new RealCloudIdentityClient(),
      chromePolicy: new RealChromePolicyClient(),
      chromeManagement: new RealChromeManagementClient(),
      serviceUsage: new RealServiceUsageClient(),
    }
  }

  const fakeAuth = new OAuth2Client()
  fakeAuth.setCredentials({ access_token: 'fake-integration-token' })

  return {
    adminSdk: new RealAdminSdkClient({ rootUrl, auth: fakeAuth }),
    cloudIdentity: new RealCloudIdentityClient({ rootUrl, auth: fakeAuth }),
    chromePolicy: new RealChromePolicyClient({ rootUrl, auth: fakeAuth }),
    chromeManagement: new RealChromeManagementClient({ rootUrl, auth: fakeAuth }),
    serviceUsage: new RealServiceUsageClient({ rootUrl, auth: fakeAuth }),
  }
}
