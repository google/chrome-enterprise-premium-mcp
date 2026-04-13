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
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { registerTools } from '../../../../tools/index.js'
import { registerPrompts } from '../../../../prompts/index.js'
import { getApiClients } from './client_factory.js'
import { parseToolOutput } from './tool_utils.js'
import { fakeServerManager } from './fake_server_manager.js'

export async function setupTestContext(client) {
  const isReal = process.env.CEP_BACKEND === 'real'

  if (isReal) {
    console.log('[TEST] Discovering real resources...')
    try {
      const customerResult = await client.callTool({ name: 'get_customer_id', arguments: {} })
      const { text: customerOutput, details: customerData } = parseToolOutput(customerResult)

      if (customerOutput.startsWith('Error:')) {
        handleDiscoveryError(customerOutput)
      }

      const customerId = process.env.TEST_CUSTOMER_ID || customerData?.customerId

      if (!customerId) {
        throw new Error('Failed to discover Customer ID from tool output.')
      }

      const ouResult = await client.callTool({ name: 'list_org_units', arguments: { customerId } })
      const { text: ouOutput, details: ouData } = parseToolOutput(ouResult)

      if (ouOutput.startsWith('Error:')) {
        handleDiscoveryError(ouOutput)
      }

      const ous = ouData?.orgUnits

      if (!ous || !Array.isArray(ous) || ous.length === 0) {
        throw new Error('No Organizational Units found in this account.')
      }

      // Try to find Root OU explicitly
      const rootOu = ous.find(ou => ou.orgUnitPath === '/' || ou.name === 'Root')
      const orgUnitId = process.env.TEST_ORG_UNIT_ID || (rootOu ? rootOu.orgUnitId : ous[0].orgUnitId)

      console.log(`[TEST] Active Context: Customer=${customerId}, OU=${orgUnitId}`)
      return { customerId, orgUnitId }
    } catch (error) {
      handleDiscoveryError(error.message)
    }
  }

  return {
    customerId: 'C0123456',
    orgUnitId: 'fakeOUId1',
  }
}

function handleDiscoveryError(errorText) {
  const isAuthError =
    errorText.includes('invalid_grant') ||
    errorText.includes('invalid_rapt') ||
    errorText.includes('reauth') ||
    errorText.includes('401') ||
    errorText.includes('403')

  const isQuotaError = errorText.includes('quota project')

  if (isAuthError) {
    console.error('\n' + '='.repeat(80))
    console.error('❌ AUTHENTICATION REQUIRED')
    console.error('The integration tests failed to access the Google APIs.')
    console.error("Please run: 'gcloud auth application-default login' to refresh your credentials.")
    console.error('='.repeat(80) + '\n')
    throw new Error('Integration tests failed: Authentication required.')
  }

  if (isQuotaError) {
    const projectMatch = errorText.match(/quota project "([^"]+)"/i)
    const projectName = projectMatch ? projectMatch[1] : 'YOUR_PROJECT_ID'
    console.error('\n' + '='.repeat(80))
    console.error('❌ QUOTA PROJECT REQUIRED')
    console.error('The integration tests failed because a quota project is not set.')
    console.error(`Please run: 'gcloud auth application-default set-quota-project ${projectName}'`)
    console.error('='.repeat(80) + '\n')
    throw new Error('Integration tests failed: Quota project required.')
  }

  throw new Error(`Discovery failed: ${errorText}`)
}

export async function createIntegrationHarness(options = {}) {
  // Ensure the fake backend is running if needed
  await fakeServerManager.start()
  const server = new McpServer(
    { name: 'test-server', version: '1.0.0' },
    { capabilities: { logging: {}, prompts: {} } },
  )

  const apiClients = getApiClients(options)
  const sessionState = {}
  registerTools(server, { apiClients, apiOptions: { rootUrl: options.rootUrl } }, sessionState)
  registerPrompts(server)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'test-client', version: '1.0.0' })

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  const testContext = await setupTestContext(client)

  // FATAL VALIDATION: Ensure the harness is actually usable before letting tests run
  assert.ok(testContext.customerId, 'Harness Setup Failed: Could not discover Customer ID')
  assert.ok(testContext.orgUnitId, 'Harness Setup Failed: Could not discover Org Unit ID')

  return { server, client, apiClients, testContext, sessionState }
}

export async function teardownIntegrationHarness(harness, createdResources) {
  if (harness?.client) {
    await harness.client.close()
  }

  if (harness?.apiClients && createdResources && createdResources.length > 0) {
    console.log(`[CLEANUP] Deleting ${createdResources.length} integration test resources...`)
    for (const name of createdResources) {
      if (!name) {
        continue
      }
      try {
        let policy
        try {
          policy = await harness.apiClients.cloudIdentity.getDlpRule(name)
        } catch (e) {
          if (e.message.includes('404') || e.message.includes('not found')) {
            console.log(`[CLEANUP] Resource ${name} already deleted.`)
            continue
          }
          throw e
        }

        const type = policy.setting?.type || ''
        if (type.includes('rule.dlp')) {
          await harness.apiClients.cloudIdentity.deleteDlpRule(name)
          console.log(`[CLEANUP] Deleted Rule: ${name}`)
        } else if (type.includes('detector')) {
          await harness.apiClients.cloudIdentity.deleteDetector(name)
          console.log(`[CLEANUP] Deleted Detector: ${name}`)
        } else {
          console.log(`[CLEANUP] Unknown policy type for ${name}, attempting generic rule delete...`)
          await harness.apiClients.cloudIdentity.deleteDlpRule(name)
        }
      } catch (e) {
        console.error(`[CLEANUP] Failed to delete ${name}: ${e.message}`)
      }
    }
  }

  // Ensure the fake backend is stopped
  await fakeServerManager.stop()
}
