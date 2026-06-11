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
    securityInsights: { insightsState: 'INSIGHTS_ENABLED' },
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
      checkSecurityInsightsStatus: mock.fn(async () => cfg.securityInsights),
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

function createMockServer(handlers) {
  return {
    registerTool: mock.fn((name, _desc, handler) => {
      handlers[name] = (params, context = {}) => {
        const requestInfo = context.requestInfo || {}
        const headers = requestInfo.headers || {}
        if (!headers.authorization) {
          headers.authorization = 'Bearer mock-token'
        }
        requestInfo.headers = headers
        context.requestInfo = requestInfo
        return handler(params, context)
      }
    }),
  }
}

function registerAndGetHandler(clientOverrides = {}) {
  const handlers = {}
  const server = createMockServer(handlers)
  const clients = createMockClients(clientOverrides)
  registerDiagnoseEnvironmentTool(server, clients, { customerId: null, cachedRootOrgUnitId: null })
  return { handler: handlers['diagnose_environment'], clients }
}

describe('diagnose_environment', () => {
  describe('Summary Mode', () => {
    test('When environment is healthy, then it produces zero issues', async () => {
      const { handler } = registerAndGetHandler({
        connectorPolicy: [
          {
            value: {
              value: {
                // Satisfies non-reporting connectors (Upload, Download, Paste, Print)
                serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
                delayDeliveryUntilVerdict: true,
                // Satisfies URL check connector
                realtimeUrlCheckEnabled: true,
                // Satisfies Reporting connector
                reportingConnector: {
                  eventConfiguration: {
                    enabledEventNames: [
                      'contentTransferEvent',
                      'unscannedFileEvent',
                      'dangerousDownloadEvent',
                      'sensitiveDataEvent',
                      'interstitialEvent',
                      'urlFilteringInterstitialEvent',
                      'suspiciousUrlEvent',
                    ],
                  },
                },
              },
            },
          },
        ],
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

    test('When no subscription exists, then it produces a critical issue', async () => {
      const { handler } = registerAndGetHandler({ subscription: { items: [] } })
      const result = await handler({ customerId: 'C0123' }, { requestInfo: {} })
      const critical = result.structuredContent.issues.filter(i => i.severity === 'critical')
      assert.ok(critical.some(i => i.component === 'subscription'))
    })

    test('When only a single license is found, then it produces a medium issue', async () => {
      const { handler } = registerAndGetHandler({ subscription: { items: [{ userId: 'a@b.com' }] } })
      const result = await handler({ customerId: 'C0123' }, { requestInfo: {} })
      const medium = result.structuredContent.issues.filter(i => i.severity === 'medium')
      assert.ok(medium.some(i => i.component === 'subscription'))
    })

    test('When connectors are missing, then it produces critical issues for each type', async () => {
      const { handler } = registerAndGetHandler({ connectorPolicy: [] })
      const result = await handler({ customerId: 'C0123' }, { requestInfo: {} })
      const connectorIssues = result.structuredContent.issues.filter(i => i.component.startsWith('connector.'))
      assert.ok(connectorIssues.length === 6, `Expected 6 missing connector issues, got ${connectorIssues.length}`)
      assert.ok(connectorIssues.every(i => i.severity === 'critical'))
    })

    test('When no DLP rules are configured, then it produces a high issue', async () => {
      const { handler } = registerAndGetHandler({ connectorPolicy: [{ value: {} }] })
      const result = await handler({ customerId: 'C0123' }, { requestInfo: {} })
      const high = result.structuredContent.issues.filter(i => i.severity === 'high')
      assert.ok(high.some(i => i.component === 'dlpRules'))
    })

    test('When gaps are found in environment, then the generated issues contain structured remediation metadata and deep-links', async () => {
      const { handler } = registerAndGetHandler({
        connectorPolicy: [],
        dlpRules: [],
        securityInsights: { insightsState: 'INSIGHTS_DISABLED' },
        resolvePolicy: [],
      })
      const result = await handler({ customerId: 'C0123' }, { requestInfo: {} })
      const issues = result.structuredContent.issues
      const connectors = result.structuredContent.connectors

      // Verify connector issues have structured remediation
      const uploadIssue = issues.find(i => i.component === 'connector.uploadAnalysis')
      assert.ok(uploadIssue.message.includes('https://admin.google.com/ac/chrome/settings/user/details/file_attached'))
      assert.deepStrictEqual(uploadIssue.remediation, {
        actionLabel: 'Configure Upload content analysis connector',
        url: 'https://admin.google.com/ac/chrome/settings/user/details/file_attached',
      })

      // Verify DLP rules issue has structured remediation
      const dlpIssue = issues.find(i => i.component === 'dlpRules')
      assert.ok(dlpIssue.message.includes('https://admin.google.com/ac/dp/rules'))
      assert.deepStrictEqual(dlpIssue.remediation, {
        actionLabel: 'Create DLP rules',
        url: 'https://admin.google.com/ac/dp/rules',
      })

      // Verify SEB extension issue has structured remediation
      const sebIssue = issues.find(i => i.component === 'sebExtension')
      assert.ok(sebIssue.message.includes('https://admin.google.com/ac/chrome/apps/user'))
      assert.deepStrictEqual(sebIssue.remediation, {
        actionLabel: 'Configure SEB force-installation',
        url: 'https://admin.google.com/ac/chrome/apps/user',
      })

      // Verify Security Insights issue has no manual remediation link
      const insightsIssue = issues.find(i => i.component === 'securityInsights')
      assert.strictEqual(insightsIssue.severity, 'critical')
      assert.ok(!insightsIssue.remediation)
      assert.ok(!insightsIssue.message.includes('https://admin.google.com/ac/dp'))

      // Verify connectors object contains individual deep-links even when unconfigured
      assert.strictEqual(
        connectors.uploadAnalysis.uiLink,
        'https://admin.google.com/ac/chrome/settings/user/details/file_attached',
      )
      assert.strictEqual(
        connectors.securityEventReporting.uiLink,
        'https://admin.google.com/ac/chrome/settings/user/details/on_security_event',
      )
    })

    test('When rules are audit-only, then it produces a medium issue', async () => {
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

    test('When Security Insights is disabled, then it produces a critical issue with remediation action in summary', async () => {
      const { handler } = registerAndGetHandler({ securityInsights: { insightsState: 'INSIGHTS_DISABLED' } })
      const result = await handler({ customerId: 'C0123' }, { requestInfo: {} })
      const issues = result.structuredContent.issues.filter(i => i.component === 'securityInsights')
      assert.strictEqual(issues.length, 1)
      assert.strictEqual(issues[0].severity, 'critical')
      assert.ok(result.content[0].text.includes('security_insights enable'), 'Summary should suggest enabling the tool')
    })

    test('When Security Insights is unspecified, then it produces a medium issue', async () => {
      const { handler } = registerAndGetHandler({
        securityInsights: { insightsState: 'INSIGHTS_ENABLEMENT_STATE_UNSPECIFIED' },
      })
      const result = await handler({ customerId: 'C0123' }, { requestInfo: {} })
      const issues = result.structuredContent.issues.filter(i => i.component === 'securityInsights')
      assert.strictEqual(issues.length, 1)
      assert.strictEqual(issues[0].severity, 'medium')
    })

    test('When Security Insights check fails, then it handles the error gracefully and lists it as medium issue', async () => {
      const clients = createMockClients()
      clients.chromeManagementClient.checkSecurityInsightsStatus = mock.fn(async () => {
        throw new Error('API failure')
      })
      const handlers = {}
      const server = createMockServer(handlers)
      registerDiagnoseEnvironmentTool(server, clients, { customerId: null, cachedRootOrgUnitId: null })
      const result = await handlers['diagnose_environment']({ customerId: 'C0123' }, { requestInfo: {} })
      assert.strictEqual(result.isError, undefined) // Should not fail the diagnostic run
      const issues = result.structuredContent.issues.filter(i => i.component === 'securityInsights')
      assert.strictEqual(issues.length, 1)
      assert.strictEqual(issues[0].severity, 'medium')
    })

    test('When diagnosis is run, then it returns summary counts rather than raw arrays', async () => {
      const { handler } = registerAndGetHandler()
      const result = await handler({ customerId: 'C0123' }, { requestInfo: {} })
      const sc = result.structuredContent
      assert.ok(typeof sc.orgUnitCount === 'number')
      assert.ok(typeof sc.dlpRules.total === 'number')
      assert.ok(typeof sc.detectors.total === 'number')
      assert.ok(typeof sc.browserVersions.total === 'number')
    })

    test('When DLP rules are analyzed, then the action breakdown includes watermark actions', async () => {
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

    test('When customerId is omitted, then it is automatically resolved', async () => {
      const { handler } = registerAndGetHandler({ connectorPolicy: [{ value: {} }] })
      const result = await handler({}, { requestInfo: {} })
      assert.ok(result.structuredContent.customer.customerId, 'Customer ID resolved')
    })
  })

  describe('Detail/Pagination Mode', () => {
    test('When orgUnits section is requested, then results are correctly paginated', async () => {
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

    test('When dlpRules section is requested, then results are correctly paginated with formatted actions', async () => {
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

    test('When browserVersions section is requested, then it returns all versions without pagination', async () => {
      const { handler } = registerAndGetHandler({
        browserVersions: [
          { version: '134.0', count: '500', channel: 'STABLE' },
          { version: '135.0', count: '10', channel: 'BETA' },
        ],
      })
      const result = await handler({ customerId: 'C0123', section: 'browserVersions' }, { requestInfo: {} })
      assert.strictEqual(result.structuredContent.items.length, 2)
    })

    test('When no limit is provided for pagination, then it defaults to 50', async () => {
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

  describe('Error Handling', () => {
    test('When non-auth API errors occur, then they propagate and return error response', async () => {
      const clients = createMockClients()
      clients.cloudIdentityClient.listDlpRules = mock.fn(async () => {
        throw new Error('API down')
      })

      const handlers = {}
      const server = createMockServer(handlers)
      registerDiagnoseEnvironmentTool(server, clients, { customerId: null, cachedRootOrgUnitId: null })

      const result = await handlers['diagnose_environment']({ customerId: 'C0123' }, { requestInfo: {} })
      assert.strictEqual(result.isError, true)
      assert.ok(result.content[0].text.includes('Error: API down'))
    })

    test('When authentication errors occur, then it returns remediation instructions', async () => {
      const clients = createMockClients()
      clients.cloudIdentityClient.listDlpRules = mock.fn(async () => {
        const err = new Error('UNAUTHENTICATED')
        err.status = 401
        throw err
      })

      const handlers = {}
      const server = createMockServer(handlers)
      registerDiagnoseEnvironmentTool(server, clients, { customerId: null, cachedRootOrgUnitId: null })

      const result = await handlers['diagnose_environment']({ customerId: 'C0123' }, { requestInfo: {} })
      assert.strictEqual(result.isError, true)
      assert.ok(result.content[0].text.includes('Authentication required'))
    })

    test('When org units list is empty, then it is handled gracefully', async () => {
      const { handler } = registerAndGetHandler({ orgUnits: { organizationUnits: [] } })
      const result = await handler({ customerId: 'C0123' }, { requestInfo: {} })
      assert.strictEqual(result.structuredContent.orgUnitCount, 0)
    })
  })
})
