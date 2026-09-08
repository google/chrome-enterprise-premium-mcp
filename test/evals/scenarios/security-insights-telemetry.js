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
 * @fileoverview Scenario: Chrome Security Insights telemetry data and activities.
 */

/**
 * Mutates the base state to set up Security Insights telemetry and activities.
 * @param {object} state - Cloned base state.
 * @returns {object} The mutated state.
 */
export function mutate(state) {
  state.insightsState = 'INSIGHTS_ENABLED'

  // Set the domain to match the golden response
  const customerId = state.defaultCustomerId
  if (state.customers[customerId]) {
    state.customers[customerId].customerDomain = 'securityinsights-e2e-readonly-prod.apollo-df.dev'
  }

  // Set the pre-computed telemetry data
  state.securityInsightsData = {
    contentTransfers: {
      summaries: [
        {
          metric: 'CONTENT_TRANSFERS_METRIC_TOTAL_TRANSFERS',
          count: '12500',
        },
        {
          metric: 'CONTENT_TRANSFERS_METRIC_SENSITIVE_DATA_TRANSFERS',
          count: '450',
        },
      ],
    },
    contentTransfersBreakdowns: {
      contentTransfersBreakdowns: [
        {
          user: 'alice@securityinsights-e2e-readonly-prod.apollo-df.dev',
          summary: { count: '150' },
        },
        {
          user: 'bob@securityinsights-e2e-readonly-prod.apollo-df.dev',
          summary: { count: '92' },
        },
      ],
    },
    urlVisits: {
      summaries: [
        {
          metric: 'URL_VISITS_METRIC_TOTAL_SUSPICIOUS_URL_VISITS',
          count: '8627',
        },
      ],
    },
    urlVisitsBreakdowns: {
      urlVisitsBreakdowns: [
        {
          eventDomain: 'protegotollamadummyurl-higher.com',
          summary: { count: '2713' },
        },
        {
          eventDomain: 'protegotollamadummyurl-high.com',
          summary: { count: '2713' },
        },
        {
          eventDomain: 'protegotollamadummyurl.com',
          summary: { count: '2709' },
        },
      ],
    },
  }

  // Add the specific activity log for the unsafe site visit
  state.activities = [
    {
      kind: 'admin#reports#activity',
      id: {
        time: '2026-04-10T14:22:00Z',
        applicationName: 'chrome',
        customerId: customerId,
      },
      actor: { email: 'user@securityinsights-e2e-readonly-prod.apollo-df.dev' },
      events: [
        {
          type: 'UNSAFE_SITE_VISIT_TYPE',
          name: 'UNSAFE_SITE_VISIT',
          parameters: [
            { name: 'URL', value: 'https://protegotollamadummyurl.com/PHISHING' },
            { name: 'THREAT_TYPE', value: 'PHISHING' },
          ],
        },
      ],
    },
  ]

  return state
}
