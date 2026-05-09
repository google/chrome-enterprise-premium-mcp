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

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { registerTools } from '../../../../tools/index.js'
import { registerPrompts } from '../../../../prompts/index.js'
import { getApiClients, HarnessOptions } from './client_factory.js'
import { parseToolOutput } from './tool_utils.js'
import { startFakeServer } from '../../fake-api-server.js'
import { ApiClients, SessionState } from '../../../../tools/utils/wrapper.js'
import { isObject, getString, getObject } from '../../../../lib/util/helpers.js'

const SEPARATOR_LENGTH = 80

interface TestContext {
  customerId: string
  orgUnitId: string
}

/**
 * Setup the test context by discovering customer ID and organizational unit ID.
 * @param client The MCP client instance.
 * @returns The discovered test context.
 */
export async function setupTestContext(client: Client): Promise<TestContext> {
  const isReal = process.env.CEP_BACKEND === 'real'

  if (isReal) {
    console.log('[TEST] Discovering real resources...')
    try {
      const customerResult = await client.callTool({ name: 'get_customer_id', arguments: {} })
      const { text: customerOutput, details: customerData } = parseToolOutput(customerResult)

      if (customerOutput.startsWith('Error:')) {
        handleDiscoveryError(customerOutput)
      }

      const envCustomerId = process.env.TEST_CUSTOMER_ID
      const customerId = envCustomerId || (customerData && getString(customerData, 'customerId'))

      if (!customerId) {
        throw new Error('Failed to discover Customer ID from tool output.')
      }

      const ouResult = await client.callTool({ name: 'list_org_units', arguments: { customerId } })
      const { text: ouOutput, details: ouData } = parseToolOutput(ouResult)

      if (ouOutput.startsWith('Error:')) {
        handleDiscoveryError(ouOutput)
      }

      const ous = ouData ? ouData['orgUnits'] : null

      if (!ous || !Array.isArray(ous) || ous.length === 0) {
        throw new Error('No Organizational Units found in this account.')
      }

      const items = ous.filter(isObject)

      // Try to find Root OU explicitly
      const rootOu = items.find(ou => getString(ou, 'orgUnitPath') === '/' || getString(ou, 'name') === 'Root')
      const envOrgUnitId = process.env.TEST_ORG_UNIT_ID
      const firstOuId = getString(items[0], 'orgUnitId') || ''
      const orgUnitId = envOrgUnitId || (rootOu ? getString(rootOu, 'orgUnitId') || firstOuId : firstOuId)

      console.log(`[TEST] Active Context: Customer=${customerId}, OU=${orgUnitId}`)
      return { customerId, orgUnitId }
    } catch (error) {
      throw new Error(`Discovery failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return {
    customerId: 'C0123456',
    orgUnitId: 'id:fakeOUId1',
  }
}

function handleDiscoveryError(errorText: string): never {
  const isAuthError =
    errorText.includes('invalid_grant') ||
    errorText.includes('invalid_rapt') ||
    errorText.includes('reauth') ||
    errorText.includes('401') ||
    errorText.includes('403')

  const isQuotaError = errorText.includes('quota project')

  if (isAuthError) {
    console.error('\n' + '='.repeat(SEPARATOR_LENGTH))
    console.error('❌ AUTHENTICATION REQUIRED')
    console.error('The integration tests failed to access the Google APIs.')
    console.error("Please run: 'gcloud auth application-default login' to refresh your credentials.")
    console.error('='.repeat(SEPARATOR_LENGTH) + '\n')
    throw new Error('Integration tests failed: Authentication required.')
  }

  if (isQuotaError) {
    const projectMatch = errorText.match(/quota project "([^"]+)"/i)
    const projectName = projectMatch ? projectMatch[1] : 'YOUR_PROJECT_ID'
    console.error('\n' + '='.repeat(SEPARATOR_LENGTH))
    console.error('❌ QUOTA PROJECT REQUIRED')
    console.error('The integration tests failed because a quota project is not set.')
    console.error(`Please run: 'gcloud auth application-default set-quota-project ${projectName}'`)
    console.error('='.repeat(SEPARATOR_LENGTH) + '\n')
    throw new Error('Integration tests failed: Quota project required.')
  }

  throw new Error(`Discovery failed: ${errorText}`)
}

export interface IntegrationHarness {
  server: McpServer
  client: Client
  apiClients: ApiClients
  testContext: TestContext
  sessionState: SessionState
  usingManager: boolean
  rootUrl: string
  fakeServer?: { url: string; close: () => Promise<void> } | null
}

interface FakeServer {
  url: string
  close: () => Promise<void>
}

function isFakeServer(obj: unknown): obj is FakeServer {
  if (!isObject(obj)) {
    return false
  }
  if (typeof obj.url !== 'string') {
    return false
  }
  if (typeof obj.close !== 'function') {
    return false
  }
  return true
}

/**
 * Creates an integration test harness by configuring servers and transports.
 * @param options Harness configuration options.
 * @returns The instantiated integration harness.
 */
export async function createIntegrationHarness(options: HarnessOptions = {}): Promise<IntegrationHarness> {
  let rootUrl = options.rootUrl || ''
  let usingManager = false

  let serverInstance: { url: string; close: () => Promise<void> } | null = null
  if (!rootUrl && (options.backend === 'fake' || process.env.CEP_BACKEND === 'fake')) {
    const instance: unknown = await startFakeServer()
    if (isFakeServer(instance)) {
      serverInstance = instance
      rootUrl = instance.url
    }
    usingManager = true
  }

  const server = new McpServer(
    { name: 'test-server', version: '1.0.0' },
    { capabilities: { logging: {}, prompts: {} } },
  )

  const harnessOptions = { ...options, rootUrl, usingManager }
  const apiClients = getApiClients(harnessOptions)
  const sessionState: SessionState = { customerId: null }
  registerTools(server, { apiClients, apiOptions: { rootUrl }, featureFlags: options.featureFlags }, sessionState)
  registerPrompts(server)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'test-client', version: '1.0.0' })

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  const testContext = await setupTestContext(client)

  // FATAL VALIDATION: Ensure the harness is actually usable before letting tests run
  if (!testContext.customerId) {
    throw new Error('Harness Setup Failed: Could not discover Customer ID')
  }
  if (!testContext.orgUnitId) {
    throw new Error('Harness Setup Failed: Could not discover Org Unit ID')
  }

  return {
    server,
    client,
    apiClients,
    testContext,
    sessionState,
    usingManager,
    rootUrl,
    fakeServer: serverInstance,
  }
}

/**
 * Tears down the integration test harness and cleans up created resources.
 * @param harness The active integration harness.
 * @param createdResources Array of resource names created during testing.
 */
export async function teardownIntegrationHarness(
  harness: IntegrationHarness | undefined,
  createdResources?: string[],
): Promise<void> {
  const client = harness?.client
  if (client && 'close' in client && typeof client.close === 'function') {
    await client.close()
  }

  if (harness?.apiClients && createdResources && createdResources.length > 0) {
    console.log(`[CLEANUP] Deleting ${createdResources.length} integration test resources...`)
    const cloudIdentity = harness.apiClients.cloudIdentity
    if (cloudIdentity) {
      for (const name of createdResources) {
        if (!name) {
          continue
        }
        try {
          let policy: unknown
          try {
            policy = await cloudIdentity.getDlpRule(name)
          } catch (e) {
            const errMsg = e instanceof Error ? e.message : String(e)
            if (errMsg.includes('404') || errMsg.includes('not found')) {
              console.log(`[CLEANUP] Resource ${name} already deleted.`)
              continue
            }
            throw e
          }

          const setting = isObject(policy) ? getObject(policy, 'setting') : null
          const type = setting ? getString(setting, 'type') || '' : ''
          if (type.includes('rule.dlp')) {
            await cloudIdentity.deleteDlpRule(name)
            console.log(`[CLEANUP] Deleted Rule: ${name}`)
          } else if (type.includes('detector')) {
            await cloudIdentity.deleteDetector(name)
            console.log(`[CLEANUP] Deleted Detector: ${name}`)
          } else {
            console.log(`[CLEANUP] Unknown policy type for ${name}, attempting generic rule delete...`)
            await cloudIdentity.deleteDlpRule(name)
          }
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e)
          console.error(`[CLEANUP] Failed to delete ${name}: ${errMsg}`)
        }
      }
    }
  }

  // Ensure the fake backend is stopped
  if (harness?.usingManager && harness.fakeServer) {
    await harness.fakeServer.close()
  }
}
