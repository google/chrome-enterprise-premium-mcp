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
import { formatStatus, isObject, getString, getObject, getStringArray, getObjectArray } from './helpers.js'
import { chromepolicy_v1 } from 'googleapis'

/**
 * Normalizes an API value to a human-readable string for comparison.
 * @param val The raw value from the API.
 * @returns The formatted string.
 */
export function humanize(val: unknown): string {
  if (typeof val === 'boolean') {
    return val ? 'Yes' : 'No'
  }
  if (Array.isArray(val)) {
    return val.map(humanize).join(', ')
  }
  if (typeof val !== 'string') {
    return String(val)
  }
  if (val in EVENT_NAME_MAPPING) {
    return EVENT_NAME_MAPPING[val as keyof typeof EVENT_NAME_MAPPING]
  }
  return formatStatus(val.replace(/^[A-Z_]+_ENUM_/, '').replace(/^SERVICE_PROVIDER_/, ''))
}

export interface PolicyFinding {
  message: string
  remediationType: 'manual' | (string & {})
}

export interface PolicyAnalysisResult {
  isConfigured: boolean
  isEnabled: boolean
  findings: PolicyFinding[]
}

/**
 * Analyzes the health and protection state of a Chrome Enterprise connector policy.
 * @param policyType The enum key (e.g., 'ON_PRINT', 'ON_SECURITY_EVENT').
 * @param resolvedPolicies The raw resolved policies from the API.
 * @returns Analysis result containing isConfigured, isEnabled, and findings.
 */
export function analyzeConnectorPolicy(
  policyType: string,
  resolvedPolicies: chromepolicy_v1.Schema$GoogleChromePolicyVersionsV1ResolvedPolicy[] | undefined,
): PolicyAnalysisResult {
  if (!resolvedPolicies || resolvedPolicies.length === 0) {
    return {
      isConfigured: false,
      isEnabled: false,
      findings: [],
    }
  }

  // Aggregate results across all resolved policies (usually there is only one)
  const results = resolvedPolicies.map(p => {
    const valObj = p.value?.value
    const v = isObject(valObj) ? valObj : {}
    const findings: PolicyFinding[] = []
    let isEnabled = true

    if (policyType === 'ON_SECURITY_EVENT') {
      const reportingConnector = getObject(v, 'reportingConnector')
      const setting = reportingConnector ? getObject(reportingConnector, 'setting') : null
      const eventCfg = setting
        ? getObject(setting, 'eventConfiguration')
        : reportingConnector
          ? getObject(reportingConnector, 'eventConfiguration')
          : null

      const events = eventCfg ? getStringArray(eventCfg, 'enabledEventNames') || [] : []
      const explicitlyEmpty = eventCfg ? eventCfg['explicitlyEmptyEventNames'] : null
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
        let missingCoreEvents: string[] = []
        if (events.length > 0) {
          missingCoreEvents = coreEvents.filter(e => !events.includes(e))
        } else if (explicitlyEmpty === true || explicitlyEmpty === 'true') {
          missingCoreEvents = coreEvents
        }

        if (missingCoreEvents.length > 0) {
          const mappedMissing = missingCoreEvents.map(e => {
            if (e in EVENT_NAME_MAPPING) {
              return EVENT_NAME_MAPPING[e as keyof typeof EVENT_NAME_MAPPING]
            }
            return e
          })
          findings.push({
            message: `Missing core DLP events: ${mappedMissing.join(', ')}`,
            remediationType: 'manual',
          })
        }
      }
    } else if (policyType === 'ON_REALTIME_URL_NAVIGATION') {
      const checkEnabled = v['realtimeUrlCheckEnabled']
      if (
        checkEnabled === false ||
        checkEnabled === 'false' ||
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
      const fileAttached = getObject(v, 'onFileAttachedAnalysisConnectorConfiguration')
      const fileDownloaded = getObject(v, 'onFileDownloadedAnalysisConnectorConfiguration')
      const bulkText = getObject(v, 'onBulkTextEntryAnalysisConnectorConfiguration')
      const printAnalysis = getObject(v, 'onPrintAnalysisConnectorConfiguration')
      const printConfigs = printAnalysis ? getObjectArray(printAnalysis, 'printConfigurations') : null

      const cfg =
        (fileAttached && getObject(fileAttached, 'fileAttachedConfiguration')) ||
        (fileDownloaded && getObject(fileDownloaded, 'fileDownloadedConfiguration')) ||
        (bulkText && getObject(bulkText, 'bulkTextEntryConfiguration')) ||
        (printConfigs && printConfigs.length > 0 && isObject(printConfigs[0]) ? printConfigs[0] : null) ||
        v

      const serviceProvider = getString(cfg, 'serviceProvider')
      const isCEP = serviceProvider === 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM'
      const isNone =
        !serviceProvider ||
        serviceProvider === 'SERVICE_PROVIDER_NONE' ||
        serviceProvider === 'SERVICE_PROVIDER_UNSPECIFIED'

      if (isCEP) {
        const delayDelivery =
          cfg['delayDeliveryUntilVerdict'] !== undefined
            ? cfg['delayDeliveryUntilVerdict']
            : cfg['delay_delivery_until_verdict']
        if (delayDelivery === false || delayDelivery === 'false' || !delayDelivery) {
          findings.push({
            message: 'Delay enforcement is disabled. Users are unprotected during content analysis',
            remediationType: 'manual',
          })
        }

        // URL Gaps (Malware/Sensitive)
        const checkGaps = (type: string, onByDefault: unknown, patterns: unknown) => {
          const humanized = humanize(onByDefault)
          const patternsList = Array.isArray(patterns) ? patterns : []
          if (humanized === 'No') {
            const patternMsg =
              patternsList.length > 0 ? 'ONLY enabled for specific URL patterns' : 'NOT enabled for all files'
            findings.push({
              message: `⚠️ ${type} Analysis is restricted. Scanning is ${patternMsg}`,
              remediationType: 'manual',
            })
          } else if (patternsList.length > 0) {
            findings.push({
              message: `⚠️ ${type} Analysis is restricted. Scanning is DISABLED for specific URL patterns`,
              remediationType: 'manual',
            })
          }
        }

        const malwareUrl = getObject(cfg, 'malwareUrlPatterns')
        const sensitiveUrl = getObject(cfg, 'sensitiveUrlPatterns')

        if (malwareUrl) {
          checkGaps('Malware', malwareUrl['onByDefault'], getStringArray(malwareUrl, 'urlPatterns'))
        } else if (cfg['malwareOnByDefault'] !== undefined) {
          checkGaps('Malware', cfg['malwareOnByDefault'], getStringArray(cfg, 'malwareUrlPatterns'))
        }

        if (sensitiveUrl) {
          checkGaps('Sensitive', sensitiveUrl['onByDefault'], getStringArray(sensitiveUrl, 'urlPatterns'))
        } else if (cfg['sensitiveOnByDefault'] !== undefined) {
          checkGaps('Sensitive', cfg['sensitiveOnByDefault'], getStringArray(cfg, 'sensitiveUrlPatterns'))
        }

        // Fallback for connectors that don't use the new prefixed fields yet
        const malwareList = getStringArray(cfg, 'malwareUrlPatterns') || []
        const sensitiveList = getStringArray(cfg, 'sensitiveUrlPatterns') || []

        if (
          cfg['malwareOnByDefault'] === undefined &&
          !malwareUrl &&
          cfg['sensitiveOnByDefault'] === undefined &&
          !sensitiveUrl
        ) {
          if (malwareList.length > 0 || sensitiveList.length > 0) {
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
          serviceProvider === 'SERVICE_PROVIDER_SYMANTEC_ENDPOINT_DLP' || serviceProvider === 'SERVICE_PROVIDER_TRELLIX'
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
  const uniqueMessages = new Set<string>()
  const uniqueFindings: PolicyFinding[] = []

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
