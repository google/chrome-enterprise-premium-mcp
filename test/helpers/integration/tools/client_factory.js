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

import { RealAdminSdkClient } from '../../../../lib/api/real_admin_sdk_client.js'
import { RealCloudIdentityClient } from '../../../../lib/api/real_cloud_identity_client.js'
import { RealChromePolicyClient } from '../../../../lib/api/real_chrome_policy_client.js'
import { RealChromeManagementClient } from '../../../../lib/api/real_chrome_management_client.js'

import { FakeAdminSdkClient } from '../../../../lib/api/fake_admin_sdk_client.js'
import { FakeCloudIdentityClient } from '../../../../lib/api/fake_cloud_identity_client.js'
import { FakeChromePolicyClient } from '../../../../lib/api/fake_chrome_policy_client.js'
import { FakeChromeManagementClient } from '../../../../lib/api/fake_chrome_management_client.js'
import { FakeServiceUsageClient } from '../../../../lib/api/fake_service_usage_client.js'

/**
 * Factory function to retrieve the appropriate API clients.
 *
 * @param {object} [options] - Options to override environment variables.
 * @param {string} [options.backend] - 'real' or 'fake'.
 * @param {string} [options.rootUrl] - URL for fake API server.
 * @returns {object} An object containing instances of the API clients.
 */
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
    }
  }

  return {
    adminSdk: new FakeAdminSdkClient(rootUrl),
    cloudIdentity: new FakeCloudIdentityClient(rootUrl),
    chromePolicy: new FakeChromePolicyClient(rootUrl),
    chromeManagement: new FakeChromeManagementClient(rootUrl),
    serviceUsage: new FakeServiceUsageClient(rootUrl),
  }
}
