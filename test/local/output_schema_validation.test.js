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

import { describe, test, before } from 'node:test'
import assert from 'node:assert/strict'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerTools } from '../../tools/index.js'

describe('Output Schema Validation', () => {
  let server
  const registeredTools = new Map()

  before(() => {
    server = new McpServer({ name: 'test-server', version: '1.0.0' })
    const originalRegisterTool = server.registerTool.bind(server)
    server.registerTool = (name, schema, handler) => {
      registeredTools.set(name, { schema, handler })
      return originalRegisterTool(name, schema, handler)
    }

    // Register all tools with dummy options
    registerTools(server, {
      apiClients: {
        adminSdk: {},
        chromeManagement: {},
        chromePolicy: {},
        cloudIdentity: {},
        serviceUsage: {},
      },
    })
  })

  test('When tools are registered, then every object outputSchema preserves unknown keys', () => {
    // Behavioral check: parsing a probe with an unknown field should keep that
    // field. zod v4 represents loose objects via a catchall; checking behavior
    // is more robust than poking at internals.
    const PROBE_KEY = '__cep_unknown_probe__'
    for (const [name, tool] of registeredTools) {
      const schema = tool.schema.outputSchema
      if (!schema || schema.def?.type !== 'object') {
        continue
      }
      const probe = { [PROBE_KEY]: 'sentinel' }
      const parsed = schema.safeParse(probe)
      // The schema may reject the probe (required fields missing); we only care
      // about the unknown-key behavior when parse succeeds with extras.
      const result = parsed.success ? parsed.data : schema.partial().parse(probe)
      assert.strictEqual(
        result[PROBE_KEY],
        'sentinel',
        `Tool "${name}" outputSchema must preserve unknown keys (use z.looseObject for forward compatibility).`,
      )
    }
  })

  test('When a tool is called, then structuredContent conforms to outputSchema', async () => {
    // This is a representative test for one tool.
    // Full coverage is in individual tool tests, but we verify the pattern here.
    const mockContext = { requestInfo: { headers: { authorization: 'Bearer token' } } }

    // We need to mock the client for this to work
    const mockAdminSdk = {
      getCustomerId: async () => ({ id: 'C123', customerDomain: 'example.com' }),
    }

    // Re-register with mock
    const localServer = new McpServer({ name: 'local', version: '1.0.0' })
    let capturedHandler
    let capturedSchema
    localServer.registerTool = (name, schema, handler) => {
      if (name === 'get_customer_id') {
        capturedHandler = handler
        capturedSchema = schema
      }
    }
    registerTools(localServer, { apiClients: { adminSdk: mockAdminSdk } })

    const result = await capturedHandler({}, mockContext)

    // Validate structuredContent against the schema
    const schema = capturedSchema.outputSchema
    const parsed = schema.parse(result.structuredContent)
    assert.strictEqual(parsed.customerId, 'C123')
    assert.strictEqual(
      result.structuredContent.customerDomain,
      'example.com',
      'Passthrough should preserve unknown fields',
    )
  })
})
