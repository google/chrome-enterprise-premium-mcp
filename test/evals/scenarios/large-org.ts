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
 * @fileoverview Scenario: large enterprise organization.
 *
 * ~200 OUs, 30 DLP rules (some with messy names), 10 detectors,
 * 5000 licenses, 8 browser versions. Tests whether the tool and
 * agent handle realistic enterprise scale.
 */

/** @param {object} state - Cloned base state. */
export function mutate(state) {
  // ~200 OUs: root + 20 regions × 10 departments each
  const ous = {}
  ous.ouRoot = {
    name: 'Root OU',
    orgUnitId: 'id:ouRoot',
    orgUnitPath: '/',
    parentOrgUnitId: null,
  }

  const regions = [
    'NA-East',
    'NA-West',
    'NA-Central',
    'EMEA-UK',
    'EMEA-DE',
    'EMEA-FR',
    'EMEA-NL',
    'APAC-JP',
    'APAC-AU',
    'APAC-SG',
    'APAC-IN',
    'LATAM-BR',
    'LATAM-MX',
    'Contractors',
    'Executives',
    'IT-Admins',
    'Shared-Devices',
    'Kiosks',
    'Labs',
    'Staging',
  ]

  for (const region of regions) {
    const regionId = `ou${region.replace(/[^a-zA-Z]/g, '')}`
    ous[regionId] = {
      name: region,
      orgUnitId: `id:${regionId}`,
      orgUnitPath: `/${region}`,
      parentOrgUnitId: 'id:ouRoot',
    }

    const teams = [
      'Engineering',
      'Sales',
      'Marketing',
      'Finance',
      'Legal',
      'HR',
      'Support',
      'Operations',
      'Product',
      'Design',
    ]
    for (const team of teams) {
      const teamId = `${regionId}${team}`
      ous[teamId] = {
        name: `${region} - ${team}`,
        orgUnitId: `id:${teamId}`,
        orgUnitPath: `/${region}/${team}`,
        parentOrgUnitId: `id:${regionId}`,
      }
    }
  }
  state.orgUnits = { C04x8k2m9: ous }

  // 30 DLP rules — some well-named, some messy (realistic)
  state.policies = {}

  const triggers = [
    'google.workspace.chrome.file.v1.upload',
    'google.workspace.chrome.file.v1.download',
    'google.workspace.chrome.web_content.v1.upload',
    'google.workspace.chrome.url.v1.navigation',
    'google.workspace.chrome.page.v1.print',
  ]
  const actions = [
    { chromeAction: { blockContent: {} } },
    { chromeAction: { warnUser: {} } },
    { chromeAction: { auditOnly: {} } },
    { chromeAction: { watermarkContent: {} } },
  ]
  const ruleNames = [
    'Block SSN uploads - PROD',
    'Block credit card downloads',
    'Warn on PII paste to external',
    'Audit GenAI site navigation',
    'Block malware URL list',
    'test rule - DELETE ME',
    'Warn on large file upload >50MB',
    'Copy of Block SSN uploads - PROD',
    'Audit external file sharing',
    'Block competitor site access (Q3)',
    'DISABLED - old paste rule',
    'Warn on code paste to AI tools',
    'Audit print of confidential docs',
    'Block upload to personal storage',
    'Watermark sensitive URL browsing',
    'EMEA GDPR compliance - block',
    'APAC data residency - warn',
    'NA-only: audit healthcare data',
    'Block social media uploads',
    'test rule 2 DO NOT USE',
    'Warn before downloading executables',
    'Audit all URL navigation (verbose)',
    'Block paste to ChatGPT/Gemini',
    'Watermark financial documents',
    'LATAM compliance - audit uploads',
    'IT-Admin exception - audit only',
    'Kiosk lockdown - block all uploads',
    'Lab environment - warn on downloads',
    'Staging - audit everything',
    'Executive browsing - watermark',
  ]

  for (let i = 0; i < 30; i++) {
    const name = `policies/dlpRule${i}`
    const isMessy = ruleNames[i].includes('DELETE') || ruleNames[i].includes('DO NOT USE')
    state.policies[name] = {
      name,
      customer: 'customers/C04x8k2m9',
      policyQuery: { orgUnit: `orgUnits/${i < 15 ? 'ouRoot' : 'ouNAEast'}` },
      setting: {
        type: 'settings/rule.dlp',
        value: {
          displayName: ruleNames[i],
          state: isMessy || i >= 28 ? 'INACTIVE' : 'ACTIVE',
          triggers: [triggers[i % triggers.length]],
          condition: { contentCondition: 'all_content.contains("sensitive")' },
          action: actions[i % actions.length],
        },
      },
    }
  }

  // 10 detectors
  for (let i = 0; i < 10; i++) {
    const name = `policies/detector${i}`
    const types = ['settings/detector.regex', 'settings/detector.word_list', 'settings/detector.url_list']
    state.policies[name] = {
      name,
      customer: 'customers/C04x8k2m9',
      policyQuery: { orgUnit: 'orgUnits/ouRoot' },
      setting: {
        type: types[i % types.length],
        value: { displayName: `Detector ${i + 1}` },
      },
    }
  }

  // 8 browser versions showing sprawl
  state.browserVersions = [
    { version: '134.0.6998.45', count: '2500', channel: 'STABLE' },
    { version: '133.0.6943.98', count: '1200', channel: 'STABLE' },
    { version: '132.0.6834.83', count: '400', channel: 'STABLE' },
    { version: '131.0.6778.69', count: '200', channel: 'STABLE' },
    { version: '130.0.6723.58', count: '80', channel: 'STABLE' },
    { version: '128.0.6613.84', count: '30', channel: 'STABLE' },
    { version: '135.0.7049.12', count: '50', channel: 'BETA' },
    { version: '136.0.7100.3', count: '10', channel: 'CANARY' },
  ]

  // 5000 licenses
  state.licenses = {
    C04x8k2m9: {
      101040: {
        1010400001: Array.from({ length: 5000 }, (_, i) => ({
          userId: `user${i + 1}@example.com`,
          skuId: '1010400001',
          productId: '101040',
        })),
      },
    },
  }

  return state
}
