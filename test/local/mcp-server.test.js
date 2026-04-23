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
 * @file Integration tests for the MCP server in stdio mode.
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('MCP Server in stdio mode', () => {
  let client
  let transport

  before(async () => {
    transport = new StdioClientTransport({
      command: 'node',
      args: ['mcp-server.js'],
      env: { ...process.env, GCP_STDIO: 'true', EXPERIMENT_KNOWLEDGE_SEARCH_ENABLED: 'true' },
    })
    client = new Client({
      name: 'test-client',
      version: '1.0.0',
    })
    await client.connect(transport)
  })

  after(async () => {
    if (client) {
      await client.close()
    }
    if (transport) {
      await transport.close()
    }
  })

  test('When listTools is called, then it returns all registered tools', async () => {
    const response = await client.listTools()

    const tools = response.tools
    assert(Array.isArray(tools))
    const toolNames = tools.map(t => t.name)
    assert.deepStrictEqual(
      toolNames.sort(),
      [
        'check_and_enable_cep_api',
        'check_cep_subscription',
        'check_seb_extension_status',
        'check_user_cep_license',
        'count_browser_versions',
        'create_chrome_dlp_rule',
        'create_default_dlp_rules',
        'create_regex_detector',
        'create_url_list_detector',
        'create_word_list_detector',
        'diagnose_environment',
        'enable_chrome_enterprise_connectors',
        'get_chrome_activity_log',
        'get_connector_policy',
        'get_customer_id',
        'get_dlp_rule',
        'install_seb_extension',
        'list_customer_profiles',
        'list_detectors',
        'list_dlp_rules',
        'list_org_units',
        'search_content',
        'list_documents',
        'get_document',
      ].sort(),
    )
  })

  describe('MCP Server Startup Logs', () => {
    test('When server starts with custom PORT, then it logs the correct port', () => {
      const serverPath = path.resolve(__dirname, '../../mcp-server.js')
      const result = spawnSync(process.execPath, [serverPath], {
        env: { ...process.env, PORT: '4000', GCP_STDIO: 'true', CEP_LOG_LEVEL: 'info' },
        timeout: 5000,
      })

      const output = result.stderr.toString() + result.stdout.toString()
      assert.match(output, /Port:\s+4000/)
    })

    test('When server starts without PORT, then it assigns a random port', () => {
      const serverPath = path.resolve(__dirname, '../../mcp-server.js')
      const result = spawnSync(process.execPath, [serverPath], {
        env: { ...process.env, GCP_STDIO: 'false', CEP_LOG_LEVEL: 'info' },
        timeout: 5000,
      })

      const output = result.stderr.toString() + result.stdout.toString()
      assert.match(output, /listening on port \d+/)
    })

    test('When server starts with a port that is already in use, then it logs an explicit error and exits', async () => {
      const serverPath = path.resolve(__dirname, '../../mcp-server.js')
      const net = await import('node:net')

      const server = net.createServer()
      await new Promise(resolve => {
        server.listen(0, resolve)
      })
      const port = server.address().port

      const result = spawnSync(process.execPath, [serverPath], {
        env: { ...process.env, PORT: port.toString(), GCP_STDIO: 'false', CEP_LOG_LEVEL: 'info' },
        timeout: 5000,
      })

      const output = result.stderr.toString() + result.stdout.toString()
      server.close()

      assert.match(output, /Fatal error: Port \d+ is already in use/)
    })

    test('When server starts with Fake Data URL, then it logs Data Access: Fake Data', () => {
      const serverPath = path.resolve(__dirname, '../../mcp-server.js')
      const result = spawnSync(process.execPath, [serverPath], {
        env: { ...process.env, GOOGLE_API_ROOT_URL: 'http://localhost:8080', GCP_STDIO: 'true', CEP_LOG_LEVEL: 'info' },
        timeout: 5000,
      })

      const output = result.stderr.toString() + result.stdout.toString()
      assert.match(output, /Data Access:\s+Fake Data/)
    })
  })
})
