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

  test('DLP Rule Lifecycle: Create -> Verify -> List', async () => {
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

    const ruleName = details.name || details.response?.name
    createdResources.push(ruleName)

    // 2. VERIFY
    const actualPolicy = details.setting?.value || details.response?.setting?.value || details.value || details

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
  })
})
