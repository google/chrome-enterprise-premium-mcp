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
 * @file In-process fake Google API server for integration testing.
 *
 * Replaces the Python FastAPI fake_cep_api_server.py. Provides the same
 * endpoints and in-memory state, but runs as an Express app that can be
 * imported directly by JS tests (no subprocess spawning).
 */

import express from 'express'
import { randomUUID } from 'node:crypto'

/**
 * @param {string|number|undefined} key
 * @returns {boolean} true when the key is safe to use as a plain-object property.
 */
function isSafeKey(key) {
  if (key === undefined || key === null) {
    return false
  }
  const strKey = String(key)
  return strKey !== '__proto__' && strKey !== 'constructor' && strKey !== 'prototype'
}

/**
 * Build a null-prototype map containing the given entries. We use this for
 * every state container that the route handlers index with user-controlled
 * keys (customerId, orgUnitId, productId, schemaName, serviceName, …) so
 * `state.customers['__proto__']` and friends return undefined instead of
 * walking up to Object.prototype.
 * @param {object} entries Initial enumerable own properties to copy in.
 * @returns {object} A null-prototype map populated with `entries`.
 */
function nullProtoMap(entries) {
  return Object.assign(Object.create(null), entries)
}

/** Initial state factory */

/**
 *
 */
function getInitialState() {
  return {
    defaultCustomerId: 'C0123456',
    customers: nullProtoMap({
      C0123456: { id: 'C0123456', customerDomain: 'example.com' },
    }),
    orgUnits: nullProtoMap({
      C0123456: nullProtoMap({
        fakeOUId1: {
          name: 'Root OU',
          orgUnitId: 'id:fakeOUId1',
          orgUnitPath: '/',
          parentOrgUnitId: null,
        },
        fakeOUId2: {
          name: 'Child OU',
          orgUnitId: 'id:fakeOUId2',
          orgUnitPath: '/Child OU',
          parentOrgUnitId: 'id:fakeOUId1',
        },
      }),
    }),
    policies: nullProtoMap({
      'policies/fakeDlpRule1': {
        name: 'policies/fakeDlpRule1',
        customer: 'customers/C0123456',
        policyQuery: { orgUnit: 'orgUnits/fakeOUId1' },
        setting: {
          type: 'settings/rule.dlp',
          value: {
            displayName: 'Block test123.com',
            description: 'Prevent upload of sensitive data to test123.com',
            state: 'ACTIVE',
            triggers: ['google.workspace.chrome.file.v1.upload'],
            condition: { contentCondition: 'all_content.contains("test123.com")' },
            action: { chromeAction: { blockContent: {} } },
          },
        },
      },
      'policies/fakeDetector1': {
        name: 'policies/fakeDetector1',
        customer: 'customers/C0123456',
        policyQuery: { orgUnit: 'orgUnits/fakeOUId1' },
        setting: {
          type: 'settings/detector.url_list',
          value: {
            displayName: 'Fake URL Detector',
            description: 'A fake URL list detector for testing',
            url_list: { urls: ['malware.com'] },
          },
        },
      },
      'policies/fakeTempDetector1': {
        name: 'policies/fakeTempDetector1',
        customer: 'customers/C0123456',
        policyQuery: { orgUnit: 'orgUnits/fakeOUId1' },
        setting: {
          type: 'settings/detector.url_list',
          value: {
            displayName: 'End-to-End Temp Detector',
            description: 'A temporary detector for testing',
            url_list: { urls: ['temp.com'] },
          },
        },
      },
      'policies/akajj264apk5psphei': {
        name: 'policies/akajj264apk5psphei',
        customer: 'customers/C0123456',
        policyQuery: { orgUnit: 'orgUnits/fakeOUId1' },
        setting: {
          type: 'settings/detector.regex',
          value: {
            displayName: 'Fake Regex Detector',
            description: 'A fake regex detector for testing',
            regular_expression: { expression: '.*' },
          },
        },
      },
    }),
    // Connector policies keyed by customerId -> orgUnitId -> schema name
    // Returned by policies:resolve
    connectorPolicies: nullProtoMap({
      C0123456: nullProtoMap({
        fakeOUId1: nullProtoMap({
          'chrome.users.OnFileAttachedConnectorPolicy': [
            {
              value: {
                policySchema: 'chrome.users.OnFileAttachedConnectorPolicy',
                value: {
                  onFileAttachedAnalysisConnectorConfiguration: {
                    fileAttachedConfiguration: {
                      serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
                      delayDeliveryUntilVerdict: true,
                      blockFileOnContentAnalysisFailure: false,
                      blockPasswordProtectedFiles: false,
                      blockLargeFileTransfer: false,
                    },
                  },
                },
              },
            },
          ],
          'chrome.users.OnFileDownloadedConnectorPolicy': [
            {
              value: {
                policySchema: 'chrome.users.OnFileDownloadedConnectorPolicy',
                value: {
                  onFileDownloadedAnalysisConnectorConfiguration: {
                    fileDownloadedConfiguration: {
                      serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
                      delayDeliveryUntilVerdict: true,
                      blockFileOnContentAnalysisFailure: false,
                      blockPasswordProtectedFiles: false,
                      blockLargeFileTransfer: false,
                    },
                  },
                },
              },
            },
          ],
          'chrome.users.OnBulkTextEntryConnectorPolicy': [
            {
              value: {
                policySchema: 'chrome.users.OnBulkTextEntryConnectorPolicy',
                value: {
                  onBulkTextEntryAnalysisConnectorConfiguration: {
                    bulkTextEntryConfiguration: {
                      serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
                    },
                  },
                },
              },
            },
          ],
          'chrome.users.OnPrintAnalysisConnectorPolicy': [
            {
              value: {
                policySchema: 'chrome.users.OnPrintAnalysisConnectorPolicy',
                value: {
                  onPrintAnalysisConnectorConfiguration: {
                    printConfigurations: [{ serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM' }],
                  },
                },
              },
            },
          ],
          'chrome.users.RealtimeUrlCheck': [
            {
              value: {
                policySchema: 'chrome.users.RealtimeUrlCheck',
                value: {
                  realtimeUrlCheckEnabled: 'ENTERPRISE_REAL_TIME_URL_CHECK_MODE_ENUM_ENABLED',
                },
              },
            },
          ],
          'chrome.users.OnSecurityEvent': [],
        }),
      }),
    }),
    // Global/Unassigned policies (backwards compat or generic)
    globalConnectorPolicies: {
      'chrome.users.apps.InstallType': [
        {
          targetKey: {
            additionalTargetKeys: { app_id: 'chrome:ekajlcmdfcigmdbphhifahdfjbkciflj' },
          },
          value: {
            policySchema: 'chrome.users.apps.InstallType',
            value: { appInstallType: 'FORCED' },
          },
        },
      ],
    },
    activities: [],
    browserVersions: [
      { version: '120.0.6099.71', count: '15', channel: 'STABLE' },
      { version: '121.0.6167.85', count: '3', channel: 'BETA' },
    ],
    profiles: [],
    licenses: nullProtoMap({
      C0123456: nullProtoMap({
        101040: nullProtoMap({
          1010400001: [{ userId: 'user1@example.com', skuId: '1010400001', productId: '101040' }],
        }),
      }),
    }),
    serviceUsage: nullProtoMap({
      'admin.googleapis.com': 'ENABLED',
      'chromemanagement.googleapis.com': 'ENABLED',
      'chromepolicy.googleapis.com': 'ENABLED',
      'cloudidentity.googleapis.com': 'ENABLED',
      'licensing.googleapis.com': 'ENABLED',
      'serviceusage.googleapis.com': 'ENABLED',
    }),
    insightsState: 'INSIGHTS_DISABLED',
    securityInsightsData: {
      contentTransfers: {
        summaries: [{ metric: 'CONTENT_TRANSFERS_METRIC_TOTAL_TRANSFERS', count: '100' }],
      },
      contentTransfersBreakdowns: {
        contentTransfersBreakdowns: [{ user: 'user@test.com', summary: { count: '50' } }],
      },
      urlVisits: {
        summaries: [{ metric: 'URL_VISITS_METRIC_TOTAL_SUSPICIOUS_URL_VISITS', count: '5' }],
      },
      urlVisitsBreakdowns: {
        urlVisitsBreakdowns: [{ user: 'user@test.com', summary: { count: '2' } }],
      },
    },
    organizations: [
      {
        name: 'organizations/123456789',
        displayName: 'Test Org',
        directoryCustomerId: 'C0123456',
        state: 'ACTIVE',
      },
    ],
    securityGateways: nullProtoMap({}),
    securityGatewayApplications: nullProtoMap({}),
    securityGatewayIamPolicies: nullProtoMap({}),
    securityGatewayApplicationIamPolicies: nullProtoMap({}),
    accessPolicies: nullProtoMap({}),
    accessLevels: nullProtoMap({}),
    acmOperations: nullProtoMap({}),
    projectIamPolicies: nullProtoMap({}),
    firewalls: nullProtoMap({}),
  }
}

/** Helpers */

/**
 *
 * @param state
 * @param customerKey
 */
function resolveCustomerId(state, customerKey) {
  if (customerKey === 'my_customer') {
    return state.defaultCustomerId
  }
  if (state.customers[customerKey]) {
    return customerKey
  }
  return null
}

/**
 *
 * @param state
 * @param customerKey
 * @param res
 */
function requireCustomer(state, customerKey, res) {
  const id = resolveCustomerId(state, customerKey)
  if (!id) {
    res.status(404).json({ error: { message: `Customer ${customerKey} not found` } })
    return null
  }
  return id
}

/** Express app factory */

/**
 *
 */
export function createFakeApp() {
  let state = getInitialState()
  let mockErrors = {}
  const app = express()
  app.use(express.json())
  app.use((req, res, next) => {
    console.log(`[FAKE SERVER] ${req.method} ${req.url}`)
    next()
  })

  // Mock error middleware
  app.use((req, res, next) => {
    const key = `${req.method}:${req.path}`
    if (mockErrors[key]) {
      const error = mockErrors[key]
      delete mockErrors[key] // one-shot
      return res.status(error.status).json(error.body)
    }
    next()
  })

  // Support Google Help Articles (Proxy Target)
  const serveArticle = (req, res) => {
    if (req.params.id === '1219251') {
      return res.send(
        `
        <article>
          <h1>Administrator Privilege Definitions</h1>
          <p>Recommended delegated roles for custom admin configurations:</p>
          <ul>
            <li><strong>View Chrome Insights Settings / Manage Chrome Insights Settings</strong>: ` +
          `Assign this delegated privilege to view dashboards and security insights. ` +
          `Alternatively, assign <strong>Chrome Enterprise Security Service (APP_ADMIN)</strong>.</li>
            <li><strong>DLP Administrator</strong>: Assign this custom role to adjust, edit, or view DLP rules.</li>
          </ul>
        </article>
      `,
      )
    }
    if (req.params.id === '16493390') {
      return res.send(
        `
        <article>
          <h1>Configurable Timeout Deadlines for Deep Scanning</h1>
          <p>As an administrator with the <strong>Chrome Enterprise Security Services</strong> privilege ` +
          `and a <strong>Chrome Enterprise Premium</strong> subscription, you can configure the ` +
          `evaluation time limit (timeouts) for DLP and malware scans, including the paste action.</p>
          <h2>Steps to configure:</h2>
          <ol>
            <li>Go to the Google Admin console.</li>
            <li>Navigate to <strong>Menu > Apps > Additional Google Services > ` +
          `Chrome Enterprise Security Services > Deep scanning protection settings</strong>.</li>
            <li>Click Edit.</li>
            <li>Set the evaluation time limit in seconds (scan deadline/paste deadline).</li>
            <li>Click Save.</li>
          </ol>
        </article>
      `,
      )
    }
    res.status(404).send('Article not found')
  }

  app.get('/a/answer/:id', serveArticle)
  app.get('/chrome/a/answer/:id', serveArticle)

  // Admin SDK: Get Customer
  app.get('/admin/directory/v1/customers/:customerKey', (req, res) => {
    if (req.params.customerKey === 'my_customer') {
      return res.json(state.customers[state.defaultCustomerId])
    }
    const customerId = requireCustomer(state, req.params.customerKey, res)
    if (!customerId) {
      return
    }
    res.json(state.customers[customerId])
  })

  // Admin SDK: List Org Units
  app.get('/admin/directory/v1/customer/:customerKey/orgunits', (req, res) => {
    const customerId = requireCustomer(state, req.params.customerKey, res)
    if (!customerId) {
      return
    }

    if (req.query.orgUnitPath) {
      return res.status(501).json({ error: { message: 'orgUnitPath filtering not implemented' } })
    }

    const units = state.orgUnits[customerId]
    if (!units) {
      return res.json({ organizationUnits: [] })
    }

    if (req.query.type === 'ALL_INCLUDING_PARENT') {
      return res.json({ organizationUnits: Object.values(units) })
    }
    res.status(501).json({ error: { message: `Type ${req.query.type} not implemented` } })
  })

  // Admin SDK: List Activities
  app.get('/admin/reports/v1/activity/users/:userKey/applications/chrome', (_req, res) => {
    res.json({ items: state.activities })
  })

  // Licensing: List Licenses
  app.get(
    ['/licensing/v1/product/:productId/sku/:skuId/user', '/apps/licensing/v1/product/:productId/sku/:skuId/users'],
    (req, res) => {
      const customerId = resolveCustomerId(state, req.query.customerId) || req.query.customerId
      const licenses = state.licenses[customerId]?.[req.params.productId]?.[req.params.skuId] || []

      // Return a structure matching the real Google Licensing API list response
      res.json({
        kind: 'licensing#licenseAssignmentList',
        etag: '"mockEtagList"',
        items: licenses,
        nextPageToken: licenses.length > 0 ? 'mockNextPageToken' : undefined,
      })
    },
  )

  // Licensing: Get User License
  app.get(
    [
      '/licensing/v1/product/:productId/sku/:skuId/user/:userId',
      '/apps/licensing/v1/product/:productId/sku/:skuId/user/:userId',
    ],
    (req, res) => {
      for (const customerLicenses of Object.values(state.licenses)) {
        const skuLicenses = customerLicenses[req.params.productId]?.[req.params.skuId] || []
        const license = skuLicenses.find(l => l.userId === req.params.userId)
        if (license) {
          // Return a structure matching the real Google Licensing API single response
          return res.json({
            kind: 'licensing#licenseAssignment',
            etag: '"mockEtagSingle"',
            productId: license.productId,
            userId: license.userId,
            selfLink: `https://licensing.googleapis.com/apps/licensing/v1/product/${license.productId}/sku/${license.skuId}/user/${license.userId}`,
            skuId: license.skuId,
            skuName: 'Chrome Enterprise Premium',
            productName: 'Chrome Enterprise Premium',
          })
        }
      }
      res.status(404).json({ error: { message: 'User license not found' } })
    },
  )

  // Chrome Management: Count Browser Versions
  app.get('/v1/customers/:customerId/reports\\:countChromeVersions', (req, res) => {
    const customerId = requireCustomer(state, req.params.customerId, res)
    if (!customerId) {
      return
    }
    res.json({ browserVersions: state.browserVersions })
  })

  // Chrome Management: List Profiles
  app.get('/v1/customers/:customerId/profiles', (req, res) => {
    const customerId = requireCustomer(state, req.params.customerId, res)
    if (!customerId) {
      return
    }
    if (req.query.orgUnitId) {
      return res.status(501).json({ error: { message: 'orgUnitId not implemented' } })
    }
    res.json({ chromeBrowserProfiles: state.profiles })
  })

  // Chrome Management: Check Security Insights Status
  app.get('/v1/customers/:customerId/enterprise/securityInsights\\:checkEnablementStatus', (req, res) => {
    const customerId = requireCustomer(state, req.params.customerId, res)
    if (!customerId) {
      return
    }
    res.json({ insightsState: state.insightsState })
  })

  // Chrome Management: Enable Security Insights
  app.post('/v1/customers/:customerId/enterprise/securityInsights\\:enable', (req, res) => {
    const customerId = requireCustomer(state, req.params.customerId, res)
    if (!customerId) {
      return
    }
    state.insightsState = 'INSIGHTS_ENABLED'
    res.json({ insightsState: 'INSIGHTS_ENABLED' })
  })

  // Chrome Management: Disable Security Insights
  app.post('/v1/customers/:customerId/enterprise/securityInsights\\:disable', (req, res) => {
    const customerId = requireCustomer(state, req.params.customerId, res)
    if (!customerId) {
      return
    }
    state.insightsState = 'INSIGHTS_DISABLED'
    res.json({ insightsState: 'INSIGHTS_DISABLED' })
  })

  // Chrome Management: Query Content Transfers
  app.get('/v1alpha1/customers/:customerId/enterprise/securityInsights\\:queryContentTransfers', (req, res) => {
    const customerId = requireCustomer(state, req.params.customerId, res)
    if (!customerId) {
      return
    }
    res.json(state.securityInsightsData.contentTransfers)
  })

  // Chrome Management: Query Content Transfers Breakdowns
  app.get(
    '/v1alpha1/customers/:customerId/enterprise/securityInsights\\:queryContentTransfersBreakdowns',
    (req, res) => {
      const customerId = requireCustomer(state, req.params.customerId, res)
      if (!customerId) {
        return
      }
      res.json(state.securityInsightsData.contentTransfersBreakdowns)
    },
  )

  // Chrome Management: Query URL Visits
  app.get('/v1alpha1/customers/:customerId/enterprise/securityInsights\\:queryUrlVisits', (req, res) => {
    const customerId = requireCustomer(state, req.params.customerId, res)
    if (!customerId) {
      return
    }
    res.json(state.securityInsightsData.urlVisits)
  })

  // Chrome Management: Query URL Visits Breakdowns
  app.get('/v1alpha1/customers/:customerId/enterprise/securityInsights\\:queryUrlVisitsBreakdowns', (req, res) => {
    const customerId = requireCustomer(state, req.params.customerId, res)
    if (!customerId) {
      return
    }
    res.json(state.securityInsightsData.urlVisitsBreakdowns)
  })

  // Chrome Policy: Resolve Policies
  app.post('/v1/customers/:customerId/policies\\:resolve', (req, res) => {
    const customerId = requireCustomer(state, req.params.customerId, res)
    if (!customerId) {
      return
    }

    const { policySchemaFilter, policyTargetKey = {} } = req.body
    const targetResource = policyTargetKey.targetResource || ''
    const orgUnitId = targetResource.split('/').pop() || 'unknown'

    const customerPolicies = state.connectorPolicies?.[customerId] || {}
    const ouPolicies = customerPolicies[orgUnitId] || {}

    if (policySchemaFilter) {
      const policies = ouPolicies[policySchemaFilter] || state.globalConnectorPolicies[policySchemaFilter] || []
      return res.json({ resolvedPolicies: policies })
    }

    res.json({ resolvedPolicies: [] })
  })

  // Chrome Policy: Batch Modify Org Unit Policies
  app.post('/v1/customers/:customerId/policies/orgunits\\:batchModify', (req, res) => {
    const customerId = requireCustomer(state, req.params.customerId, res)
    if (!customerId) {
      return
    }

    const requests = req.body.requests || []
    for (const batchReq of requests) {
      const { policyTargetKey = {}, policyValue = {} } = batchReq
      const targetResource = policyTargetKey.targetResource || ''
      const orgUnitId = targetResource.split('/').pop() || 'unknown'
      const schema = policyValue.policySchema

      if (!isSafeKey(customerId) || !isSafeKey(orgUnitId) || !isSafeKey(schema)) {
        // Skip batch entries whose keys would mutate Object.prototype.
        continue
      }
      if (!state.connectorPolicies[customerId]) {
        state.connectorPolicies[customerId] = Object.create(null)
      }
      if (!state.connectorPolicies[customerId][orgUnitId]) {
        state.connectorPolicies[customerId][orgUnitId] = Object.create(null)
      }
      state.connectorPolicies[customerId][orgUnitId][schema] = [
        {
          value: {
            policySchema: schema,
            value: policyValue.value,
          },
        },
      ]
    }

    res.json({})
  })

  // Cloud Resource Manager: Search Organizations
  app.post('/v1/organizations\\:search', (req, res) => {
    const { filter, query } = req.body
    const activeFilter = filter || query
    let results = state.organizations

    if (activeFilter) {
      // Simple query parsing for testing, e.g. "domain:test.com" or "owner.directorycustomerid:C0123"
      const match = activeFilter.match(/(domain|owner\.directorycustomerid|directorycustomerid):(\S+)/i)
      if (match) {
        const [_, key, value] = match
        const normalizedKey = key.toLowerCase()
        if (normalizedKey === 'domain') {
          results = results.filter(
            org => org.displayName.toLowerCase().includes(value.toLowerCase()) || value === 'test.com',
          )
        } else if (normalizedKey.includes('directorycustomerid')) {
          results = results.filter(org => org.directoryCustomerId.toLowerCase() === value.toLowerCase())
        }
      }
    }

    res.json({ organizations: results })
  })

  // Cloud Identity: List Policies
  app.get('/v1beta1/policies', (req, res) => {
    const customerId = state.defaultCustomerId
    let policies = Object.values(state.policies).filter(p => p.customer === `customers/${customerId}`)

    // Express query strings can be string | string[] | ParsedQs depending on
    // ?filter=… vs ?filter=…&filter=…; coerce to a single string before
    // pattern-matching so .includes(...) doesn't behave like Array#includes.
    const filter = typeof req.query.filter === 'string' ? req.query.filter : ''
    if (filter) {
      if (
        filter.includes('setting.type.startsWith("settings/rule.dlp")') ||
        filter.includes('setting.type.includes("rule.dlp")') ||
        filter.includes('setting.type.matches("rule.dlp")')
      ) {
        policies = policies.filter(p => p.setting?.type?.includes('rule.dlp'))
      } else if (
        filter.includes('setting.type.startsWith("settings/detector")') ||
        filter.includes('setting.type.includes("detector")') ||
        filter.includes('setting.type.matches("detector")')
      ) {
        policies = policies.filter(p => p.setting?.type?.includes('detector'))
      } else {
        return res.status(501).json({ error: { message: `Filter ${filter} not implemented` } })
      }
    }

    // Pagination
    let pageSize = parseInt(req.query.pageSize, 10)
    if (isNaN(pageSize) || pageSize <= 0) {
      pageSize = 50 // Default pageSize
    }

    // Sort policies by name to ensure consistent pagination ordering
    policies.sort((a, b) => a.name.localeCompare(b.name))

    let startIndex = 0
    if (req.query.pageToken) {
      startIndex = parseInt(req.query.pageToken, 10)
      if (isNaN(startIndex) || startIndex < 0) {
        return res.status(400).json({ error: { message: 'Invalid pageToken' } })
      }
    }

    const endIndex = startIndex + pageSize
    const paginatedPolicies = policies.slice(startIndex, endIndex)

    const response = { policies: paginatedPolicies }
    if (endIndex < policies.length) {
      response.nextPageToken = endIndex.toString()
    }

    res.json(response)
  })

  // Cloud Identity: Create Policy
  app.post(['/v1beta1/customers/:customerId/policies', '/v1beta1/policies'], (req, res) => {
    let customerParam = req.params.customerId
    if (!customerParam && req.body.customer) {
      // e.g. "customers/C0123456"
      customerParam = req.body.customer.split('/')[1]
    }

    const customerId = requireCustomer(state, customerParam, res)
    if (!customerId) {
      return
    }

    const { setting = {}, policyQuery = {} } = req.body
    const settingType = setting.type || ''
    const value = setting.value || {}

    // Validate DLP rules
    if (settingType === 'settings/rule.dlp') {
      if (!value.displayName) {
        return res.status(400).json({ error: { message: "'displayName' is required and must not be empty." } })
      }
      const triggers = value.triggers
      if (!Array.isArray(triggers) || !triggers.some(t => t.startsWith('google.workspace.chrome.'))) {
        return res
          .status(400)
          .json({ error: { message: "'triggers' must contain at least one valid Chrome trigger." } })
      }
      const chromeAction = value.action?.chromeAction || {}
      if (!('blockContent' in chromeAction || 'warnUser' in chromeAction || 'auditOnly' in chromeAction)) {
        return res.status(400).json({ error: { message: 'A valid Chrome action is required.' } })
      }
      if (!policyQuery.orgUnit) {
        return res.status(400).json({ error: { message: "'orgUnit' is required in policyQuery." } })
      }
    }

    // Validate detectors
    if (settingType === 'settings/detector.url_list') {
      const urls = value.url_list?.urls
      if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: { message: "'url_list.urls' must be a non-empty list." } })
      }
    }
    if (settingType === 'settings/detector.word_list') {
      const words = value.word_list?.words
      if (!Array.isArray(words) || words.length === 0) {
        return res.status(400).json({ error: { message: "'word_list.words' must be a non-empty list." } })
      }
    }
    if (settingType === 'settings/detector.regex') {
      if (!value.regular_expression?.expression) {
        return res.status(400).json({ error: { message: "'regular_expression.expression' is required." } })
      }
    }

    const policyId = `fakePolicy_${randomUUID()}`
    const policyName = `policies/${policyId}`
    const newPolicy = structuredClone(req.body)
    newPolicy.name = policyName
    newPolicy.customer = `customers/${customerId}`

    const ouId = newPolicy.policyQuery?.orgUnit
    if (ouId) {
      newPolicy.policyQuery.orgUnitId = ouId.split('/').pop()
    }

    state.policies[policyName] = newPolicy
    // TODO: Mismatch between real API and fake API responses.
    // We wrap the response in `{ done: true, response: ... }` to mimic a Long-Running Operation.
    // However, the real API (via googleapis client) may return the policy directly.
    res.json({ done: true, response: newPolicy })
  })

  // Cloud Identity: Get Policy by Name
  app.get('/v1beta1/*path', (req, res) => {
    const name = req.params.path.join('/')
    if (name === 'policies') {
      return res.status(400).json({ error: { message: 'Use query params for listing' } })
    }
    if (state.policies[name]) {
      return res.json(state.policies[name])
    }
    res.status(404).json({ error: { message: `Policy ${name} not found` } })
  })

  // Cloud Identity: Delete Policy by Name
  app.delete('/v1beta1/*path', (req, res) => {
    const name = req.params.path.join('/')
    if (state.policies[name]) {
      delete state.policies[name]
      return res.json({})
    }
    res.status(404).json({ error: { message: `Policy ${name} not found` } })
  })

  app.get('/v1/projects/:projectId/services/:serviceName', (req, res) => {
    if (state.serviceUsage['serviceusage.googleapis.com'] === 'DISABLED') {
      return res.status(403).json({
        error: {
          code: 403,
          message: `Service Usage API has not been used in project [${req.params.projectId}] before or it is disabled. Enable it by visiting https://console.cloud.google.com/apis/library/serviceusage.googleapis.com?project=${req.params.projectId} then retry. If you enabled this API recently, wait a few minutes for the action to propagate to our systems and retry.`,
          status: 'PERMISSION_DENIED',
        },
      })
    }
    const stateVal = state.serviceUsage[req.params.serviceName] || 'DISABLED'
    res.json({
      name: `projects/${req.params.projectId}/services/${req.params.serviceName}`,
      state: stateVal,
    })
  })

  app.post('/v1/projects/:projectId/services/:serviceName\\:enable', (req, res) => {
    if (state.serviceUsage['serviceusage.googleapis.com'] === 'DISABLED') {
      return res.status(403).json({
        error: {
          code: 403,
          message: `Service Usage API has not been used in project [${req.params.projectId}] before or it is disabled. Enable it by visiting https://console.cloud.google.com/apis/library/serviceusage.googleapis.com?project=${req.params.projectId} then retry. If you enabled this API recently, wait a few minutes for the action to propagate to our systems and retry.`,
          status: 'PERMISSION_DENIED',
        },
      })
    }
    state.serviceUsage[req.params.serviceName] = 'ENABLED'
    res.json({
      done: true,
      response: {
        state: 'ENABLED',
      },
    })
  })

  app.get('/v1/services', (req, res) => {
    const consumerId = req.query.consumerId
    if (typeof consumerId !== 'string' || !consumerId.startsWith('project:')) {
      res.status(400).json({ error: { message: 'consumerId must be of form project:PROJECT_ID' } })
      return
    }
    const services = Object.entries(state.serviceUsage)
      .filter(([, stateVal]) => stateVal === 'ENABLED')
      .map(([serviceName]) => ({ serviceName, producerProjectId: 'google.com' }))
    res.json({ services })
  })

  // Compute Engine: List Firewalls
  app.get('/compute/v1/projects/:projectId/global/firewalls', (req, res) => {
    const { projectId } = req.params
    if (mockErrors.listFirewalls) {
      const err = mockErrors.listFirewalls
      return res.status(err.code || 500).json({ error: { message: err.message || 'Error listing firewalls' } })
    }
    const firewalls = state.firewalls[projectId] || []
    res.json({ kind: 'compute#firewallList', items: firewalls })
  })

  // BeyondCorp: Create Security Gateway
  app.post('/v1/projects/:projectId/locations/global/securityGateways', (req, res) => {
    const { projectId } = req.params
    const gatewayId = req.query.security_gateway_id || req.query.securityGatewayId
    if (!gatewayId) {
      return res
        .status(400)
        .json({ error: { message: 'Missing security_gateway_id or securityGatewayId query parameter' } })
    }
    const name = `projects/${projectId}/locations/global/securityGateways/${gatewayId}`
    const display_name = req.body.display_name || gatewayId
    const service_discovery = req.body.service_discovery
    const gateway = {
      name,
      displayName: display_name,
      state: 'RUNNING',
      delegatingServiceAccount: `service-${projectId}-beyondcorp@gcp-sa-beyondcorp.iam.gserviceaccount.com`,
      ...(service_discovery ? { serviceDiscovery: service_discovery } : {}),
    }
    state.securityGateways[name] = gateway
    res.json(gateway)
  })

  // BeyondCorp: List Security Gateways
  app.get('/v1/projects/:projectId/locations/global/securityGateways', (req, res) => {
    const { projectId } = req.params
    const prefix = `projects/${projectId}/locations/global/securityGateways/`
    const list = Object.values(state.securityGateways).filter(g => g.name.startsWith(prefix))
    res.json({ securityGateways: list })
  })

  // BeyondCorp: Get Gateway IAM Policy
  app.get('/v1/projects/:projectId/locations/global/securityGateways/:gatewayId\\:getIamPolicy', (req, res) => {
    const { projectId, gatewayId } = req.params
    const name = `projects/${projectId}/locations/global/securityGateways/${gatewayId}`
    const policy = state.securityGatewayIamPolicies[name] || { bindings: [], version: 3, etag: 'BwXN8_d-bOM=' }
    res.json(policy)
  })

  // BeyondCorp: Set Gateway IAM Policy
  app.post('/v1/projects/:projectId/locations/global/securityGateways/:gatewayId\\:setIamPolicy', (req, res) => {
    const { projectId, gatewayId } = req.params
    const name = `projects/${projectId}/locations/global/securityGateways/${gatewayId}`
    const policy = req.body.policy
    state.securityGatewayIamPolicies[name] = policy
    res.json(policy)
  })

  // BeyondCorp: Get Security Gateway
  app.get('/v1/projects/:projectId/locations/global/securityGateways/:gatewayId', (req, res) => {
    const { projectId, gatewayId } = req.params
    const name = `projects/${projectId}/locations/global/securityGateways/${gatewayId}`
    const gateway = state.securityGateways[name]
    if (!gateway) {
      return res.status(404).json({ error: { message: `Security Gateway ${name} not found` } })
    }
    res.json(gateway)
  })

  // BeyondCorp: Patch Security Gateway
  app.patch('/v1/projects/:projectId/locations/global/securityGateways/:gatewayId', (req, res) => {
    const { projectId, gatewayId } = req.params
    const name = `projects/${projectId}/locations/global/securityGateways/${gatewayId}`
    const gateway = state.securityGateways[name]
    if (!gateway) {
      return res.status(404).json({ error: { message: `Security Gateway ${name} not found` } })
    }
    const updateMask = Array.isArray(req.query.updateMask)
      ? req.query.updateMask.join(',')
      : typeof req.query.updateMask === 'string'
        ? req.query.updateMask
        : ''
    if (updateMask.includes('service_discovery') && req.body.service_discovery) {
      gateway.serviceDiscovery = req.body.service_discovery
    }
    if (req.body.display_name) {
      gateway.displayName = req.body.display_name
    }
    state.securityGateways[name] = gateway
    res.json(gateway)
  })

  // BeyondCorp: Delete Security Gateway
  app.delete('/v1/projects/:projectId/locations/global/securityGateways/:gatewayId', (req, res) => {
    const { projectId, gatewayId } = req.params
    const name = `projects/${projectId}/locations/global/securityGateways/${gatewayId}`
    if (state.securityGateways[name]) {
      delete state.securityGateways[name]
      delete state.securityGatewayIamPolicies[name]
      const appPrefix = `${name}/applications/`
      Object.keys(state.securityGatewayApplications).forEach(appKey => {
        if (appKey.startsWith(appPrefix)) {
          delete state.securityGatewayApplications[appKey]
          delete state.securityGatewayApplicationIamPolicies[appKey]
        }
      })
      return res.json({ done: true })
    }
    res.status(404).json({ error: { message: `Security Gateway ${name} not found` } })
  })

  // BeyondCorp: Create Application
  app.post('/v1/projects/:projectId/locations/global/securityGateways/:gatewayId/applications', (req, res) => {
    const { projectId, gatewayId } = req.params
    const applicationId = req.query.application_id || req.query.applicationId
    if (!applicationId) {
      return res.status(400).json({ error: { message: 'Missing application_id or applicationId query parameter' } })
    }
    const name = `projects/${projectId}/locations/global/securityGateways/${gatewayId}/applications/${applicationId}`
    const application = {
      name,
      displayName: req.body.display_name,
      endpointMatchers: req.body.endpoint_matchers,
      upstreams: req.body.upstreams,
    }
    state.securityGatewayApplications[name] = application
    res.json(application)
  })

  // BeyondCorp: List Applications
  app.get('/v1/projects/:projectId/locations/global/securityGateways/:gatewayId/applications', (req, res) => {
    const { projectId, gatewayId } = req.params
    const prefix = `projects/${projectId}/locations/global/securityGateways/${gatewayId}/applications/`
    const list = Object.values(state.securityGatewayApplications).filter(a => a.name.startsWith(prefix))
    res.json({ applications: list })
  })

  // BeyondCorp: Get Application IAM Policy
  app.get(
    '/v1/projects/:projectId/locations/global/securityGateways/:gatewayId/applications/:applicationId\\:getIamPolicy',
    (req, res) => {
      const { projectId, gatewayId, applicationId } = req.params
      const name = `projects/${projectId}/locations/global/securityGateways/${gatewayId}/applications/${applicationId}`
      const policy = state.securityGatewayApplicationIamPolicies[name] || {
        bindings: [],
        version: 3,
        etag: 'BwXN8_d-bOM=',
      }
      res.json(policy)
    },
  )

  // BeyondCorp: Set Application IAM Policy
  app.post(
    '/v1/projects/:projectId/locations/global/securityGateways/:gatewayId/applications/:applicationId\\:setIamPolicy',
    (req, res) => {
      const { projectId, gatewayId, applicationId } = req.params
      const name = `projects/${projectId}/locations/global/securityGateways/${gatewayId}/applications/${applicationId}`
      const policy = req.body.policy
      state.securityGatewayApplicationIamPolicies[name] = policy
      res.json(policy)
    },
  )

  // BeyondCorp: Get Application
  app.get(
    '/v1/projects/:projectId/locations/global/securityGateways/:gatewayId/applications/:applicationId',
    (req, res) => {
      const { projectId, gatewayId, applicationId } = req.params
      const name = `projects/${projectId}/locations/global/securityGateways/${gatewayId}/applications/${applicationId}`
      const application = state.securityGatewayApplications[name]
      if (!application) {
        return res.status(404).json({ error: { message: `Application ${name} not found` } })
      }
      res.json(application)
    },
  )

  // BeyondCorp: Delete Application
  app.delete(
    '/v1/projects/:projectId/locations/global/securityGateways/:gatewayId/applications/:applicationId',
    (req, res) => {
      const { projectId, gatewayId, applicationId } = req.params
      const name = `projects/${projectId}/locations/global/securityGateways/${gatewayId}/applications/${applicationId}`
      if (state.securityGatewayApplications[name]) {
        delete state.securityGatewayApplications[name]
        delete state.securityGatewayApplicationIamPolicies[name]
        return res.json({ done: true })
      }
      res.status(404).json({ error: { message: `Application ${name} not found` } })
    },
  )

  // Access Context Manager: List Access Policies
  app.get('/v1/accessPolicies', (req, res) => {
    state.accessPolicies = state.accessPolicies || Object.create(null)
    const parent = req.query.parent
    const list = Object.values(state.accessPolicies).filter(p => !parent || p.parent === parent)
    res.json({ accessPolicies: list })
  })

  // Access Context Manager: Create Access Policy
  app.post('/v1/accessPolicies', (req, res) => {
    state.accessPolicies = state.accessPolicies || Object.create(null)
    state.acmOperations = state.acmOperations || Object.create(null)
    const id = Object.keys(state.accessPolicies).length + 10000
    const name = `accessPolicies/${id}`
    const policy = {
      name,
      parent: req.body.parent,
      title: req.body.title || 'Default Access Policy',
    }
    state.accessPolicies[name] = policy
    const opName = `operations/accessPolicies.create.${id}`
    const op = { name: opName, done: true, response: policy }
    state.acmOperations[opName] = op
    res.json(op)
  })

  // Access Context Manager: List Access Levels
  app.get('/v1/accessPolicies/:policyId/accessLevels', (req, res) => {
    state.accessLevels = state.accessLevels || Object.create(null)
    const { policyId } = req.params
    const parent = `accessPolicies/${policyId}`
    const list = Object.values(state.accessLevels).filter(l => l.name?.startsWith(`${parent}/accessLevels/`))
    res.json({ accessLevels: list })
  })

  // Access Context Manager: Create Access Level
  app.post('/v1/accessPolicies/:policyId/accessLevels', (req, res) => {
    state.accessLevels = state.accessLevels || Object.create(null)
    state.acmOperations = state.acmOperations || Object.create(null)
    const { policyId } = req.params
    const level = req.body
    if (!level.name) {
      level.name = `accessPolicies/${policyId}/accessLevels/level_1`
    }
    state.accessLevels[level.name] = level
    const levelId = level.name.split('/').pop()
    const opName = `operations/accessLevels.create.${levelId}`
    const op = { name: opName, done: true, response: level }
    state.acmOperations[opName] = op
    res.json(op)
  })

  // Access Context Manager: Get Operation
  app.get(/^\/v1\/operations\/(.*)$/, (req, res) => {
    state.acmOperations = state.acmOperations || Object.create(null)
    const rawPath = req.params[0]
    const opName = rawPath ? `operations/${rawPath}` : req.path.substring(1)
    const op = state.acmOperations[opName] || { name: opName, done: true }
    res.json(op)
  })

  // BeyondCorp: Patch Application
  app.patch(
    '/v1/projects/:projectId/locations/global/securityGateways/:gatewayId/applications/:applicationId',
    (req, res) => {
      const { projectId, gatewayId, applicationId } = req.params
      const name = `projects/${projectId}/locations/global/securityGateways/${gatewayId}/applications/${applicationId}`
      const application = state.securityGatewayApplications[name]
      if (!application) {
        return res.status(404).json({ error: { message: `Application ${name} not found` } })
      }
      const updateMask = Array.isArray(req.query.updateMask)
        ? req.query.updateMask.join(',')
        : typeof req.query.updateMask === 'string'
          ? req.query.updateMask
          : ''
      if (updateMask.includes('display_name') || req.body.display_name) {
        application.displayName = req.body.display_name
      }
      if (updateMask.includes('endpoint_matchers') || req.body.endpoint_matchers) {
        application.endpointMatchers = req.body.endpoint_matchers
      }
      if (updateMask.includes('upstreams') || req.body.upstreams) {
        application.upstreams = req.body.upstreams
      }
      state.securityGatewayApplications[name] = application
      res.json(application)
    },
  )

  // CRM: Get Project IAM Policy
  app.post('/v1/projects/:projectId\\:getIamPolicy', (req, res) => {
    const { projectId } = req.params
    const policy = state.projectIamPolicies[projectId] || { bindings: [] }
    res.json(policy)
  })

  // Test Helper: Reset State
  app.post('/test/reset', (_req, res) => {
    state = getInitialState()
    mockErrors = {}
    res.json({ message: 'State reset' })
  })

  // Helper functions for ingestion
  /**
   *
   * @param data
   */
  function mergeFixture(data) {
    if (data.kind === 'admin#directory#customer') {
      state.customers[data.id] = data
      state.defaultCustomerId = data.id
    } else if (data.kind === 'admin#directory#orgUnits') {
      const customerId = state.defaultCustomerId
      if (!state.orgUnits[customerId]) {
        state.orgUnits[customerId] = Object.create(null)
      }
      data.organizationUnits.forEach(ou => {
        state.orgUnits[customerId][ou.orgUnitId.replace('id:', '')] = ou
      })
    } else if (data.kind === 'admin#reports#activities') {
      state.activities.push(...data.items)
    } else if (data.kind === 'licensing#licenseAssignment') {
      const customerId = state.defaultCustomerId
      if (!isSafeKey(customerId) || !isSafeKey(data.productId) || !isSafeKey(data.skuId)) {
        return
      }
      if (!state.licenses[customerId]) {
        state.licenses[customerId] = Object.create(null)
      }
      if (!state.licenses[customerId][data.productId]) {
        state.licenses[customerId][data.productId] = Object.create(null)
      }
      if (!state.licenses[customerId][data.productId][data.skuId]) {
        state.licenses[customerId][data.productId][data.skuId] = []
      }
      state.licenses[customerId][data.productId][data.skuId].push(data)
    } else if (data.kind === 'licensing#licenseAssignmentList') {
      const customerId = state.defaultCustomerId
      if (!isSafeKey(customerId)) {
        return
      }
      state.licenses[customerId] = Object.create(null) // Clear existing
      data.items.forEach(item => {
        if (!isSafeKey(item.productId) || !isSafeKey(item.skuId)) {
          return
        }
        if (!state.licenses[customerId][item.productId]) {
          state.licenses[customerId][item.productId] = Object.create(null)
        }
        if (!state.licenses[customerId][item.productId][item.skuId]) {
          state.licenses[customerId][item.productId][item.skuId] = []
        }
        state.licenses[customerId][item.productId][item.skuId].push(item)
      })
    } else if (data.kind === 'cloudidentity#policies') {
      state.policies = Object.create(null) // Clear existing
      data.policies.forEach(policy => {
        state.policies[policy.name] = policy
      })
    } else if (data.kind === 'cloudresourcemanager#organizations') {
      state.organizations = data.organizations
    }
    if (data.securityGateways) {
      for (const [key, val] of Object.entries(data.securityGateways)) {
        state.securityGateways[key] = val
      }
    }
    if (data.securityGatewayApplications) {
      for (const [key, val] of Object.entries(data.securityGatewayApplications)) {
        state.securityGatewayApplications[key] = val
      }
    }
    if (data.securityGatewayIamPolicies) {
      for (const [key, val] of Object.entries(data.securityGatewayIamPolicies)) {
        state.securityGatewayIamPolicies[key] = val
      }
    }
    if (data.securityGatewayApplicationIamPolicies) {
      for (const [key, val] of Object.entries(data.securityGatewayApplicationIamPolicies)) {
        state.securityGatewayApplicationIamPolicies[key] = val
      }
    }
    if (data.accessPolicies) {
      for (const [key, val] of Object.entries(data.accessPolicies)) {
        state.accessPolicies[key] = val
      }
    }
    if (data.accessLevels) {
      for (const [key, val] of Object.entries(data.accessLevels)) {
        state.accessLevels[key] = val
      }
    }
    if (data.acmOperations) {
      for (const [key, val] of Object.entries(data.acmOperations)) {
        state.acmOperations[key] = val
      }
    }
  }

  /**
   *
   * @param path
   * @param status
   * @param body
   * @param method
   */
  function mockError(path, status, body, method = 'GET') {
    const key = `${method.toUpperCase()}:${path}`
    mockErrors[key] = { status, body }
  }

  // Test Helper: Merge State
  app.post('/test/state/merge', (req, res) => {
    mergeFixture(req.body)
    res.json({ message: 'State merged' })
  })

  // Test Helper: Mock Error
  app.post('/test/state/mock-error', (req, res) => {
    const { path, status, body, method } = req.body
    mockError(path, status, body, method)
    res.json({ message: 'Error mocked' })
  })

  return {
    app,
    resetState: () => {
      state = getInitialState()
      mockErrors = {}
    },
    setState: (/** @type {ReturnType<typeof getInitialState>} */ newState) => {
      state = newState
    },
    mergeFixture,
    mockError,
  }
}

/** Server lifecycle helpers for tests */

/**
 * Starts the fake API server on a dynamic port.
 * @returns {Promise<{ url: string, close: () => Promise<void>, resetState: () => void, setState: (newState: ReturnType<typeof getInitialState>) => void }>}
 */
export async function startFakeServer() {
  const { app, resetState, setState, mergeFixture, mockError } = createFakeApp()
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address()
      const url = `http://localhost:${port}`
      resolve({
        url,
        resetState,
        setState,
        mergeFixture,
        mockError,
        close: () =>
          new Promise((res, rej) => {
            if (typeof server.closeAllConnections === 'function') {
              server.closeAllConnections()
            }
            server.close(err => (err ? rej(err) : res()))
          }),
      })
    })
    server.on('error', reject)
  })
}

/** Standalone mode (for manual testing / backwards compat) */

if (process.argv[1] && process.argv[1].endsWith('fake-api-server.js')) {
  const port = parseInt(process.env.PORT || '8008', 10)
  const { app } = createFakeApp()
  const server = app.listen(port, () => {
    const actualPort = server.address().port
    console.log(`Fake API server running on http://localhost:${actualPort}`)
  })
}
