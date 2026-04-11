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
 * @fileoverview In-process fake Google API server for integration testing.
 *
 * Replaces the Python FastAPI fake_cep_api_server.py. Provides the same
 * endpoints and in-memory state, but runs as an Express app that can be
 * imported directly by JS tests (no subprocess spawning).
 */

import express from 'express'
import { randomUUID } from 'node:crypto'

/** Initial state factory */

function getInitialState() {
  return {
    defaultCustomerId: 'C0123456',
    customers: {
      C0123456: { id: 'C0123456', customerDomain: 'example.com' },
    },
    orgUnits: {
      C0123456: {
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
      },
    },
    policies: {
      'policies/fakeDlpRule1': {
        name: 'policies/fakeDlpRule1',
        customer: 'customers/C0123456',
        policyQuery: { orgUnit: 'orgUnits/fakeOUId1' },
        setting: {
          type: 'settings/rule.dlp',
          value: {
            displayName: '🤖 Block test123.com',
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
    },
    // Connector policies keyed by customerId -> orgUnitId -> schema name
    // Returned by policies:resolve
    connectorPolicies: {
      C0123456: {
        fakeOUId1: {
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
              policyValue: {
                policySchema: 'chrome.users.RealtimeUrlCheck',
                value: {
                  realtimeUrlCheckEnabled: 'ENTERPRISE_REAL_TIME_URL_CHECK_MODE_ENUM_ENABLED',
                },
              },
            },
          ],
          'chrome.users.OnSecurityEvent': [],
        },
      },
    },
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
    licenses: {
      C0123456: {
        101040: {
          1010400001: [{ userId: 'user1@example.com', skuId: '1010400001', productId: '101040' }],
        },
      },
    },
  }
}

/** Helpers */

function resolveCustomerId(state, customerKey) {
  if (customerKey === 'my_customer') {
    return state.defaultCustomerId
  }
  if (state.customers[customerKey]) {
    return customerKey
  }
  return null
}

function requireCustomer(state, customerKey, res) {
  const id = resolveCustomerId(state, customerKey)
  if (!id) {
    res.status(404).json({ error: { message: `Customer ${customerKey} not found` } })
    return null
  }
  return id
}

/** Express app factory */

export function createFakeApp() {
  let state = getInitialState()
  let mockErrors = {}
  const app = express()
  app.use(express.json())

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
  app.get('/admin/directory/v1/customers/:customerKey/orgunits', (req, res) => {
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
  app.get('/licensing/v1/product/:productId/sku/:skuId/user', (req, res) => {
    const customerId = resolveCustomerId(state, req.query.customerId) || req.query.customerId
    const licenses = state.licenses[customerId]?.[req.params.productId]?.[req.params.skuId] || []

    // Return a structure matching the real Google Licensing API list response
    res.json({
      kind: 'licensing#licenseAssignmentList',
      etag: '"mockEtagList"',
      items: licenses,
      nextPageToken: licenses.length > 0 ? 'mockNextPageToken' : undefined,
    })
  })

  // Licensing: Get User License
  app.get('/licensing/v1/product/:productId/sku/:skuId/user/:userId', (req, res) => {
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
  })

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

  // Chrome Policy: Resolve Policies
  app.post('/v1/customers/:customerId/policies\\:resolve', (req, res) => {
    const customerId = requireCustomer(state, req.params.customerId, res)
    if (!customerId) {
      return
    }

    const { policySchemaFilter, policyTargetKey = {} } = req.body
    const targetResource = policyTargetKey.targetResource || ''
    const orgUnitId = targetResource.split('/').pop() || 'unknown'

    const customerPolicies = state.connectorPolicies[customerId] || {}
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

      if (!state.connectorPolicies[customerId]) {
        state.connectorPolicies[customerId] = {}
      }
      if (!state.connectorPolicies[customerId][orgUnitId]) {
        state.connectorPolicies[customerId][orgUnitId] = {}
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

  // Cloud Identity: List Policies
  app.get('/v1beta1/policies', (req, res) => {
    const customerId = state.defaultCustomerId
    let policies = Object.values(state.policies).filter(p => p.customer === `customers/${customerId}`)

    const filter = req.query.filter
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

    res.json({ policies })
  })

  // Cloud Identity: Create Policy
  app.post('/v1beta1/customers/:customerId/policies', (req, res) => {
    const customerId = requireCustomer(state, req.params.customerId, res)
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

  // Test Helper: Reset State
  app.post('/test/reset', (_req, res) => {
    state = getInitialState()
    mockErrors = {}
    res.json({ message: 'State reset' })
  })

  // Helper functions for ingestion
  function mergeFixture(data) {
    if (data.kind === 'admin#directory#customer') {
      state.customers[data.id] = data
      state.defaultCustomerId = data.id
    } else if (data.kind === 'admin#directory#orgUnits') {
      const customerId = state.defaultCustomerId
      if (!state.orgUnits[customerId]) {
        state.orgUnits[customerId] = {}
      }
      data.organizationUnits.forEach(ou => {
        state.orgUnits[customerId][ou.orgUnitId.replace('id:', '')] = ou
      })
    } else if (data.kind === 'admin#reports#activities') {
      state.activities.push(...data.items)
    } else if (data.kind === 'licensing#licenseAssignment') {
      const customerId = state.defaultCustomerId
      if (!state.licenses[customerId]) {
        state.licenses[customerId] = {}
      }
      if (!state.licenses[customerId][data.productId]) {
        state.licenses[customerId][data.productId] = {}
      }
      if (!state.licenses[customerId][data.productId][data.skuId]) {
        state.licenses[customerId][data.productId][data.skuId] = []
      }
      state.licenses[customerId][data.productId][data.skuId].push(data)
    } else if (data.kind === 'licensing#licenseAssignmentList') {
      const customerId = state.defaultCustomerId
      if (!state.licenses[customerId]) {
        state.licenses[customerId] = {}
      }
      state.licenses[customerId] = {} // Clear existing
      data.items.forEach(item => {
        if (!state.licenses[customerId][item.productId]) {
          state.licenses[customerId][item.productId] = {}
        }
        if (!state.licenses[customerId][item.productId][item.skuId]) {
          state.licenses[customerId][item.productId][item.skuId] = []
        }
        state.licenses[customerId][item.productId][item.skuId].push(item)
      })
    } else if (data.kind === 'cloudidentity#policies') {
      state.policies = {} // Clear existing
      data.policies.forEach(policy => {
        state.policies[policy.name] = policy
      })
    }
  }

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
