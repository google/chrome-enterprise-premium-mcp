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
import { describe, test, mock, beforeEach } from 'node:test'
import { registerTools } from '../../../tools/index.js'
import { FeatureFlags } from '../../../lib/util/feature_flags.js'

describe('Experiment: KNOWLEDGE_SEARCH_ENABLED', () => {
  let server

  beforeEach(() => {
    server = {
      registerTool: mock.fn(),
    }
  })

  test('When EXPERIMENT_KNOWLEDGE_SEARCH_ENABLED flag is enabled, then it registers search tools', async () => {
    const flags = new FeatureFlags({ EXPERIMENT_KNOWLEDGE_SEARCH_ENABLED: 'true' })

    registerTools(server, { featureFlags: flags })

    const registeredToolNames = server.registerTool.mock.calls.map(call => call.arguments[0])
    const expectedExperimentalTools = ['search_content', 'list_documents']

    for (const tool of expectedExperimentalTools) {
      assert.ok(
        registeredToolNames.includes(tool),
        `Experimental tool "${tool}" should be registered when flag is enabled`,
      )
    }
  })

  test('When EXPERIMENT_KNOWLEDGE_SEARCH_ENABLED flag is disabled, then it does NOT register search tools', async () => {
    const flags = new FeatureFlags({ EXPERIMENT_KNOWLEDGE_SEARCH_ENABLED: 'false' })

    registerTools(server, { featureFlags: flags })

    const registeredToolNames = server.registerTool.mock.calls.map(call => call.arguments[0])
    const experimentalTools = ['search_content', 'list_documents']

    for (const tool of experimentalTools) {
      assert.ok(
        !registeredToolNames.includes(tool),
        `Experimental tool "${tool}" should NOT be registered when flag is disabled`,
      )
    }
  })

  test('get_document tool is always registered regardless of flag', async () => {
    const flagsDisabled = new FeatureFlags({ EXPERIMENT_KNOWLEDGE_SEARCH_ENABLED: 'false' })
    const flagsEnabled = new FeatureFlags({ EXPERIMENT_KNOWLEDGE_SEARCH_ENABLED: 'true' })

    server.registerTool.mock.resetCalls()
    registerTools(server, { featureFlags: flagsDisabled })
    assert.ok(
      server.registerTool.mock.calls.some(call => call.arguments[0] === 'get_document'),
      'get_document should be registered when flag is disabled',
    )

    server.registerTool.mock.resetCalls()
    registerTools(server, { featureFlags: flagsEnabled })
    assert.ok(
      server.registerTool.mock.calls.some(call => call.arguments[0] === 'get_document'),
      'get_document should be registered when flag is enabled',
    )
  })
})
