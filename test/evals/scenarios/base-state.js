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
 * @fileoverview Base state for eval scenarios.
 *
 * Returns a fully-configured "healthy" CEP deployment: active DLP rules,
 * all connectors configured, licenses assigned, SEB extension deployed.
 * Scenario mutations in sibling files introduce targeted misconfigurations.
 */

/**
 * Returns a fully-configured "healthy" CEP deployment state.
 *
 * @returns {object} Complete fake server state object.
 */
export function getBaseState() {
  return {
    defaultCustomerId: 'C04x8k2m9',

    customers: {
      C04x8k2m9: { id: 'C04x8k2m9', customerDomain: 'example.com' },
    },

    orgUnits: {
      C04x8k2m9: {
        ouRoot: {
          name: 'Root OU',
          orgUnitId: 'id:ouRoot',
          orgUnitPath: '/',
          parentOrgUnitId: null,
        },
        ouEngineering: {
          name: 'Engineering',
          orgUnitId: 'id:ouEngineering',
          orgUnitPath: '/Engineering',
          parentOrgUnitId: 'id:ouRoot',
        },
        ouSales: {
          name: 'Sales',
          orgUnitId: 'id:ouSales',
          orgUnitPath: '/Sales',
          parentOrgUnitId: 'id:ouRoot',
        },
      },
    },

    policies: {
      'policies/dlpBlock1': {
        name: 'policies/dlpBlock1',
        customer: 'customers/C04x8k2m9',
        policyQuery: { orgUnit: 'orgUnits/ouRoot' },
        setting: {
          type: 'settings/rule.dlp',
          value: {
            displayName: 'Block sensitive file uploads',
            description: 'Block uploads containing SSN patterns',
            state: 'ACTIVE',
            triggers: ['google.workspace.chrome.file.v1.upload'],
            condition: {
              contentCondition: 'all_content.matches_dlp_detector("projects/example/detectors/ssn")',
            },
            action: { chromeAction: { blockContent: {} } },
          },
        },
      },
      'policies/dlpWatermark1': {
        name: 'policies/dlpWatermark1',
        customer: 'customers/C04x8k2m9',
        policyQuery: { orgUnit: 'orgUnits/ouRoot' },
        setting: {
          type: 'settings/rule.dlp',
          value: {
            displayName: 'Watermark confidential documents',
            description: 'Apply watermark when printing confidential files',
            state: 'ACTIVE',
            triggers: ['google.workspace.chrome.page.v1.print'],
            condition: {
              contentCondition: 'all_content.contains("CONFIDENTIAL")',
            },
            action: { chromeAction: { watermarkContent: {} } },
          },
        },
      },
      'policies/dlpAuditGenAI': {
        name: 'policies/dlpAuditGenAI',
        customer: 'customers/C04x8k2m9',
        policyQuery: { orgUnit: 'orgUnits/ouEngineering' },
        setting: {
          type: 'settings/rule.dlp',
          value: {
            displayName: 'Audit pastes to generative AI sites',
            description: 'Log when users paste content into AI tools',
            state: 'ACTIVE',
            triggers: ['google.workspace.chrome.web_content.v1.upload'],
            condition: {
              urlCondition: 'url.matches("chat.openai.com") || url.matches("gemini.google.com")',
            },
            action: { chromeAction: { auditOnly: {} } },
          },
        },
      },
      'policies/dlpWarnPII': {
        name: 'policies/dlpWarnPII',
        customer: 'customers/C04x8k2m9',
        policyQuery: { orgUnit: 'orgUnits/ouSales' },
        setting: {
          type: 'settings/rule.dlp',
          value: {
            displayName: 'Warn before uploading PII',
            description: 'Warn sales team when uploading files containing PII',
            state: 'ACTIVE',
            triggers: ['google.workspace.chrome.file.v1.upload'],
            condition: {
              contentCondition: 'all_content.matches_dlp_detector("projects/example/detectors/pii")',
            },
            action: { chromeAction: { warnUser: {} } },
          },
        },
      },
      'policies/detectorSSN': {
        name: 'policies/detectorSSN',
        customer: 'customers/C04x8k2m9',
        policyQuery: { orgUnit: 'orgUnits/ouRoot' },
        setting: {
          type: 'settings/detector.regex',
          value: {
            displayName: 'SSN Detector',
            description: 'Matches US Social Security Numbers',
            regular_expression: { expression: '\\b\\d{3}-\\d{2}-\\d{4}\\b' },
          },
        },
      },
      'policies/detectorPII': {
        name: 'policies/detectorPII',
        customer: 'customers/C04x8k2m9',
        policyQuery: { orgUnit: 'orgUnits/ouRoot' },
        setting: {
          type: 'settings/detector.word_list',
          value: {
            displayName: 'PII Detector',
            description: 'Matches common PII keywords',
            word_list: {
              words: ['social security', 'date of birth', 'passport number', 'drivers license'],
            },
          },
        },
      },
      'policies/detectorBlockedURLs': {
        name: 'policies/detectorBlockedURLs',
        customer: 'customers/C04x8k2m9',
        policyQuery: { orgUnit: 'orgUnits/ouRoot' },
        setting: {
          type: 'settings/detector.url_list',
          value: {
            displayName: 'Blocked Upload Destinations',
            description: 'URLs where file uploads are blocked',
            url_list: { urls: ['mega.nz', 'wetransfer.com', 'anonfiles.com'] },
          },
        },
      },
    },

    connectorPolicies: {
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
                  blockPasswordProtectedFiles: true,
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
                  blockPasswordProtectedFiles: true,
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
                  delayDeliveryUntilVerdict: false,
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
                printAnalysisConfiguration: {
                  serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
                  delayDeliveryUntilVerdict: true,
                },
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
              realtimeUrlCheckEnabled: true,
              realtimeUrlCheckMode: 'ENTERPRISE_REAL_TIME_URL_CHECK_MODE_ENUM_ENABLED',
            },
          },
        },
      ],
      'chrome.users.OnSecurityEvent': [
        {
          value: {
            policySchema: 'chrome.users.OnSecurityEvent',
            value: {
              reportingConnector: {
                eventConfiguration: {
                  enabledEventNames: [
                    'passwordReuseEvent',
                    'dangerousDownloadEvent',
                    'passwordChangedEvent',
                    'loginEvent',
                    'contentTransferEvent',
                  ],
                },
              },
            },
          },
        },
      ],
      'chrome.users.apps.InstallType': [
        {
          targetKey: {
            additionalTargetKeys: {
              app_id: 'chrome:ekajlcmdfcigmdbphhifahdfjbkciflj',
            },
          },
          value: {
            policySchema: 'chrome.users.apps.InstallType',
            value: { appInstallType: 'FORCED' },
          },
        },
      ],
    },

    activities: [
      {
        id: { time: '2026-04-01T10:15:00Z', applicationName: 'chrome' },
        actor: { email: 'alice@example.com' },
        events: [
          {
            type: 'DLP_EVENT',
            name: 'DLP_BLOCK',
            parameters: [
              { name: 'TRIGGER', value: 'FILE_UPLOAD' },
              {
                name: 'MATCHED_RULE',
                value: 'Block sensitive file uploads',
              },
              { name: 'URL', value: 'https://mega.nz/upload' },
            ],
          },
        ],
      },
      {
        id: { time: '2026-04-02T14:30:00Z', applicationName: 'chrome' },
        actor: { email: 'bob@example.com' },
        events: [
          {
            type: 'DLP_EVENT',
            name: 'DLP_WARN',
            parameters: [
              { name: 'TRIGGER', value: 'FILE_UPLOAD' },
              { name: 'MATCHED_RULE', value: 'Warn before uploading PII' },
              { name: 'URL', value: 'https://salesforce.com/upload' },
            ],
          },
        ],
      },
      {
        id: { time: '2026-04-03T09:00:00Z', applicationName: 'chrome' },
        actor: { email: 'alice@example.com' },
        events: [
          {
            type: 'DLP_EVENT',
            name: 'DLP_AUDIT',
            parameters: [
              { name: 'TRIGGER', value: 'WEB_CONTENT_UPLOAD' },
              {
                name: 'MATCHED_RULE',
                value: 'Audit pastes to generative AI sites',
              },
              { name: 'URL', value: 'https://chat.openai.com' },
            ],
          },
        ],
      },
    ],

    browserVersions: [
      { version: '134.0.6998.45', count: '82', channel: 'STABLE' },
      { version: '135.0.7049.12', count: '5', channel: 'BETA' },
      { version: '136.0.7100.3', count: '2', channel: 'CANARY' },
    ],

    profiles: [],

    licenses: {
      C04x8k2m9: {
        101040: {
          1010400001: [
            {
              userId: 'alice@example.com',
              skuId: '1010400001',
              productId: '101040',
            },
            {
              userId: 'bob@example.com',
              skuId: '1010400001',
              productId: '101040',
            },
          ],
        },
      },
    },
  }
}
