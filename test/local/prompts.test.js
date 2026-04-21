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

import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SERVER_PATH = resolve(__dirname, '../../mcp-server.js')

describe('MCP Prompts', () => {
  let client
  let transport

  before(async () => {
    transport = new StdioClientTransport({
      command: 'node',
      args: [SERVER_PATH],
      env: { ...process.env, GCP_STDIO: 'true' },
    })
    client = new Client(
      {
        name: 'test-client',
        version: '1.0.0',
      },
      {
        capabilities: {
          prompts: {},
        },
      },
    )
    await client.connect(transport)
  })

  after(async () => {
    await client.close()
  })

  test('When listPrompts is called, then it returns all available prompts', async () => {
    const result = await client.listPrompts()
    const promptNames = result.prompts.map(p => p.name).sort()

    assert.deepStrictEqual(promptNames, ['cep:health', 'cep:expert', 'cep:optimize'].sort())
  })

  test('When cep:health prompt is requested, then it returns its content', async () => {
    const result = await client.getPrompt({ name: 'cep:health' })

    assert.ok(result.messages)
    assert.ok(result.messages[0].content.text.includes('diagnose_environment'))
  })

  test('When cep:optimize prompt is requested, then it returns its content', async () => {
    const result = await client.getPrompt({ name: 'cep:optimize' })

    assert.ok(result.messages)
    assert.ok(result.messages[0].content.text.includes('Maturity Assessment'))
    assert.ok(result.messages[0].content.text.includes('get_document'))
    assert.ok(result.messages[0].content.text.includes('filename: 12'))
  })

  test('When cep:expert prompt is requested, then it returns its content', async () => {
    const result = await client.getPrompt({ name: 'cep:expert' })

    assert.ok(result.messages)
    assert.ok(result.messages[0].content.text.includes('Chrome Enterprise Premium (CEP) Technical Agent'))
  })
})
