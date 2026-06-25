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

export default {
  id: 'i16',
  priority: 'P1',
  tags: ['inspection'],
  scenario: 'security-insights-telemetry',
  experiments: {
    SECURITY_INSIGHTS_DATA_TOOL_ENABLED: true,
  },
  expectedTools: ['security_insights_data'],
  prompt:
    'Can you give me a summary of the content transfers in my domain, including the top users contributing to them?',
  goldenResponse:
    'Based on the security telemetry for your domain (securityinsights-e2e-readonly-prod.apollo-df.dev),\n' +
    'there have been a total of 12,500 content transfers recorded in the last 4 weeks.\n' +
    'Out of these, 450 transfers were flagged as containing sensitive data.\n' +
    'The top contributors to sensitive transfers are:\n' +
    ' - alice@securityinsights-e2e-readonly-prod.apollo-df.dev (150 transfers)\n' +
    ' - bob@securityinsights-e2e-readonly-prod.apollo-df.dev (92 transfers)',
  judgeInstructions:
    'Verify that the agent successfully retrieves and reports the following key details:\n' +
    '1. The domain name: securityinsights-e2e-readonly-prod.apollo-df.dev\n' +
    '2. The total count of 12,500 content transfers.\n' +
    '3. The sensitive transfers count of 450.\n' +
    '4. The top users contributing to these transfers: alice (150) and bob (92).\n' +
    'The agent must use the security_insights_data tool to retrieve this information.',
}
