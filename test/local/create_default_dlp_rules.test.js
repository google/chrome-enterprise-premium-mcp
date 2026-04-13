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

/**
 * @file Tests for create_default_dlp_rules tool handler.
 */

import assert from 'node:assert/strict'
import { describe, it, mock, beforeEach } from 'node:test'
import esmock from 'esmock'
import { setupCloudIdentityHandler } from './mock-utils.js'

describe('create_default_dlp_rules Tool', () => {
  let server

  beforeEach(async () => {
    server = {
      registerTool: mock.fn(),
    }
  })

  it('should create all default rules correctly', async () => {
    const mockCreateDlpRule = mock.fn(async (customerId, orgUnitId, config) => ({
      response: {
        name: `policies/${config.displayName.replace(/[^a-zA-Z0-9]/g, '')}`,
      },
    }))
    const handler = await setupCloudIdentityHandler(server, 'create_default_dlp_rules', {
      createDlpRule: mockCreateDlpRule,
    })

    const result = await handler(
      {
        customerId: 'C0123',
        orgUnitId: 'ou1',
      },
      { requestInfo: {} },
    )

    // There are 3 default rules defined in the tool
    assert.strictEqual(mockCreateDlpRule.mock.callCount(), 3)
    assert.ok(result.content[0].text.includes('## Default DLP Rules Created (3 of 3 succeeded)'))
    assert.ok(result.content[0].text.includes('- **🤖 Audit visits to generative AI sites** — created'))
    assert.ok(
      result.content[0].text.includes('- **🤖 Watermark sensitive sites (Gmail, Salesforce, Zendesk)** — created'),
    )
    assert.ok(
      result.content[0].text.includes('- **🤖 Warn before pasting on generative AI sites (Gemini allowed)** — created'),
    )
    assert.deepStrictEqual(result.structuredContent.createdRules.length, 3)
  })

  it('should handle partial failures when creating rules', async () => {
    const mockCreateDlpRule = mock.fn(async (customerId, orgUnitId, config) => {
      if (config.displayName.includes('Audit')) {
        throw new Error('API Error')
      }
      return { response: { name: 'policies/success' } }
    })
    const MockCloudIdentityClient = class {
      /**
       *
       */
      constructor() {
        this.createDlpRule = mockCreateDlpRule
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
      apiClients: { cloudIdentity: new MockCloudIdentityClient() },
    })

    const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'create_default_dlp_rules')
      .arguments[2]

    const result = await handler(
      {
        customerId: 'C0123',
        orgUnitId: 'ou1',
      },
      { requestInfo: {} },
    )

    assert.strictEqual(mockCreateDlpRule.mock.callCount(), 3)
    assert.ok(result.content[0].text.includes('## Default DLP Rules Created (2 of 3 succeeded)'))
    assert.ok(result.content[0].text.includes('- **🤖 Audit visits to generative AI sites** — failed (API Error)'))
    assert.ok(
      result.content[0].text.includes('- **🤖 Watermark sensitive sites (Gmail, Salesforce, Zendesk)** — created'),
    )
  })

  it('should return success indicators if all rules fail with "Already exists"', async () => {
    const mockCreateDlpRule = mock.fn(async () => {
      throw new Error('Already exists')
    })
    const MockCloudIdentityClient = class {
      /**
       *
       */
      constructor() {
        this.createDlpRule = mockCreateDlpRule
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

    const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'create_default_dlp_rules')
      .arguments[2]

    const result = await handler(
      {
        customerId: 'C0123',
        orgUnitId: 'ou1',
      },
      { requestInfo: {} },
    )

    assert.strictEqual(result.structuredContent.successCount, 0)
    assert.ok(
      result.content[0].text.includes('- **🤖 Audit visits to generative AI sites** — skipped (Already exists)'),
    )
  })
})
