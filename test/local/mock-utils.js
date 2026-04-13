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
*/ import esmock from 'esmock'

export async function setupCloudIdentityHandler(server, toolName, clientMethods) {
  const MockCloudIdentityClient = class {
    constructor() {
      Object.assign(this, clientMethods)
    }
  }

  const { registerTools } = await esmock(
    '../../tools/index.js',
    {},
    {
      '../../lib/api/real_cloud_identity_client.js': {
        RealCloudIdentityClient: MockCloudIdentityClient,
      },
    },
  )

  registerTools(server, {
    gcpCredentialsAvailable: true,
    apiClients: { cloudIdentity: new MockCloudIdentityClient() },
  })

  return server.registerTool.mock.calls.find(call => call.arguments[0] === toolName).arguments[2]
}
