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

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createIntegrationHarness, teardownIntegrationHarness } from '../../helpers/integration/tools/harness.js'
import { parseToolOutput } from '../../helpers/integration/tools/tool_utils.js'
import { FeatureFlags } from '../../../lib/util/feature_flags.js'

describe('Secure Gateway Lifecycle Integration', () => {
  let harness
  const createdGateways = []
  const createdApps = [] // entries as { projectId, gatewayId, applicationId }

  before(async () => {
    harness = await createIntegrationHarness({
      featureFlags: new FeatureFlags({
        EXPERIMENT_SECURE_GATEWAY_ENABLED: 'true',
        EXPERIMENT_DELETE_TOOL_ENABLED: 'true',
      }),
    })
  })

  after(async () => {
    const { client } = harness
    // Clean up applications
    for (const app of createdApps) {
      try {
        await client.callTool({
          name: 'delete_secure_gateway_application',
          arguments: {
            projectId: app.projectId,
            gatewayId: app.gatewayId,
            applicationId: app.applicationId,
          },
        })
      } catch (e) {
        console.error(`Cleanup failed for app ${app.applicationId}:`, e.message)
      }
    }

    // Clean up gateways
    for (const gw of createdGateways) {
      try {
        // Call the BeyondCorp client directly for gateway cleanup because
        // delete_secure_gateway is not exposed as an MCP tool for safety reasons.
        await harness.apiClients.beyondcorp.deleteGateway(gw.projectId, gw.gatewayId)
      } catch (e) {
        console.error(`Cleanup failed for gateway ${gw.gatewayId}:`, e.message)
      }
    }

    await teardownIntegrationHarness(harness)
  })

  test('When a Secure Gateway is created, we can get details, enable service discovery, configure app routing, manage IAM policies, and delete app', async () => {
    const { client } = harness
    const projectId = 'test-project-123'
    const gatewayId = `test-gateway-${Date.now()}`

    // 1. Create Gateway
    const createGwResult = await client.callTool({
      name: 'create_secure_gateway',
      arguments: {
        projectId,
        gatewayId,
        displayName: 'My Test Gateway',
        enableServiceDiscovery: false, // Start disabled (legacy setup) to test transition
      },
    })

    const { text, details: gwDetails } = parseToolOutput(createGwResult)
    if (!gwDetails) {
      throw new Error(`Create gateway failed: ${text}`)
    }
    assert.ok(gwDetails.name)
    assert.strictEqual(gwDetails.displayName, 'My Test Gateway')
    assert.strictEqual(gwDetails.state, 'RUNNING')
    assert.ok(gwDetails.delegatingServiceAccount)
    assert.strictEqual(gwDetails.serviceDiscovery, undefined) // Service discovery should be absent

    createdGateways.push({ projectId, gatewayId })

    // 2. Get Gateway
    const getGwResult = await client.callTool({
      name: 'get_secure_gateway',
      arguments: {
        projectId,
        gatewayId,
      },
    })

    const gotGwDetails = parseToolOutput(getGwResult).details
    assert.strictEqual(gotGwDetails.name, gwDetails.name)
    assert.strictEqual(gotGwDetails.displayName, 'My Test Gateway')

    // 2b. List Gateways
    const listGwsResult = await client.callTool({
      name: 'list_secure_gateways',
      arguments: {
        projectId,
      },
    })

    const gatewaysList = parseToolOutput(listGwsResult).details.gateways
    assert.ok(Array.isArray(gatewaysList))
    const foundGw = gatewaysList.find(g => g.name === gwDetails.name)
    assert.ok(foundGw)
    assert.strictEqual(foundGw.displayName, 'My Test Gateway')

    // 3. Enable Service Discovery
    const enableSdResult = await client.callTool({
      name: 'enable_service_discovery',
      arguments: {
        projectId,
        gatewayId,
      },
    })

    const updatedGwDetails = parseToolOutput(enableSdResult).details
    assert.ok(updatedGwDetails.serviceDiscovery) // Service discovery should now be present

    // 3b. Update Gateway
    const updateGwResult = await client.callTool({
      name: 'update_secure_gateway',
      arguments: {
        projectId,
        gatewayId,
        displayName: 'Updated Test Gateway Name',
      },
    })

    const patchedGwDetails = parseToolOutput(updateGwResult).details
    assert.strictEqual(patchedGwDetails.displayName, 'Updated Test Gateway Name')

    // 4. Create Secure Gateway Application Routing
    const applicationId = 'my-internal-app'
    const createAppResult = await client.callTool({
      name: 'create_secure_gateway_application',
      arguments: {
        projectId,
        gatewayId,
        applicationId,
        displayName: 'My Internal Web App',
        hostName: 'internal.example.com',
        ports: [443, 80],
        privateNetwork: 'projects/test-project-123/global/networks/default',
        egressRegions: ['us-central1'],
      },
    })

    const appDetails = parseToolOutput(createAppResult).details
    assert.ok(appDetails.name)
    assert.strictEqual(appDetails.displayName, 'My Internal Web App')
    assert.deepStrictEqual(appDetails.endpointMatchers, [{ hostname: 'internal.example.com', ports: [443, 80] }])
    assert.deepStrictEqual(appDetails.upstreams, [
      {
        network: { name: 'projects/test-project-123/global/networks/default' },
        egress_policy: { regions: ['us-central1'] },
      },
    ])

    createdApps.push({ projectId, gatewayId, applicationId })

    // 4b. Get Secure Gateway Application Routing
    const getAppResult = await client.callTool({
      name: 'get_secure_gateway_application',
      arguments: {
        projectId,
        gatewayId,
        applicationId,
      },
    })

    const gotAppDetails = parseToolOutput(getAppResult).details
    assert.strictEqual(gotAppDetails.name, appDetails.name)
    assert.strictEqual(gotAppDetails.displayName, 'My Internal Web App')
    assert.deepStrictEqual(gotAppDetails.endpointMatchers, [{ hostname: 'internal.example.com', ports: [443, 80] }])

    // 4c. Update Secure Gateway Application Routing
    const updateAppResult = await client.callTool({
      name: 'update_secure_gateway_application',
      arguments: {
        projectId,
        gatewayId,
        applicationId,
        displayName: 'Updated Internal Web App',
        hostName: 'updated-internal.example.com',
        ports: [8443],
      },
    })

    const patchedAppDetails = parseToolOutput(updateAppResult).details
    assert.strictEqual(patchedAppDetails.displayName, 'Updated Internal Web App')
    assert.deepStrictEqual(patchedAppDetails.endpointMatchers, [
      { hostname: 'updated-internal.example.com', ports: [8443] },
    ])

    // 5. List Secure Gateway Applications
    const listAppsResult = await client.callTool({
      name: 'list_secure_gateway_applications',
      arguments: {
        projectId,
        gatewayId,
      },
    })

    const listApps = parseToolOutput(listAppsResult).details.applications
    assert.ok(Array.isArray(listApps))
    assert.strictEqual(listApps.length, 1)
    assert.strictEqual(listApps[0].name, appDetails.name)

    // 6. Get Gateway IAM Policy (Service Discovery policy)
    const getGwPolicyResult = await client.callTool({
      name: 'get_secure_gateway_iam_policy',
      arguments: {
        projectId,
        gatewayId,
      },
    })

    const { text: gwPolicyText, details: gwPolicy } = parseToolOutput(getGwPolicyResult)
    if (!gwPolicy) {
      throw new Error(`get_secure_gateway_iam_policy failed: ${gwPolicyText}`)
    }
    assert.ok(gwPolicy.etag)
    assert.ok(Array.isArray(gwPolicy.bindings))

    // 7. Set Gateway IAM Policy
    const newGwPolicy = {
      bindings: [
        {
          role: 'roles/beyondcorp.serviceDiscoveryUser',
          members: ['group:all-users@example.com'],
        },
      ],
      etag: gwPolicy.etag,
      version: 3,
    }

    const setGwPolicyResult = await client.callTool({
      name: 'set_secure_gateway_iam_policy',
      arguments: {
        projectId,
        gatewayId,
        policy: newGwPolicy,
      },
    })

    const { text: setGwPolicyText, details: updatedGwPolicy } = parseToolOutput(setGwPolicyResult)
    if (!updatedGwPolicy) {
      throw new Error(`set_secure_gateway_iam_policy failed: ${setGwPolicyText}`)
    }
    assert.deepStrictEqual(updatedGwPolicy.bindings, newGwPolicy.bindings)

    // 8. Get Application IAM Policy
    const getAppPolicyResult = await client.callTool({
      name: 'get_secure_gateway_application_iam_policy',
      arguments: {
        projectId,
        gatewayId,
        applicationId,
      },
    })

    const { text: appPolicyText, details: appPolicy } = parseToolOutput(getAppPolicyResult)
    if (!appPolicy) {
      throw new Error(`get_secure_gateway_application_iam_policy failed: ${appPolicyText}`)
    }
    assert.ok(appPolicy.etag)

    // 9. Set Application IAM Policy
    const newAppPolicy = {
      bindings: [
        {
          role: 'roles/beyondcorp.sgApplicationUser',
          members: ['user:alice@example.com'],
        },
      ],
      etag: appPolicy.etag,
      version: 3,
    }

    const setAppPolicyResult = await client.callTool({
      name: 'set_secure_gateway_application_iam_policy',
      arguments: {
        projectId,
        gatewayId,
        applicationId,
        policy: newAppPolicy,
      },
    })

    const { text: setAppPolicyText, details: updatedAppPolicy } = parseToolOutput(setAppPolicyResult)
    if (!updatedAppPolicy) {
      throw new Error(`set_secure_gateway_application_iam_policy failed: ${setAppPolicyText}`)
    }
    assert.deepStrictEqual(updatedAppPolicy.bindings, newAppPolicy.bindings)

    // 10. Delete Secure Gateway Application Routing
    const deleteAppResult = await client.callTool({
      name: 'delete_secure_gateway_application',
      arguments: {
        projectId,
        gatewayId,
        applicationId,
      },
    })

    const deleteOutput = parseToolOutput(deleteAppResult).text
    assert.match(deleteOutput, /Successfully deleted application/)

    // Remove from cleanup list
    createdApps.pop()

    // 11. Verify Deletion
    const listAppsAfterDeleteResult = await client.callTool({
      name: 'list_secure_gateway_applications',
      arguments: {
        projectId,
        gatewayId,
      },
    })

    const listAppsAfterDelete = parseToolOutput(listAppsAfterDeleteResult).details.applications
    assert.strictEqual(listAppsAfterDelete.length, 0)
  })
})
