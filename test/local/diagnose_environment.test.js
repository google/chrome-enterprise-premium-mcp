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
 * @fileoverview Unit tests for diagnose_environment tool.
 *
 * Tests summary mode, detail/pagination, issue detection across
 * scenarios, and error resilience with mocked API clients.
 */

import { test, describe, mock } from 'node:test'
import assert from 'node:assert/strict'
import { registerDiagnoseEnvironmentTool } from '../../tools/definitions/diagnose_environment.js'

/**
 * Creates mock API clients that return configurable test data.
 * Used to simulate various environment states (e.g., missing licenses,
 * unconfigured connectors) by merging defaults with case-specific overrides.
 * @param {object} [overrides] - Configuration overrides to simulate specific test scenarios
 * @returns {object} A suite of mocked API clients compatible with the tool executor
 */
function createMockClients(overrides = {}) {
  const defaults = {
    customer: { id: 'C0123', customerDomain: 'test.com' },
    orgUnits: { organizationUnits: [{ name: 'Root', orgUnitId: 'id:ouRoot', orgUnitPath: '/' }] },
    subscription: { items: [{ userId: 'user1@test.com' }, { userId: 'user2@test.com' }] },
    dlpRules: [],
    detectors: [],
    browserVersions: [{ version: '134.0.0', count: '10', channel: 'STABLE' }],
    connectorPolicy: [],
    resolvePolicy: [],
  }

  const cfg = { ...defaults, ...overrides }

  return {
    adminSdkClient: {
      getCustomerId: mock.fn(async () => cfg.customer),
      listOrgUnits: mock.fn(async () => cfg.orgUnits),
      checkCepSubscription: mock.fn(async () => cfg.subscription),
    },
    chromeManagementClient: {
      countBrowserVersions: mock.fn(async () => cfg.browserVersions),
    },
    chromePolicyClient: {
      getConnectorPolicy: mock.fn(async () => cfg.connectorPolicy),
      resolvePolicy: mock.fn(async () => cfg.resolvePolicy),
    },
    cloudIdentityClient: {
      listDlpRules: mock.fn(async () => cfg.dlpRules),
      listDetectors: mock.fn(async () => cfg.detectors),
    },
    apiClients: {
      adminSdk: { getCustomerId: mock.fn(async () => cfg.customer) },
    },
  }
}

function registerAndGetHandler(clientOverrides = {}) {
  const handlers = {}
  const server = {
    registerTool: mock.fn((name, _desc, handler) => {
      handlers[name] = handler
    }),
  }
  const clients = createMockClients(clientOverrides)
  registerDiagnoseEnvironmentTool(server, clients, { customerId: null, cachedRootOrgUnitId: null })
  return { handler: handlers['diagnose_environment'], clients }
}

describe('diagnose_environment', () => {
  describe('Summary Mode', () => {
    test('healthy environment produces zero issues', async () => {
      const { handler } = registerAndGetHandler({
        connectorPolicy: [{ value: { value: {} } }],
        resolvePolicy: [
          {
            targetKey: { additionalTargetKeys: { app_id: 'chrome:ekajlcmdfcigmdbphhifahdfjbkciflj' } },
            value: { value: { appInstallType: 'FORCED' } },
          },
        ],
        dlpRules: [
          {
            setting: {
              type: 'settings/rule.dlp',
              value: {
                displayName: 'Rule 1',
                state: 'ACTIVE',
                action: { chromeAction: { blockContent: {} } },
                triggers: [],
              },
            },
          },
        ],
        detectors: [{ setting: { type: 'settings/detector.regex', value: { displayName: 'Det 1' } } }],
      })

      const result = await handler({ customerId: 'C0123' }, { requestInfo: {} })
      assert.deepStrictEqual(result.structuredContent.issues, [])
    })

    test('no subscription produces critical issue', async () => {
      const { handler } = registerAndGetHandler({ subscription: { items: [] } })
      const result = await handler({ customerId: 'C0123' }, { requestInfo: {} })
      const critical = result.structuredContent.issues.filter(i => i.severity === 'critical')
      assert.ok(critical.some(i => i.component === 'subscription'))
    })

    test('single license produces medium issue', async () => {
      const { handler } = registerAndGetHandler({ subscription: { items: [{ userId: 'a@b.com' }] } })
      const result = await handler({ customerId: 'C0123' }, { requestInfo: {} })
      const medium = result.structuredContent.issues.filter(i => i.severity === 'medium')
      assert.ok(medium.some(i => i.component === 'subscription'))
    })

    test('missing connectors produce critical issues', async () => {
      const { handler } = registerAndGetHandler({ connectorPolicy: [] })
      const result = await handler({ customerId: 'C0123' }, { requestInfo: {} })
      const connectorIssues = result.structuredContent.issues.filter(i => i.component.startsWith('connector.'))
      assert.ok(connectorIssues.length === 6, `Expected 6 missing connectors, got ${connectorIssues.length}`)
      assert.ok(connectorIssues.every(i => i.severity === 'critical'))
    })

    test('no DLP rules produces high issue', async () => {
      const { handler } = registerAndGetHandler({ connectorPolicy: [{ value: {} }] })
      const result = await handler({ customerId: 'C0123' }, { requestInfo: {} })
      const high = result.structuredContent.issues.filter(i => i.severity === 'high')
      assert.ok(high.some(i => i.component === 'dlpRules'))
    })

    test('audit-only rules produce medium issue', async () => {
      const { handler } = registerAndGetHandler({
        connectorPolicy: [{ value: {} }],
        dlpRules: [
          {
            setting: {
              type: 'settings/rule.dlp',
              value: { displayName: 'R1', state: 'ACTIVE', action: { chromeAction: { auditOnly: {} } }, triggers: [] },
            },
          },
        ],
      })
      const result = await handler({ customerId: 'C0123' }, { requestInfo: {} })
      const medium = result.structuredContent.issues.filter(i => i.message.includes('audit-only'))
      assert.ok(medium.length > 0)
    })

    test('SEB not installed produces high issue', async () => {
      const { handler } = registerAndGetHandler({ resolvePolicy: [] })
      const result = await handler({ customerId: 'C0123' }, { requestInfo: {} })
      const seb = result.structuredContent.issues.filter(i => i.component === 'sebExtension')
      assert.ok(seb.length === 1)
      assert.ok(seb[0].severity === 'high')
    })

    test('returns counts not arrays', async () => {
      const { handler } = registerAndGetHandler()
      const result = await handler({ customerId: 'C0123' }, { requestInfo: {} })
      const sc = result.structuredContent
      assert.ok(typeof sc.orgUnitCount === 'number')
      assert.ok(typeof sc.dlpRules.total === 'number')
      assert.ok(typeof sc.detectors.total === 'number')
      assert.ok(typeof sc.browserVersions.total === 'number')
    })

    test('DLP rule action breakdown includes watermark', async () => {
      const rules = ['blockContent', 'warnUser', 'auditOnly', 'watermarkContent'].map((action, i) => ({
        setting: {
          type: 'settings/rule.dlp',
          value: {
            displayName: `Rule ${i}`,
            state: 'ACTIVE',
            action: { chromeAction: { [action]: {} } },
            triggers: [],
          },
        },
      }))
      const { handler } = registerAndGetHandler({ dlpRules: rules, connectorPolicy: [{ value: {} }] })
      const result = await handler({ customerId: 'C0123' }, { requestInfo: {} })
      const { byAction } = result.structuredContent.dlpRules
      assert.strictEqual(byAction.block, 1)
      assert.strictEqual(byAction.warn, 1)
      assert.strictEqual(byAction.audit, 1)
      assert.strictEqual(byAction.watermark, 1)
    })

    test('auto-resolves customerId when omitted', async () => {
      const { handler } = registerAndGetHandler({ connectorPolicy: [{ value: {} }] })
      const result = await handler({}, { requestInfo: {} })
      assert.ok(result.structuredContent.customer.customerId, 'Customer ID resolved')
    })
  })

  describe('Detail/Pagination Mode', () => {
    test('paginates orgUnits', async () => {
      const ous = Array.from({ length: 100 }, (_, i) => ({
        name: `OU ${i}`,
        orgUnitId: `id:ou${i}`,
        orgUnitPath: `/${i}`,
      }))
      const { handler } = registerAndGetHandler({ orgUnits: { organizationUnits: ous } })

      const page1 = await handler(
        { customerId: 'C0123', section: 'orgUnits', limit: 10, offset: 0 },
        { requestInfo: {} },
      )
      assert.strictEqual(page1.structuredContent.items.length, 10)
      assert.strictEqual(page1.structuredContent.total, 100)
      assert.strictEqual(page1.structuredContent.hasMore, true)

      const page2 = await handler(
        { customerId: 'C0123', section: 'orgUnits', limit: 10, offset: 90 },
        { requestInfo: {} },
      )
      assert.strictEqual(page2.structuredContent.items.length, 10)
      assert.strictEqual(page2.structuredContent.hasMore, false)
    })

    test('paginates dlpRules', async () => {
      const rules = Array.from({ length: 30 }, (_, i) => ({
        name: `policies/rule${i}`,
        setting: {
          type: 'settings/rule.dlp',
          value: {
            displayName: `Rule ${i}`,
            state: 'ACTIVE',
            action: { chromeAction: { auditOnly: {} } },
            triggers: [],
          },
        },
      }))
      const { handler } = registerAndGetHandler({ dlpRules: rules })

      const page = await handler({ customerId: 'C0123', section: 'dlpRules', limit: 5, offset: 0 }, { requestInfo: {} })
      assert.strictEqual(page.structuredContent.items.length, 5)
      assert.strictEqual(page.structuredContent.total, 30)
      assert.strictEqual(page.structuredContent.hasMore, true)
      assert.ok(page.structuredContent.items[0].displayName)
      assert.ok(page.structuredContent.items[0].actionType)
    })

    test('returns all browserVersions without pagination', async () => {
      const { handler } = registerAndGetHandler({
        browserVersions: [
          { version: '134.0', count: '500', channel: 'STABLE' },
          { version: '135.0', count: '10', channel: 'BETA' },
        ],
      })
      const result = await handler({ customerId: 'C0123', section: 'browserVersions' }, { requestInfo: {} })
      assert.strictEqual(result.structuredContent.items.length, 2)
    })

    test('default page size is 50', async () => {
      const ous = Array.from({ length: 100 }, (_, i) => ({
        name: `OU ${i}`,
        orgUnitId: `id:ou${i}`,
        orgUnitPath: `/${i}`,
      }))
      const { handler } = registerAndGetHandler({ orgUnits: { organizationUnits: ous } })
      const result = await handler({ customerId: 'C0123', section: 'orgUnits' }, { requestInfo: {} })
      assert.strictEqual(result.structuredContent.items.length, 50)
    })
  })

  describe('Error Resilience', () => {
    test('handles API errors gracefully', async () => {
      const clients = createMockClients()
      clients.cloudIdentityClient.listDlpRules = mock.fn(async () => {
        throw new Error('API down')
      })
      clients.cloudIdentityClient.listDetectors = mock.fn(async () => {
        throw new Error('API down')
      })

      const handlers = {}
      const server = {
        registerTool: mock.fn((name, _desc, handler) => {
          handlers[name] = handler
        }),
      }
      registerDiagnoseEnvironmentTool(server, clients, { customerId: null, cachedRootOrgUnitId: null })

      const result = await handlers['diagnose_environment']({ customerId: 'C0123' }, { requestInfo: {} })
      assert.ok(result.structuredContent.issues, 'Should still return issues')
      assert.ok(result.structuredContent.dlpRules.total === 0, 'DLP rules should be 0 on error')
    })

    test('handles empty org units', async () => {
      const { handler } = registerAndGetHandler({ orgUnits: { organizationUnits: [] } })
      const result = await handler({ customerId: 'C0123' }, { requestInfo: {} })
      assert.strictEqual(result.structuredContent.orgUnitCount, 0)
    })
  })
})
