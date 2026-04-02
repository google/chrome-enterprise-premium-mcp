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
import { assertObjectMatches, parseToolOutput } from '../../helpers/integration/tools/tool_utils.js'
import { validateAndGetOrgUnitId } from '../../../tools/utils.js'

/**
 * Direct Tool Integration Tests.
 *
 * Verifies end-to-end tool flows using independent test blocks.
 */
describe('Direct Tool Integration', () => {
  let harness
  const createdResources = []

  before(async () => {
    harness = await createIntegrationHarness()
  })

  after(async () => {
    await teardownIntegrationHarness(harness, createdResources)
  })

  test('DLP Rule Lifecycle: Create -> Verify -> List -> Delete', async () => {
    const { client, testContext } = harness
    const ruleConfig = {
      customerId: testContext.customerId,
      orgUnitId: testContext.orgUnitId,
      displayName: `INTEGRATION_TEST_RULE_${Date.now()}`,
      description: 'Human-readable verified integration test rule.',
      triggers: ['URL_NAVIGATION'],
      condition: "url.contains('integration-test.com')",
      action: 'BLOCK',
    }

    // 1. CREATE
    const result = await client.callTool({
      name: 'create_chrome_dlp_rule',
      arguments: ruleConfig,
    })

    const { text, details } = parseToolOutput(result)
    assert.match(text, /Successfully created Chrome DLP rule/)

    const ruleName = details.name
    createdResources.push(ruleName)

    // 2. VERIFY
    const actualPolicy = details.setting?.value || details

    assert.ok(actualPolicy.displayName.includes(ruleConfig.displayName))
    assert.ok(actualPolicy.triggers.includes('google.workspace.chrome.url.v1.navigation'))

    assertObjectMatches(actualPolicy, {
      description: ruleConfig.description,
      state: 'ACTIVE',
      condition: {
        contentCondition: ruleConfig.condition,
      },
      action: {
        chromeAction: {
          blockContent: {},
        },
      },
    })

    // 3. LIST
    const listResult = await client.callTool({
      name: 'list_dlp_rules',
      arguments: {},
    })

    const listOutput = parseToolOutput(listResult).text
    assert.ok(listOutput.includes(ruleName), 'Created rule not visible in list output')

    // 4. DELETE
    const deleteResult = await client.callTool({
      name: 'delete_agent_dlp_rule',
      arguments: { policyName: ruleName },
    })

    const deleteOutput = parseToolOutput(deleteResult).text
    assert.match(deleteOutput, /Successfully deleted Chrome DLP rule/)
    assert.match(deleteOutput, new RegExp(ruleName))

    // 5. VERIFY DELETION
    const listAfterDeleteResult = await client.callTool({
      name: 'list_dlp_rules',
      arguments: {},
    })

    const listAfterDeleteOutput = parseToolOutput(listAfterDeleteResult).text
    assert.ok(!listAfterDeleteOutput.includes(ruleName), 'Deleted rule still visible in list output')

    // Clean up createdResources list as it's already deleted
    const index = createdResources.indexOf(ruleName)
    if (index > -1) createdResources.splice(index, 1)
  })

  test('DLP Rule Safety: Refuses to delete non-agent rules', async () => {
    const { client, apiClients, testContext } = harness
    const ruleConfig = {
      displayName: `HUMAN_RULE_${Date.now()}`, // NO robot emoji prefix
      description: 'A rule created outside the agent.',
      triggers: ['google.workspace.chrome.url.v1.navigation'],
      state: 'ACTIVE',
      action: { chromeAction: { auditOnly: {} } },
    }

    // 1. Create a "human" rule directly via API client (bypassing agent tool prefixing)
    const createdRuleResponse = await apiClients.cloudIdentity.createDlpRule(
      testContext.customerId,
      validateAndGetOrgUnitId(testContext.orgUnitId),
      ruleConfig,
    )
    const ruleName = createdRuleResponse.response.name
    createdResources.push(ruleName)

    // 2. Attempt to delete it via the agent tool
    const deleteResult = await client.callTool({
      name: 'delete_agent_dlp_rule',
      arguments: { policyName: ruleName },
    })

    const deleteOutput = parseToolOutput(deleteResult).text

    // 3. Verify it refused and provided the link
    assert.match(deleteOutput, /Automated deletion is only permitted for rules created by this agent/)
    assert.match(deleteOutput, /https:\/\/admin\.google\.com\/ac\/dp\/rules\//)
    assert.match(deleteOutput, new RegExp(encodeURIComponent(ruleName)))

    // 4. Verify the rule still exists
    const listResult = await client.callTool({
      name: 'list_dlp_rules',
      arguments: {},
    })

    const listOutput = parseToolOutput(listResult).text
    assert.ok(listOutput.includes(ruleName), 'Human rule was incorrectly deleted by the agent tool')
  })
})
