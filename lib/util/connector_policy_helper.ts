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
 * @file Shared logic for analyzing Chrome Enterprise Premium policy health.
 *
 * Centralizes technical validation of "is it enabled and protective?" vs
 * "does the policy just exist?".
 */

import { EVENT_NAME_MAPPING } from '../constants.js'
import { formatStatus } from './helpers.js'

/**
 * Normalizes an API value to a human-readable string for comparison.
 * @param {any} val - The raw value from the API.
 * @returns {string} The formatted string.
 */
export function humanize(val) {
  if (typeof val === 'boolean') {
    return val ? 'Yes' : 'No'
  }
  if (Array.isArray(val)) {
    return val.map(humanize).join(', ')
  }
  if (typeof val !== 'string') {
    return String(val)
  }
  if (EVENT_NAME_MAPPING[val]) {
    return EVENT_NAME_MAPPING[val]
  }
  return formatStatus(val.replace(/^[A-Z_]+_ENUM_/, '').replace(/^SERVICE_PROVIDER_/, ''))
}

/**
 * Analyzes the health and protection state of a Chrome Enterprise connector policy.
 * @param {string} policyType - The enum key (e.g., 'ON_PRINT', 'ON_SECURITY_EVENT').
 * @param {Array<object>} resolvedPolicies - The raw resolved policies from the API.
 * @returns {object} Analysis result containing isConfigured, isEnabled, and findings.
 */
export function analyzeConnectorPolicy(policyType, resolvedPolicies) {
  if (!resolvedPolicies || resolvedPolicies.length === 0) {
    return {
      isConfigured: false,
      isEnabled: false,
      findings: [],
    }
  }

  // Aggregate results across all resolved policies (usually there is only one)
  const results = resolvedPolicies.map(p => {
    const v = p.value?.value || {}
    const findings = []
    let isEnabled = true

    if (policyType === 'ON_SECURITY_EVENT') {
      const eventCfg = v.reportingConnector?.setting?.eventConfiguration || v.reportingConnector?.eventConfiguration
      const events = eventCfg?.enabledEventNames || []
      const explicitlyEmpty = eventCfg?.explicitlyEmptyEventNames
      const coreEvents = [
        'contentTransferEvent',
        'unscannedFileEvent',
        'dangerousDownloadEvent',
        'sensitiveDataEvent',
        'interstitialEvent',
        'urlFilteringInterstitialEvent',
        'suspiciousUrlEvent',
      ]

      if (!eventCfg) {
        isEnabled = false
      } else {
        let missingCoreEvents = []
        if (events.length > 0) {
          missingCoreEvents = coreEvents.filter(e => !events.includes(e))
        } else if (explicitlyEmpty) {
          missingCoreEvents = coreEvents
        }

        if (missingCoreEvents.length > 0) {
          const mappedMissing = missingCoreEvents.map(e => EVENT_NAME_MAPPING[e] || e)
          findings.push({
            message: `Missing core DLP events: ${mappedMissing.join(', ')}`,
            remediationType: 'manual',
          })
        }
      }
    } else if (policyType === 'ON_REALTIME_URL_NAVIGATION') {
      const checkEnabled = v.realtimeUrlCheckEnabled
      if (
        checkEnabled === false ||
        checkEnabled === 'REALTIME_URL_CHECK_MODE_ENUM_DISABLED' ||
        checkEnabled === 'ENTERPRISE_REAL_TIME_URL_CHECK_MODE_ENUM_DISABLED' ||
        checkEnabled === 'REALTIME_URL_CHECK_MODE_ENUM_UNSPECIFIED' ||
        checkEnabled === 'ENTERPRISE_REAL_TIME_URL_CHECK_MODE_ENUM_UNSPECIFIED'
      ) {
        isEnabled = false
        findings.push({
          message: 'Real-time URL check is explicitly disabled',
          remediationType: 'manual',
        })
      }
    } else {
      // Non-Reporting Connectors (Upload, Download, Paste, Print)
      const cfg =
        v.onFileAttachedAnalysisConnectorConfiguration?.fileAttachedConfiguration ||
        v.onFileDownloadedAnalysisConnectorConfiguration?.fileDownloadedConfiguration ||
        v.onBulkTextEntryAnalysisConnectorConfiguration?.bulkTextEntryConfiguration ||
        v.onPrintAnalysisConnectorConfiguration?.printConfigurations?.[0] ||
        v

      const isCEP = cfg.serviceProvider === 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM'
      const isNone =
        !cfg.serviceProvider ||
        cfg.serviceProvider === 'SERVICE_PROVIDER_NONE' ||
        cfg.serviceProvider === 'SERVICE_PROVIDER_UNSPECIFIED'

      if (isCEP) {
        if (!cfg.delayDeliveryUntilVerdict && !cfg.delay_delivery_until_verdict) {
          findings.push({
            message: 'Delay enforcement is disabled. Users are unprotected during content analysis',
            remediationType: 'manual',
          })
        }

        // URL Gaps (Malware/Sensitive)
        const checkGaps = (type, onByDefault, patterns) => {
          const humanized = humanize(onByDefault)
          if (humanized === 'No') {
            const patternMsg =
              patterns && patterns.length > 0 ? 'ONLY enabled for specific URL patterns' : 'NOT enabled for all files'
            findings.push({
              message: `⚠️ ${type} Analysis is restricted. Scanning is ${patternMsg}`,
              remediationType: 'manual',
            })
          } else if (patterns && patterns.length > 0) {
            findings.push({
              message: `⚠️ ${type} Analysis is restricted. Scanning is DISABLED for specific URL patterns`,
              remediationType: 'manual',
            })
          }
        }

        // Need to check specific fields as original code did
        if (cfg.malwareUrlPatterns?.onByDefault !== undefined) {
          checkGaps('Malware', cfg.malwareUrlPatterns.onByDefault, cfg.malwareUrlPatterns.urlPatterns)
        } else if (cfg.malwareOnByDefault !== undefined) {
          checkGaps('Malware', cfg.malwareOnByDefault, cfg.malwareUrlPatterns)
        }

        if (cfg.sensitiveUrlPatterns?.onByDefault !== undefined) {
          checkGaps('Sensitive', cfg.sensitiveUrlPatterns.onByDefault, cfg.sensitiveUrlPatterns.urlPatterns)
        } else if (cfg.sensitiveOnByDefault !== undefined) {
          checkGaps('Sensitive', cfg.sensitiveOnByDefault, cfg.sensitiveUrlPatterns)
        }

        // Fallback for connectors that don't use the new prefixed fields yet
        if (
          cfg.malwareOnByDefault === undefined &&
          cfg.malwareUrlPatterns?.onByDefault === undefined &&
          cfg.sensitiveOnByDefault === undefined &&
          cfg.sensitiveUrlPatterns?.onByDefault === undefined
        ) {
          if (cfg.malwareUrlPatterns?.length > 0 || cfg.sensitiveUrlPatterns?.length > 0) {
            findings.push({
              message: 'Security posture is limited due to URL allowlisting',
              remediationType: 'manual',
            })
          }
        }
      } else if (isNone) {
        isEnabled = false
      } else {
        const is3p =
          cfg.serviceProvider === 'SERVICE_PROVIDER_SYMANTEC_ENDPOINT_DLP' ||
          cfg.serviceProvider === 'SERVICE_PROVIDER_TRELLIX'
        if (is3p) {
          findings.push({
            message: '3rd party provider detected. Integrated CEP features may be bypassed',
            remediationType: 'manual',
          })
        }
      }
    }

    return { isEnabled, findings }
  })

  // Deduplicate and aggregate findings
  const allFindings = results.flatMap(r => r.findings)
  const uniqueMessages = new Set()
  const uniqueFindings = []

  for (const f of allFindings) {
    if (!uniqueMessages.has(f.message)) {
      uniqueMessages.add(f.message)
      uniqueFindings.push(f)
    }
  }

  return {
    isConfigured: true,
    isEnabled: results.some(r => r.isEnabled),
    findings: uniqueFindings,
  }
}
