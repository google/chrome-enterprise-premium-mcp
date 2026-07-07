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
  id: 'i15',
  priority: 'P1',
  tags: ['inspection'],
  scenario: 'security-insights-telemetry',
  experiments: {
    SECURITY_INSIGHTS_DATA_TOOL_ENABLED: true,
  },
  expectedTools: ['security_insights_data'],
  prompt: 'Can you tell me what urls are being visited in my domain',
  goldenResponse:
    'Based on the Chrome Enterprise security telemetry for your domain\n' +
    "  (securityinsights-e2e-readonly-prod.apollo-df.dev), I've identified several categories\n" +
    '  of URL activity being monitored and visited:\n\n' +
    '  1. Suspicious and Unsafe Site Visits\n' +
    '  In the last 4 weeks, there have been 8,627 suspicious URL visits recorded. The most\n' +
    '  frequently visited suspicious domains are:\n' +
    '   * protegotollamadummyurl-higher.com: 2,713 visits\n' +
    '   * protegotollamadummyurl-high.com: 2,713 visits\n' +
    '   * protegotollamadummyurl.com: 2,709 visits',
  judgeInstructions:
    'Verify that the agent successfully retrieves and reports the following key details:\n' +
    '1. The total count of 8,627 suspicious URL visits.\n' +
    '2. The top 3 suspicious domains with their exact visit counts:\n' +
    '   - protegotollamadummyurl-higher.com (2,713 visits)\n' +
    '   - protegotollamadummyurl-high.com (2,713 visits)\n' +
    '   - protegotollamadummyurl.com (2,709 visits)\n' +
    'The agent must use the security_insights_data tool to compile this information.',
}
