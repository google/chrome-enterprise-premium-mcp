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

import assert from 'node:assert/strict'
import { describe, it, mock, beforeEach } from 'node:test'
import esmock from 'esmock'
import { registerTools } from '../../../tools/tools.js'
import { FeatureFlags, FLAGS } from '../../../lib/util/feature_flags.js'

describe('Experiment: DELETE_TOOL_ENABLED', () => {
  let server

  beforeEach(() => {
    server = {
      registerTool: mock.fn(),
    }
  })

  it('should register experimental tools when flag is enabled', async () => {
    const flags = new FeatureFlags({ EXPERIMENT_DELETE_TOOL_ENABLED: 'true' })

    registerTools(server, { featureFlags: flags })

    const registeredToolNames = server.registerTool.mock.calls.map(call => call.arguments[0])
    const expectedExperimentalTools = ['delete_agent_dlp_rule', 'delete_detector']

    for (const tool of expectedExperimentalTools) {
      assert.ok(
        registeredToolNames.includes(tool),
        `Experimental tool "${tool}" should be registered when flag is enabled`,
      )
    }
  })

  it('should NOT register experimental tools when flag is disabled', async () => {
    const flags = new FeatureFlags({ EXPERIMENT_DELETE_TOOL_ENABLED: 'false' })

    registerTools(server, { featureFlags: flags })

    const registeredToolNames = server.registerTool.mock.calls.map(call => call.arguments[0])
    const experimentalTools = ['delete_agent_dlp_rule', 'delete_detector']

    for (const tool of experimentalTools) {
      assert.ok(
        !registeredToolNames.includes(tool),
        `Experimental tool "${tool}" should NOT be registered when flag is disabled`,
      )
    }
  })

  describe('Handler Logic (requires experiment enabled)', () => {
    it('should call delete_agent_dlp_rule and return success message', async () => {
      const flags = new FeatureFlags({ EXPERIMENT_DELETE_TOOL_ENABLED: 'true' })
      const mockDeleteDlpRule = mock.fn(async () => ({}))
      const MockCloudIdentityClient = class {
        constructor() {
          this.deleteDlpRule = mockDeleteDlpRule
          this.getDlpRule = mock.fn(async () => ({
            setting: { value: { displayName: '🤖 Test Rule' } },
          }))
        }
      }

      const { registerTools: registerToolsMocked } = await esmock(
        '../../../tools/tools.js',
        {},
        {
          '../../../lib/api/real_cloud_identity_client.js': {
            RealCloudIdentityClient: MockCloudIdentityClient,
          },
        },
      )
      registerToolsMocked(server, {
        gcpCredentialsAvailable: true,
        apiClients: { cloudIdentity: new MockCloudIdentityClient() },
        featureFlags: flags,
      })

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'delete_agent_dlp_rule')
        .arguments[2]
      const result = await handler({ policyName: 'policies/123' }, { requestInfo: {} })

      assert.strictEqual(mockDeleteDlpRule.mock.callCount(), 1)
      assert.ok(result.content[0].text.includes('Successfully deleted Chrome DLP rule: policies/123'))
    })

    it('should call delete_detector and return success message', async () => {
      const flags = new FeatureFlags({ EXPERIMENT_DELETE_TOOL_ENABLED: 'true' })
      const mockDeleteDetector = mock.fn(async () => ({}))
      const MockCloudIdentityClient = class {
        constructor() {
          this.deleteDetector = mockDeleteDetector
        }
      }

      const { registerTools: registerToolsMocked } = await esmock(
        '../../../tools/tools.js',
        {},
        {
          '../../../lib/api/real_cloud_identity_client.js': {
            RealCloudIdentityClient: MockCloudIdentityClient,
          },
        },
      )
      registerToolsMocked(server, {
        gcpCredentialsAvailable: true,
        apiClients: { cloudIdentity: new MockCloudIdentityClient() },
        featureFlags: flags,
      })

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'delete_detector').arguments[2]
      const result = await handler({ policyName: 'policies/456' }, { requestInfo: {} })

      assert.strictEqual(mockDeleteDetector.mock.callCount(), 1)
      assert.ok(result.content[0].text.includes('Successfully deleted detector policy: policies/456'))
    })
  })
})
