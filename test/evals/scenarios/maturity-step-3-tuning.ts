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

import { CEP_CONSTANTS } from '../../../lib/constants.js'

/**
 * @file Scenario: all prerequisites met, audit rules active, and logs populated.
 *
 * This represents a "Perfect Step 3" state where the foundation is solid,
 * and the agent should move directly to log analysis and rule tuning.
 */

/** @param {object} state - Cloned base state. */
export function mutate(state) {
  const customerId = state.defaultCustomerId

  // 1. Fix all connectors (Enable Delay Enforcement, ensure CEP provider)
  const policies = state.globalConnectorPolicies

  // Upload
  const uploadCfg =
    policies['chrome.users.OnFileAttachedConnectorPolicy'][0].value.value.onFileAttachedAnalysisConnectorConfiguration
      .fileAttachedConfiguration
  uploadCfg.serviceProvider = 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM'
  uploadCfg.delayDeliveryUntilVerdict = true

  // Download
  const downloadCfg =
    policies['chrome.users.OnFileDownloadedConnectorPolicy'][0].value.value
      .onFileDownloadedAnalysisConnectorConfiguration.fileDownloadedConfiguration
  downloadCfg.serviceProvider = 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM'
  downloadCfg.delayDeliveryUntilVerdict = true

  // Paste
  const pasteCfg =
    policies['chrome.users.OnBulkTextEntryConnectorPolicy'][0].value.value.onBulkTextEntryAnalysisConnectorConfiguration
      .bulkTextEntryConfiguration
  pasteCfg.serviceProvider = 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM'
  pasteCfg.delayDeliveryUntilVerdict = true

  // Print
  const printCfg =
    policies['chrome.users.OnPrintAnalysisConnectorPolicy'][0].value.value.onPrintAnalysisConnectorConfiguration
      .printConfigurations[0]
  printCfg.serviceProvider = 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM'
  printCfg.delayDeliveryUntilVerdict = true

  // Event Reporting (All core events)
  const eventCfg = policies['chrome.users.OnSecurityEvent'][0].value.value.reportingConnector.eventConfiguration
  eventCfg.enabledEventNames = [
    'browserCrashEvent',
    'browserExtensionInstallEvent',
    'contentTransferEvent',
    'unscannedFileEvent',
    'dangerousDownloadEvent',
    'passwordChangedEvent',
    'passwordReuseEvent',
    'sensitiveDataEvent',
    'interstitialEvent',
    'urlFilteringInterstitialEvent',
    'suspiciousUrlEvent',
  ]

  // 2. Ensure enough licenses are assigned
  state.licenses[customerId][CEP_CONSTANTS.PRODUCT_ID][CEP_CONSTANTS.SKU_ID] = [
    { userId: 'admin@example.com' },
    { userId: 'alice@example.com' },
    { userId: 'user1@example.com' },
    { userId: 'user2@example.com' },
    { userId: 'user3@example.com' },
  ]
  // Update browser version counts to match license count (to avoid "Missing Licenses" finding)
  state.browserVersions = [{ version: '136.0.0.0', count: '5', channel: 'STABLE' }]

  // 3. Make all rules audit-only to force the "Tuning" heuristics
  for (const key of Object.keys(state.policies)) {
    const setting = state.policies[key].setting
    if (setting?.type === 'settings/rule.dlp' && setting.value?.action) {
      setting.value.action = { chromeAction: { auditOnly: {} } }
      setting.value.displayName = `🤖 Audit: ${setting.value.displayName}`
    }
  }

  // 4. Add risky activity logs
  state.activities = [
    {
      kind: 'admin#reports#activity',
      id: { time: '2026-05-01T09:00:00Z', applicationName: 'chrome', customerId: state.defaultCustomerId },
      actor: { email: 'admin@example.com' },
      events: [
        {
          type: 'DLP_EVENT',
          name: 'DLP_AUDIT',
          parameters: [
            { name: 'TRIGGER_TYPE', value: 'FILE_UPLOAD' },
            { name: 'MATCHED_RULE', value: '🤖 Audit: Block sensitive file uploads' },
            { name: 'CONTENT_NAME', value: 'secret_project.pdf' },
            { name: 'URL', value: 'https://personal-dropbox.com/upload' },
          ],
        },
      ],
    },
    {
      kind: 'admin#reports#activity',
      id: { time: '2026-05-01T10:15:00Z', applicationName: 'chrome', customerId: state.defaultCustomerId },
      actor: { email: 'admin@example.com' },
      events: [
        {
          type: 'DLP_EVENT',
          name: 'DLP_AUDIT',
          parameters: [
            { name: 'TRIGGER_TYPE', value: 'FILE_UPLOAD' },
            { name: 'MATCHED_RULE', value: '🤖 Audit: Block sensitive file uploads' },
            { name: 'CONTENT_NAME', value: 'passwords.txt' },
            { name: 'URL', value: 'https://personal-dropbox.com/upload' },
          ],
        },
      ],
    },
  ]

  return state
}
