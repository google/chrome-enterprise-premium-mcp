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
import { FeatureFlags } from '../../lib/util/feature_flags.js'

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
    contentTransfers: {
      summaries: [
        { metric: 'CONTENT_TRANSFERS_METRIC_TOTAL_TRANSFERS', count: '100' },
        { metric: 'CONTENT_TRANSFERS_METRIC_SENSITIVE_DATA_TRANSFERS', count: '10' },
      ],
    },
    urlVisits: {
      summaries: [{ metric: 'URL_VISITS_METRIC_TOTAL_SUSPICIOUS_URL_VISITS', count: '5' }],
    },
    gateways: [],
    applications: [],
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
      queryContentTransfers: mock.fn(async () => cfg.contentTransfers),
      queryUrlVisits: mock.fn(async () => cfg.urlVisits),
    },
    chromePolicyClient: {
      getConnectorPolicy: mock.fn(async () => cfg.connectorPolicy),
      resolvePolicy: mock.fn(async () => cfg.resolvePolicy),
    },
    cloudIdentityClient: {
      listDlpRules: mock.fn(async () => cfg.dlpRules),
      listDetectors: mock.fn(async () => cfg.detectors),
    },
    beyondcorpClient: {
      listGateways: mock.fn(async () => cfg.gateways),
      listApplications: mock.fn(async () => cfg.applications),
    },
    cloudResourceManagerClient: {
      getProjectIamPolicy: mock.fn(async () => {
        if (cfg.projectIamPolicyError) {
          throw new Error(cfg.projectIamPolicyError)
        }
        return cfg.projectIamPolicy || { bindings: [] }
      }),
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

function registerAndGetHandler(clientOverrides = {}, options = {}) {
  const handlers = {}
  const server = createMockServer(handlers)
  const clients = createMockClients(clientOverrides)
  const fullOptions = { ...clients, ...options }
  registerDiagnoseEnvironmentTool(server, fullOptions, { customerId: null, cachedRootOrgUnitId: null })
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
      const { handler } = registerAndGetHandler({ subscription: null })
      const result = await handler({ customerId: 'C0123' }, { requestInfo: {} })
      const critical = result.structuredContent.issues.filter(i => i.severity === 'critical')
      assert.ok(critical.some(i => i.component === 'subscription'))
      assert.strictEqual(critical[0].message, 'No active Chrome Enterprise Premium subscription found on this domain.')
    })

    test('When subscription exists but has 0 users assigned, then it produces a warning issue', async () => {
      const { handler } = registerAndGetHandler({ subscription: { items: [] } })
      const result = await handler({ customerId: 'C0123' }, { requestInfo: {} })
      const warning = result.structuredContent.issues.filter(i => i.severity === 'warning')
      assert.ok(warning.some(i => i.component === 'subscription'))
      assert.strictEqual(
        warning[0].message,
        'Chrome Enterprise Premium subscription is active, but 0 users have licenses assigned. You must assign licenses to users.',
      )
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

    test('When Security Insights Data queries fail, then it produces medium issues with remediation', async () => {
      const clients = createMockClients()
      clients.chromeManagementClient.queryContentTransfers = mock.fn(async () => {
        throw new Error('Quota exceeded')
      })
      clients.chromeManagementClient.queryUrlVisits = mock.fn(async () => {
        throw new Error('Permission denied')
      })
      const handlers = {}
      const server = createMockServer(handlers)
      registerDiagnoseEnvironmentTool(server, clients, { customerId: null, cachedRootOrgUnitId: null })
      const result = await handlers['diagnose_environment']({ customerId: 'C0123' }, { requestInfo: {} })

      const issues = result.structuredContent.issues.filter(i => i.component === 'securityInsightsData')
      assert.strictEqual(issues.length, 2)
      assert.strictEqual(issues[0].severity, 'medium')
      assert.strictEqual(issues[1].severity, 'medium')
      assert.ok(
        result.content[0].text.includes('chrome.management.reports.readonly'),
        'Summary should suggest checking scopes',
      )
    })

    test('When Security Insights is disabled and queries fail, then it does not produce issues and reports N/A', async () => {
      const clients = createMockClients({
        securityInsights: { insightsState: 'INSIGHTS_DISABLED' },
      })
      clients.chromeManagementClient.queryContentTransfers = mock.fn(async () => {
        throw new Error('Quota exceeded')
      })
      clients.chromeManagementClient.queryUrlVisits = mock.fn(async () => {
        throw new Error('Permission denied')
      })
      const handlers = {}
      const server = createMockServer(handlers)
      registerDiagnoseEnvironmentTool(server, clients, { customerId: null, cachedRootOrgUnitId: null })
      const result = await handlers['diagnose_environment']({ customerId: 'C0123' }, { requestInfo: {} })

      const siIssues = result.structuredContent.issues.filter(i => i.component === 'securityInsights')
      assert.strictEqual(siIssues.length, 1)
      assert.strictEqual(siIssues[0].severity, 'critical')

      const dataIssues = result.structuredContent.issues.filter(i => i.component === 'securityInsightsData')
      assert.strictEqual(dataIssues.length, 0)

      assert.ok(
        result.content[0].text.includes('Status: N/A (Security Insights is disabled or unspecified)'),
        'Summary should report N/A for telemetry',
      )
      assert.ok(!result.content[0].text.includes('⚠️ Query failed'), 'Summary should not report query failure')
    })

    test('When Security Insights Data is healthy, then it reports stats in the summary', async () => {
      const { handler } = registerAndGetHandler({ connectorPolicy: [{ value: {} }] })
      const result = await handler({ customerId: 'C0123' }, { requestInfo: {} })

      assert.ok(result.content[0].text.includes('Content Transfers (Total/Sensitive): 100 / 10'))
      assert.ok(result.content[0].text.includes('Suspicious URL Visits: 5'))
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

  describe('Secure Gateway Diagnostics', () => {
    const enabledFlags = new FeatureFlags({ EXPERIMENT_SECURE_GATEWAY_ENABLED: 'true' })
    const disabledFlags = new FeatureFlags({ EXPERIMENT_SECURE_GATEWAY_ENABLED: 'false' })

    test('When experiment flag is disabled, then secureGateway section and checks are omitted', async () => {
      const { handler, clients } = registerAndGetHandler(
        { gateways: [{ name: 'projects/p1/locations/global/securityGateways/gw1', state: 'RUNNING' }] },
        { featureFlags: disabledFlags },
      )
      const result = await handler({ customerId: 'C0123', projectId: 'p1' }, { requestInfo: {} })
      assert.strictEqual(result.structuredContent.secureGateway, null)
      assert.strictEqual(clients.beyondcorpClient.listGateways.mock.callCount(), 0)
      assert.ok(!result.content[0].text.includes('Secure Gateways'))
    })

    test('When experiment flag is enabled but no projectId is provided, then secureGateway is reported as skipped', async () => {
      const { handler, clients } = registerAndGetHandler({}, { featureFlags: enabledFlags })
      const result = await handler({ customerId: 'C0123' }, { requestInfo: {} })
      assert.deepStrictEqual(result.structuredContent.secureGateway, { projectId: null, gateways: [], skipped: true })
      assert.strictEqual(clients.beyondcorpClient.listGateways.mock.callCount(), 0)
      assert.ok(result.content[0].text.includes("**Secure Gateways:** Not checked (provide 'projectId'"))
    })

    test('When experiment flag is enabled and healthy gateway exists, then zero issues are produced', async () => {
      const { handler } = registerAndGetHandler(
        {
          connectorPolicy: [{ value: {} }],
          gateways: [
            {
              name: 'projects/p1/locations/global/securityGateways/gw1',
              displayName: 'Gateway 1',
              state: 'RUNNING',
              serviceDiscovery: {},
            },
          ],
          applications: [
            {
              name: 'projects/p1/locations/global/securityGateways/gw1/applications/app1',
              displayName: 'App 1',
            },
          ],
        },
        { featureFlags: enabledFlags },
      )

      const result = await handler({ customerId: 'C0123', projectId: 'p1' }, { requestInfo: {} })
      const sg = result.structuredContent.secureGateway
      assert.ok(sg)
      assert.strictEqual(sg.gateways.length, 1)
      assert.strictEqual(sg.gateways[0].applications.length, 1)

      const sgIssues = result.structuredContent.issues.filter(i => i.component.startsWith('secureGateway'))
      assert.strictEqual(sgIssues.length, 0)
      assert.ok(
        result.content[0].text.includes(
          '**Secure Gateways (project: p1):** 1 total (1 active, 1 with Service Discovery, 1 app(s))',
        ),
      )
    })

    test('When gateway has non-ACTIVE state, missing service discovery, and zero apps, then corresponding issues are produced', async () => {
      const { handler } = registerAndGetHandler(
        {
          gateways: [
            {
              name: 'projects/p1/locations/global/securityGateways/gw1',
              displayName: 'Bad Gateway',
              state: 'ERROR',
            },
          ],
          applications: [],
        },
        { featureFlags: enabledFlags },
      )

      const result = await handler({ customerId: 'C0123', projectId: 'p1' }, { requestInfo: {} })
      const sgIssues = result.structuredContent.issues.filter(i => i.component === 'secureGateway')

      assert.ok(sgIssues.some(i => i.severity === 'critical' && i.message.includes('ERROR state')))
      assert.ok(sgIssues.some(i => i.severity === 'medium' && i.message.includes('Service Discovery')))
      assert.ok(sgIssues.some(i => i.severity === 'medium' && i.message.includes('no application routing')))
    })

    test('When gateway is in RUNNING state, then it is treated as healthy', async () => {
      const { handler } = registerAndGetHandler(
        {
          connectorPolicy: [{ value: {} }],
          gateways: [
            {
              name: 'projects/p1/locations/global/securityGateways/gw1',
              displayName: 'Running Gateway',
              state: 'RUNNING',
              serviceDiscovery: {},
            },
          ],
          applications: [
            {
              name: 'projects/p1/locations/global/securityGateways/gw1/applications/app1',
              displayName: 'App 1',
            },
          ],
        },
        { featureFlags: enabledFlags },
      )

      const result = await handler({ customerId: 'C0123', projectId: 'p1' }, { requestInfo: {} })
      const sgIssues = result.structuredContent.issues.filter(i => i.component === 'secureGateway')
      assert.strictEqual(sgIssues.length, 0)
    })

    test('When gateway is in ERROR, DOWN, or CREATING state, then appropriate severity issues are reported', async () => {
      const { handler } = registerAndGetHandler(
        {
          gateways: [
            {
              name: 'projects/p1/locations/global/securityGateways/gw1',
              displayName: 'Err Gateway',
              state: 'ERROR',
              serviceDiscovery: {},
            },
            {
              name: 'projects/p1/locations/global/securityGateways/gw2',
              displayName: 'Down Gateway',
              state: 'DOWN',
              serviceDiscovery: {},
            },
            {
              name: 'projects/p1/locations/global/securityGateways/gw3',
              displayName: 'Creating Gateway',
              state: 'CREATING',
              serviceDiscovery: {},
            },
          ],
          applications: [],
        },
        { featureFlags: enabledFlags },
      )

      const result = await handler({ customerId: 'C0123', projectId: 'p1' }, { requestInfo: {} })
      const sgIssues = result.structuredContent.issues.filter(i => i.component === 'secureGateway')

      assert.ok(sgIssues.some(i => i.severity === 'critical' && i.message.includes('ERROR state')))
      assert.ok(sgIssues.some(i => i.severity === 'high' && i.message.includes('DOWN state')))
      assert.ok(sgIssues.some(i => i.severity === 'medium' && i.message.includes('CREATING state')))
    })

    test('When application routes non-HTTPS ports (e.g. 80 without 443), then an issue is produced according to Knowledge Addendum #8', async () => {
      const { handler } = registerAndGetHandler(
        {
          gateways: [
            {
              name: 'projects/p1/locations/global/securityGateways/gw1',
              displayName: 'Gateway 1',
              state: 'RUNNING',
              serviceDiscovery: {},
            },
          ],
          applications: [
            {
              name: 'projects/p1/locations/global/securityGateways/gw1/applications/app1',
              displayName: 'HTTP App',
              endpointMatchers: [{ hostname: 'app.local', ports: [80] }],
            },
          ],
        },
        { featureFlags: enabledFlags },
      )

      const result = await handler({ customerId: 'C0123', projectId: 'p1' }, { requestInfo: {} })
      const appIssues = result.structuredContent.issues.filter(i => i.component === 'secureGateway.application')
      assert.strictEqual(appIssues.length, 1)
      assert.strictEqual(appIssues[0].severity, 'medium')
      assert.ok(appIssues[0].message.includes('routes port 80'))
    })

    test('When listGateways API fails, then it produces a medium issue and reports query failure', async () => {
      const clients = createMockClients()
      clients.beyondcorpClient.listGateways = mock.fn(async () => {
        throw new Error('API unavailable')
      })

      const handlers = {}
      const server = createMockServer(handlers)
      registerDiagnoseEnvironmentTool(
        server,
        { ...clients, featureFlags: enabledFlags },
        { customerId: null, cachedRootOrgUnitId: null },
      )

      const result = await handlers['diagnose_environment'](
        { customerId: 'C0123', projectId: 'p1' },
        { requestInfo: {} },
      )
      const sgIssues = result.structuredContent.issues.filter(i => i.component === 'secureGateway')
      assert.strictEqual(sgIssues.length, 1)
      assert.strictEqual(sgIssues[0].severity, 'medium')
      assert.ok(sgIssues[0].message.includes('API unavailable'))
      assert.ok(result.content[0].text.includes('**Secure Gateways (project: p1):** ⚠️ Query failed'))
    })

    test('When detail section secureGateways is requested, then paginated gateways are returned', async () => {
      const { handler } = registerAndGetHandler(
        {
          gateways: [
            {
              name: 'projects/p1/locations/global/securityGateways/gw1',
              displayName: 'Gateway 1',
              state: 'RUNNING',
              serviceDiscovery: {},
            },
            {
              name: 'projects/p1/locations/global/securityGateways/gw2',
              displayName: 'Gateway 2',
              state: 'RUNNING',
            },
          ],
          applications: [],
        },
        { featureFlags: enabledFlags },
      )

      const result = await handler(
        { customerId: 'C0123', projectId: 'p1', section: 'secureGateways', limit: 1, offset: 0 },
        { requestInfo: {} },
      )
      const sc = result.structuredContent
      assert.strictEqual(sc.section, 'secureGateways')
      assert.strictEqual(sc.items.length, 1)
      assert.strictEqual(sc.total, 2)
      assert.strictEqual(sc.hasMore, true)
      assert.strictEqual(sc.items[0].displayName, 'Gateway 1')
      assert.strictEqual(sc.items[0].serviceDiscovery, true)
    })

    test('When private web app is configured and delegating SA is missing roles/beyondcorp.upstreamAccess, then it produces a high issue', async () => {
      const { handler } = registerAndGetHandler(
        {
          gateways: [
            {
              name: 'projects/p1/locations/global/securityGateways/gw1',
              displayName: 'Gateway 1',
              state: 'ACTIVE',
              serviceDiscovery: {},
              delegatingServiceAccount: 'sa-123@gcp-sa-beyondcorp.iam.gserviceaccount.com',
            },
          ],
          applications: [
            {
              name: 'projects/p1/locations/global/securityGateways/gw1/applications/app1',
              displayName: 'Private Web App',
              upstreams: [{ network: { name: 'projects/p1/global/networks/prod-vpc' } }],
            },
          ],
          projectIamPolicy: {
            bindings: [{ role: 'roles/viewer', members: ['user:alice@company.com'] }],
          },
        },
        { featureFlags: enabledFlags },
      )

      const result = await handler({ customerId: 'C0123', projectId: 'p1' }, { requestInfo: {} })
      const iamIssues = result.structuredContent.issues.filter(i => i.component === 'secureGateway.iam')
      assert.strictEqual(iamIssues.length, 1)
      assert.strictEqual(iamIssues[0].severity, 'high')
      assert.ok(iamIssues[0].message.includes("is not directly granted 'roles/beyondcorp.upstreamAccess'"))
      assert.deepStrictEqual(iamIssues[0].remediation, {
        actionLabel: 'Verify or Grant GCP IAM Roles',
        url: 'https://console.cloud.google.com/iam-admin/iam?project=p1',
      })
    })

    test('When private web app is configured but delegating SA is missing on gateway resource, then it produces a high issue', async () => {
      const { handler } = registerAndGetHandler(
        {
          gateways: [
            {
              name: 'projects/p1/locations/global/securityGateways/gw1',
              displayName: 'Gateway 1',
              state: 'ACTIVE',
              serviceDiscovery: {},
            },
          ],
          applications: [
            {
              name: 'projects/p1/locations/global/securityGateways/gw1/applications/app1',
              displayName: 'Private Web App',
              upstreams: [{ network: { name: 'projects/p1/global/networks/prod-vpc' } }],
            },
          ],
          projectIamPolicy: {
            bindings: [{ role: 'roles/viewer', members: ['user:alice@company.com'] }],
          },
        },
        { featureFlags: enabledFlags },
      )

      const result = await handler({ customerId: 'C0123', projectId: 'p1' }, { requestInfo: {} })
      const iamIssues = result.structuredContent.issues.filter(i => i.component === 'secureGateway.iam')
      assert.strictEqual(iamIssues.length, 1)
      assert.strictEqual(iamIssues[0].severity, 'high')
      assert.ok(iamIssues[0].message.includes('no delegating service account is specified'))
    })

    test('When private web app is configured and delegating SA HAS roles/beyondcorp.upstreamAccess, then no IAM issue is raised', async () => {
      const { handler } = registerAndGetHandler(
        {
          gateways: [
            {
              name: 'projects/p1/locations/global/securityGateways/gw1',
              displayName: 'Gateway 1',
              state: 'ACTIVE',
              serviceDiscovery: {},
              delegatingServiceAccount: 'sa-123@gcp-sa-beyondcorp.iam.gserviceaccount.com',
            },
          ],
          applications: [
            {
              name: 'projects/p1/locations/global/securityGateways/gw1/applications/app1',
              displayName: 'Private Web App',
              upstreams: [{ network: { name: 'projects/p1/global/networks/prod-vpc' } }],
            },
          ],
          projectIamPolicy: {
            bindings: [
              {
                role: 'roles/beyondcorp.upstreamAccess',
                members: ['serviceAccount:sa-123@gcp-sa-beyondcorp.iam.gserviceaccount.com'],
              },
            ],
          },
        },
        { featureFlags: enabledFlags },
      )

      const result = await handler({ customerId: 'C0123', projectId: 'p1' }, { requestInfo: {} })
      const iamIssues = result.structuredContent.issues.filter(i => i.component === 'secureGateway.iam')
      assert.strictEqual(iamIssues.length, 0)
    })

    test('When project IAM policy query fails with 403, then it produces a medium issue with manual remediation link', async () => {
      const { handler } = registerAndGetHandler(
        {
          gateways: [
            {
              name: 'projects/p1/locations/global/securityGateways/gw1',
              displayName: 'Gateway 1',
              state: 'ACTIVE',
            },
          ],
          projectIamPolicyError: '403 Forbidden',
        },
        { featureFlags: enabledFlags },
      )

      const result = await handler({ customerId: 'C0123', projectId: 'p1' }, { requestInfo: {} })
      const iamIssues = result.structuredContent.issues.filter(i => i.component === 'secureGateway.iam')
      assert.strictEqual(iamIssues.length, 1)
      assert.strictEqual(iamIssues[0].severity, 'medium')
      assert.ok(iamIssues[0].message.includes('Unable to automatically verify delegating service account permissions'))
      assert.deepStrictEqual(iamIssues[0].remediation, {
        actionLabel: 'Verify GCP IAM Roles Manually',
        url: 'https://console.cloud.google.com/iam-admin/iam?project=p1',
      })
    })

    test('When Private Web App is present and ingress firewall rule for secure gateway is missing, then it produces a high severity firewall issue', async () => {
      const mockComputeClient = {
        listFirewalls: mock.fn(async () => ({ items: [] })),
      }
      const handlers = {}
      const server = createMockServer(handlers)
      const mockClients = createMockClients()
      mockClients.beyondcorpClient.listGateways = mock.fn(async () => [
        {
          name: 'projects/p1/locations/global/securityGateways/gw1',
          displayName: 'Gateway 1',
          state: 'RUNNING',
          delegatingServiceAccount: 'sa@gcp.iam.gserviceaccount.com',
          serviceDiscovery: {},
        },
      ])
      mockClients.beyondcorpClient.listApplications = mock.fn(async () => [
        {
          name: 'projects/p1/locations/global/securityGateways/gw1/applications/app1',
          displayName: 'App 1',
          endpointMatchers: [{ ports: [443] }],
          upstreams: [{ network: 'projects/p1/global/networks/vpc1' }],
        },
      ])

      registerDiagnoseEnvironmentTool(
        server,
        { ...mockClients, computeClient: mockComputeClient, featureFlags: enabledFlags },
        { customerId: null, cachedRootOrgUnitId: null },
      )

      const result = await handlers['diagnose_environment'](
        { customerId: 'C0123', projectId: 'p1' },
        { requestInfo: {} },
      )

      const fwIssues = result.structuredContent.issues.filter(i => i.component === 'secureGateway.firewall')
      assert.strictEqual(fwIssues.length, 1)
      assert.strictEqual(fwIssues[0].severity, 'high')
      assert.ok(fwIssues[0].message.includes('Ingress firewall rule allowing TCP traffic from secure gateway range'))
      assert.ok(fwIssues[0].remediation.command.includes('gcloud compute firewall-rules create'))
    })

    test('When App has multiple upstreams on the same VPC network, then it produces exactly 1 firewall issue per network', async () => {
      const mockComputeClient = {
        listFirewalls: mock.fn(async () => ({ items: [] })),
      }
      const handlers = {}
      const server = createMockServer(handlers)
      const mockClients = createMockClients()
      mockClients.beyondcorpClient.listGateways = mock.fn(async () => [
        {
          name: 'projects/p1/locations/global/securityGateways/gw1',
          displayName: 'Gateway 1',
          state: 'RUNNING',
          delegatingServiceAccount: 'sa@gcp.iam.gserviceaccount.com',
          serviceDiscovery: {},
        },
      ])
      mockClients.beyondcorpClient.listApplications = mock.fn(async () => [
        {
          name: 'projects/p1/locations/global/securityGateways/gw1/applications/app1',
          displayName: 'App 1',
          endpointMatchers: [{ ports: [443] }],
          upstreams: [
            { network: 'projects/p1/global/networks/vpc1', upstreamUri: '10.0.0.5:443' },
            { network: 'projects/p1/global/networks/vpc1', upstreamUri: '10.0.0.6:443' },
          ],
        },
      ])

      registerDiagnoseEnvironmentTool(
        server,
        { ...mockClients, computeClient: mockComputeClient, featureFlags: enabledFlags },
        { customerId: null, cachedRootOrgUnitId: null },
      )

      const result = await handlers['diagnose_environment'](
        { customerId: 'C0123', projectId: 'p1' },
        { requestInfo: {} },
      )

      const fwIssues = result.structuredContent.issues.filter(i => i.component === 'secureGateway.firewall')
      assert.strictEqual(fwIssues.length, 1, 'Should deduplicate missing firewall rules per unique network')
      assert.ok(fwIssues[0].message.includes('vpc1'))
    })

    test('When matching allow firewall rule is disabled, then it ignores it and produces missing firewall issue', async () => {
      const mockComputeClient = {
        listFirewalls: mock.fn(async () => ({
          items: [
            {
              direction: 'INGRESS',
              action: 'ALLOW',
              disabled: true,
              network: 'projects/p1/global/networks/vpc1',
              sourceRanges: ['136.124.16.0/20'],
              allowed: [{ IPProtocol: 'tcp', ports: ['443'] }],
            },
          ],
        })),
      }
      const handlers = {}
      const server = createMockServer(handlers)
      const mockClients = createMockClients()
      mockClients.beyondcorpClient.listGateways = mock.fn(async () => [
        {
          name: 'projects/p1/locations/global/securityGateways/gw1',
          displayName: 'Gateway 1',
          state: 'RUNNING',
          delegatingServiceAccount: 'sa@gcp.iam.gserviceaccount.com',
          serviceDiscovery: {},
        },
      ])
      mockClients.beyondcorpClient.listApplications = mock.fn(async () => [
        {
          name: 'projects/p1/locations/global/securityGateways/gw1/applications/app1',
          displayName: 'App 1',
          endpointMatchers: [{ ports: [443] }],
          upstreams: [{ network: 'projects/p1/global/networks/vpc1' }],
        },
      ])

      registerDiagnoseEnvironmentTool(
        server,
        { ...mockClients, computeClient: mockComputeClient, featureFlags: enabledFlags },
        { customerId: null, cachedRootOrgUnitId: null },
      )

      const result = await handlers['diagnose_environment'](
        { customerId: 'C0123', projectId: 'p1' },
        { requestInfo: {} },
      )

      const fwIssues = result.structuredContent.issues.filter(i => i.component === 'secureGateway.firewall')
      assert.strictEqual(fwIssues.length, 1, 'Disabled rule should be ignored')
    })

    test('When firewall rule specifies port ranges like 80-443, then it recognizes port 443 as allowed', async () => {
      const mockComputeClient = {
        listFirewalls: mock.fn(async () => ({
          items: [
            {
              direction: 'INGRESS',
              action: 'ALLOW',
              disabled: false,
              network: 'projects/p1/global/networks/vpc1',
              sourceRanges: ['136.124.16.0/20'],
              allowed: [{ IPProtocol: 'tcp', ports: ['80-443'] }],
            },
          ],
        })),
      }
      const handlers = {}
      const server = createMockServer(handlers)
      const mockClients = createMockClients()
      mockClients.beyondcorpClient.listGateways = mock.fn(async () => [
        {
          name: 'projects/p1/locations/global/securityGateways/gw1',
          displayName: 'Gateway 1',
          state: 'RUNNING',
          delegatingServiceAccount: 'sa@gcp.iam.gserviceaccount.com',
          serviceDiscovery: {},
        },
      ])
      mockClients.beyondcorpClient.listApplications = mock.fn(async () => [
        {
          name: 'projects/p1/locations/global/securityGateways/gw1/applications/app1',
          displayName: 'App 1',
          endpointMatchers: [{ ports: [443] }],
          upstreams: [{ network: 'projects/p1/global/networks/vpc1' }],
        },
      ])

      registerDiagnoseEnvironmentTool(
        server,
        { ...mockClients, computeClient: mockComputeClient, featureFlags: enabledFlags },
        { customerId: null, cachedRootOrgUnitId: null },
      )

      const result = await handlers['diagnose_environment'](
        { customerId: 'C0123', projectId: 'p1' },
        { requestInfo: {} },
      )

      const fwIssues = result.structuredContent.issues.filter(i => i.component === 'secureGateway.firewall')
      assert.strictEqual(fwIssues.length, 0, 'Port 443 within 80-443 range should be recognized as allowed')
    })

    test('When u.network is an object with full URI containing project number, then it matches compute firewall rule with project ID', async () => {
      const mockComputeClient = {
        listFirewalls: mock.fn(async () => ({
          items: [
            {
              direction: 'INGRESS',
              action: 'ALLOW',
              disabled: false,
              network: 'projects/brett-public-preview/global/networks/default',
              sourceRanges: ['136.124.16.0/20'],
              allowed: [{ IPProtocol: 'tcp', ports: ['443'] }],
            },
          ],
        })),
      }
      const handlers = {}
      const server = createMockServer(handlers)
      const mockClients = createMockClients()
      mockClients.beyondcorpClient.listGateways = mock.fn(async () => [
        {
          name: 'projects/p1/locations/global/securityGateways/gw1',
          displayName: 'Gateway 1',
          state: 'RUNNING',
          delegatingServiceAccount: 'sa@gcp.iam.gserviceaccount.com',
          serviceDiscovery: {},
        },
      ])
      mockClients.beyondcorpClient.listApplications = mock.fn(async () => [
        {
          name: 'projects/p1/locations/global/securityGateways/gw1/applications/app1',
          displayName: 'App 1',
          endpointMatchers: [{ ports: [443] }],
          upstreams: [
            {
              network: {
                name: 'projects/498461174898/global/networks/default',
              },
            },
          ],
        },
      ])

      registerDiagnoseEnvironmentTool(
        server,
        { ...mockClients, computeClient: mockComputeClient, featureFlags: enabledFlags },
        { customerId: null, cachedRootOrgUnitId: null },
      )

      const result = await handlers['diagnose_environment'](
        { customerId: 'C0123', projectId: 'brett-public-preview' },
        { requestInfo: {} },
      )

      const fwIssues = result.structuredContent.issues.filter(i => i.component === 'secureGateway.firewall')
      assert.strictEqual(
        fwIssues.length,
        0,
        'Project number in u.network.name object should correctly resolve basename default',
      )
    })

    test('When matching allow firewall rule has targetTags, then it ignores it and reports missing network-wide firewall rule', async () => {
      const mockComputeClient = {
        listFirewalls: mock.fn(async () => ({
          items: [
            {
              direction: 'INGRESS',
              action: 'ALLOW',
              disabled: false,
              network: 'projects/p1/global/networks/vpc1',
              targetTags: ['http-server'],
              sourceRanges: ['136.124.16.0/20'],
              allowed: [{ IPProtocol: 'tcp', ports: ['443'] }],
            },
          ],
        })),
      }
      const handlers = {}
      const server = createMockServer(handlers)
      const mockClients = createMockClients()
      mockClients.beyondcorpClient.listGateways = mock.fn(async () => [
        {
          name: 'projects/p1/locations/global/securityGateways/gw1',
          displayName: 'Gateway 1',
          state: 'RUNNING',
          delegatingServiceAccount: 'sa@gcp.iam.gserviceaccount.com',
          serviceDiscovery: {},
        },
      ])
      mockClients.beyondcorpClient.listApplications = mock.fn(async () => [
        {
          name: 'projects/p1/locations/global/securityGateways/gw1/applications/app1',
          displayName: 'App 1',
          endpointMatchers: [{ ports: [443] }],
          upstreams: [{ network: 'projects/p1/global/networks/vpc1' }],
        },
      ])

      registerDiagnoseEnvironmentTool(
        server,
        { ...mockClients, computeClient: mockComputeClient, featureFlags: enabledFlags },
        { customerId: null, cachedRootOrgUnitId: null },
      )

      const result = await handlers['diagnose_environment'](
        { customerId: 'C0123', projectId: 'p1' },
        { requestInfo: {} },
      )

      const fwIssues = result.structuredContent.issues.filter(i => i.component === 'secureGateway.firewall')
      assert.strictEqual(fwIssues.length, 1, 'Rule with targetTags should be skipped to require a network-wide rule')
    })

    test('When compute listFirewalls throws error, then it produces a medium severity firewall issue with manual remediation link', async () => {
      const mockComputeClient = {
        listFirewalls: mock.fn(async () => {
          throw new Error('403 Forbidden: Missing compute.firewalls.list')
        }),
      }
      const handlers = {}
      const server = createMockServer(handlers)
      const mockClients = createMockClients()
      mockClients.beyondcorpClient.listGateways = mock.fn(async () => [
        {
          name: 'projects/p1/locations/global/securityGateways/gw1',
          displayName: 'Gateway 1',
          state: 'RUNNING',
          delegatingServiceAccount: 'sa@gcp.iam.gserviceaccount.com',
          serviceDiscovery: {},
        },
      ])
      mockClients.beyondcorpClient.listApplications = mock.fn(async () => [
        {
          name: 'projects/p1/locations/global/securityGateways/gw1/applications/app1',
          displayName: 'App 1',
          endpointMatchers: [{ ports: [443] }],
          upstreams: [{ network: 'projects/p1/global/networks/vpc1' }],
        },
      ])

      registerDiagnoseEnvironmentTool(
        server,
        { ...mockClients, computeClient: mockComputeClient, featureFlags: enabledFlags },
        { customerId: null, cachedRootOrgUnitId: null },
      )

      const result = await handlers['diagnose_environment'](
        { customerId: 'C0123', projectId: 'p1' },
        { requestInfo: {} },
      )

      const fwIssues = result.structuredContent.issues.filter(i => i.component === 'secureGateway.firewall')
      assert.strictEqual(fwIssues.length, 1)
      assert.strictEqual(fwIssues[0].severity, 'medium')
      assert.ok(fwIssues[0].message.includes('Unable to automatically verify VPC ingress firewall rules'))
      assert.ok(fwIssues[0].remediation.url.includes('console.cloud.google.com/net-security/firewall-manager'))
    })

    test('When upstream URI is CGNAT IP (100.10.1.1) without network, then it is excluded from private VPC firewall checks', async () => {
      const mockComputeClient = {
        listFirewalls: mock.fn(async () => ({ items: [] })),
      }
      const handlers = {}
      const server = createMockServer(handlers)
      const mockClients = createMockClients()
      mockClients.beyondcorpClient.listGateways = mock.fn(async () => [
        {
          name: 'projects/p1/locations/global/securityGateways/gw1',
          displayName: 'Gateway 1',
          state: 'RUNNING',
          delegatingServiceAccount: 'sa@gcp.iam.gserviceaccount.com',
          serviceDiscovery: {},
        },
      ])
      mockClients.beyondcorpClient.listApplications = mock.fn(async () => [
        {
          name: 'projects/p1/locations/global/securityGateways/gw1/applications/app1',
          displayName: 'App 1',
          endpointMatchers: [{ ports: [8080] }],
          upstreams: [{ upstreamUri: '100.10.1.1:8080' }],
        },
      ])

      registerDiagnoseEnvironmentTool(
        server,
        { ...mockClients, computeClient: mockComputeClient, featureFlags: enabledFlags },
        { customerId: null, cachedRootOrgUnitId: null },
      )

      const result = await handlers['diagnose_environment'](
        { customerId: 'C0123', projectId: 'p1' },
        { requestInfo: {} },
      )

      const fwIssues = result.structuredContent.issues.filter(i => i.component === 'secureGateway.firewall')
      assert.strictEqual(
        fwIssues.length,
        0,
        'CGNAT IP without network should be treated as non-private and excluded from firewall checks',
      )
    })
  })
})
