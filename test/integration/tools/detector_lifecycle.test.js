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
 * Detector Lifecycle Integration Tests.
 *
 * Verifies end-to-end tool flows using independent test blocks.
 */
describe('Detector Lifecycle Integration', () => {
  let harness
  const createdResources = []

  before(async () => {
    harness = await createIntegrationHarness()
  })

  after(async () => {
    await teardownIntegrationHarness(harness, createdResources)
  })

  test('Regex Detector Lifecycle: Create -> Verify -> List -> Delete', async () => {
    const { client, testContext } = harness
    const detectorConfig = {
      customerId: testContext.customerId,
      displayName: `INTEGRATION_TEST_REGEX_${Date.now()}`,
      description: 'Human-readable verified integration test regex detector.',
      expression: '^4[0-9]{12}(?:[0-9]{3})?$',
    }

    // 1. CREATE
    const result = await client.callTool({
      name: 'create_regex_detector',
      arguments: detectorConfig,
    })

    const { text, details } = parseToolOutput(result)
    assert.match(text, /Successfully created regular expression detector/)

    const detector = details.detector
    const detectorName = detector.name
    createdResources.push(detectorName)

    // 2. VERIFY
    const settings = detector.setting?.value || detector
    assert.ok(settings.displayName.includes(detectorConfig.displayName))

    // The real API might nest the detector specific fields differently or we might need to match exactly what was sent
    const expectedMatch = {
      description: detectorConfig.description,
    }
    if (settings.regular_expression) {
      expectedMatch.regular_expression = { expression: detectorConfig.expression }
    } else if (settings.regularExpression) {
      expectedMatch.regularExpression = { expression: detectorConfig.expression }
    }

    assertObjectMatches(settings, expectedMatch)

    // 3. LIST
    const listResult = await client.callTool({
      name: 'list_detectors',
      arguments: {},
    })

    const listOutput = parseToolOutput(listResult).text
    const shortId = detectorName.split('/').pop()
    assert.ok(listOutput.includes(shortId), `Created detector short ID (${shortId}) not visible in list output`)

    // 4. DELETE
    const deleteResult = await client.callTool({
      name: 'delete_detector',
      arguments: { policyName: detectorName },
    })

    const deleteOutput = parseToolOutput(deleteResult).text
    assert.match(deleteOutput, /Successfully deleted detector policy/)
    assert.match(deleteOutput, new RegExp(detectorName))

    // 5. VERIFY DELETION
    const listAfterDeleteResult = await client.callTool({
      name: 'list_detectors',
      arguments: {},
    })

    const listAfterDeleteOutput = parseToolOutput(listAfterDeleteResult).text
    assert.ok(!listAfterDeleteOutput.includes(shortId), `Deleted detector short ID (${shortId}) still visible in list output`)

    // Clean up createdResources list as it's already deleted
    const index = createdResources.indexOf(detectorName)
    if (index > -1) {
      createdResources.splice(index, 1)
    }
  })

  test('URL List Detector Lifecycle: Create -> Verify -> Delete', async () => {
    const { client, testContext } = harness
    const detectorConfig = {
      customerId: testContext.customerId,
      displayName: `INTEGRATION_TEST_URL_${Date.now()}`,
      description: 'Human-readable verified integration test URL list detector.',
      urls: ['malware-test.com', 'phishing-test.net'],
    }

    // 1. CREATE
    const result = await client.callTool({
      name: 'create_url_list_detector',
      arguments: detectorConfig,
    })

    const { text, details } = parseToolOutput(result)
    assert.match(text, /Successfully created URL list detector/)

    const detector = details.detector
    const detectorName = detector.name
    createdResources.push(detectorName)

    // 2. VERIFY
    const settings = detector.setting?.value || detector

    const expectedMatch = {
      displayName: detectorConfig.displayName,
      description: detectorConfig.description,
    }
    if (settings.url_list) {
      expectedMatch.url_list = { urls: detectorConfig.urls }
    } else if (settings.urlList) {
      expectedMatch.urlList = { urls: detectorConfig.urls }
    }

    assertObjectMatches(settings, expectedMatch)

    // 3. DELETE
    const deleteResult = await client.callTool({
      name: 'delete_detector',
      arguments: { policyName: detectorName },
    })

    const deleteOutput = parseToolOutput(deleteResult).text
    assert.match(deleteOutput, /Successfully deleted detector policy/)

    // Clean up createdResources list as it's already deleted
    const index = createdResources.indexOf(detectorName)
    if (index > -1) {
      createdResources.splice(index, 1)
    }
  })
})
