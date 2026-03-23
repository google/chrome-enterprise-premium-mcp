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
 * @fileoverview Integration tests for the MCP server in stdio mode.
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

describe('MCP Server in stdio mode', () => {
  let client
  let transport

  before(async () => {
    transport = new StdioClientTransport({
      command: 'node',
      args: ['mcp-server.js'],
      env: { ...process.env, GCP_STDIO: 'true' },
    })
    client = new Client({
      name: 'test-client',
      version: '1.0.0',
    })
    await client.connect(transport)
  })

  after(() => {
    client.close()
  })

  test('should list tools', async () => {
    const response = await client.listTools()

    const tools = response.tools
    assert(Array.isArray(tools))
    const toolNames = tools.map(t => t.name)
    assert.deepStrictEqual(
      toolNames.sort(),
      [
        'check_cep_subscription',
        'count_browser_versions',
        'create_chrome_dlp_rule',
        'create_regex_detector',
        'create_url_list_detector',
        'create_word_list_detector',
        'delete_detector',
        'delete_dlp_rule',
        'get_chrome_activity_log',
        'get_connector_policy',
        'get_customer_id',
        'list_customer_profiles',
        'list_detectors',
        'list_dlp_rules',
        'list_org_units',
      ].sort(),
    )
  })
})
