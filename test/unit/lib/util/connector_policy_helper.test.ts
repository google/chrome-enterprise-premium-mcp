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

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { analyzeConnectorPolicy } from '../../../../lib/util/connector_policy_helper.js'

describe('Connector Policy Helper', () => {
  describe('analyzeConnectorPolicy', () => {
    test('When no policies are provided, then it reports not configured', () => {
      const result = analyzeConnectorPolicy('ON_FILE_ATTACHED', [])
      assert.strictEqual(result.isConfigured, false)
      assert.strictEqual(result.isEnabled, false)
      assert.strictEqual(result.findings.length, 0)
    })

    test('When serviceProvider is missing or NONE, then it reports not enabled', () => {
      const result = analyzeConnectorPolicy('ON_FILE_ATTACHED', [
        { value: { value: { serviceProvider: 'SERVICE_PROVIDER_NONE' } } },
      ])
      assert.strictEqual(result.isConfigured, true)
      assert.strictEqual(result.isEnabled, false)
      assert.strictEqual(result.findings.length, 0)
    })

    test('When serviceProvider is CHROME_ENTERPRISE_PREMIUM and delay is disabled, then it warns', () => {
      const result = analyzeConnectorPolicy('ON_FILE_ATTACHED', [
        {
          value: {
            value: {
              serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
              delayDeliveryUntilVerdict: false,
            },
          },
        },
      ])
      assert.strictEqual(result.isEnabled, true)
      assert.ok(result.findings.some(f => f.message.includes('Delay enforcement is disabled')))
      assert.strictEqual(result.findings.find(f => f.message.includes('Delay enforcement')).remediationType, 'manual')
    })

    test('When ON_SECURITY_EVENT is missing core events, then it warns', () => {
      const result = analyzeConnectorPolicy('ON_SECURITY_EVENT', [
        {
          value: {
            value: {
              reportingConnector: {
                eventConfiguration: {
                  enabledEventNames: ['contentTransferEvent'], // Missing others
                },
              },
            },
          },
        },
      ])
      assert.strictEqual(result.isEnabled, true)
      assert.ok(result.findings.some(f => f.message.includes('Missing core DLP events')))
    })

    test('When ON_REALTIME_URL_NAVIGATION is disabled, then it reports not enabled with descriptive message', () => {
      const result = analyzeConnectorPolicy('ON_REALTIME_URL_NAVIGATION', [
        {
          value: {
            value: {
              realtimeUrlCheckEnabled: 'REALTIME_URL_CHECK_MODE_ENUM_DISABLED',
            },
          },
        },
      ])
      assert.strictEqual(result.isEnabled, false)
      assert.strictEqual(result.findings[0].message, 'Real-time URL check is explicitly disabled')
      assert.strictEqual(result.findings[0].remediationType, 'manual')
    })

    test('When a 3rd party provider is detected, then it warns but stays enabled', () => {
      const result = analyzeConnectorPolicy('ON_FILE_ATTACHED', [
        { value: { value: { serviceProvider: 'SERVICE_PROVIDER_SYMANTEC_ENDPOINT_DLP' } } },
      ])
      assert.strictEqual(result.isEnabled, true)
      assert.ok(result.findings.some(f => f.message.includes('3rd party provider detected')))
    })
  })
})
