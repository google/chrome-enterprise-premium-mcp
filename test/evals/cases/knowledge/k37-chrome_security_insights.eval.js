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
  id: 'k37',
  priority: 'P1',
  tags: ['security_insights', 'dashboard', '1-click'],
  prompt:
    'What is Chrome Security Insights? What does the 1-click "Monitor data leaks and insider risk" flow automate, and does having active DLP rules guarantee that the Security Insights dashboard is active?',
  goldenResponse:
    'Chrome Security Insights is a feature that provides visibility into insider risk and data exfiltration. The 1-click "Monitor data leaks and insider risk" flow automatically enables Chrome Enterprise Connectors, Chrome Security event logging, and activates 50 common DLP detectors to scan for sensitive content transfer events. Crucially, having active DLP rules and connectors does NOT guarantee that the Security Insights dashboard is active; the dashboard itself requires explicit activation (such as via the 1-click flow) to populate, as dashboard activation is isolated from rule/connector status.',
  judgeInstructions:
    'The agent should explain that Chrome Security Insights provides visibility into insider risk and data exfiltration. It should note the 1-click flow automates Chrome Enterprise Connectors, Chrome Security event logging, and activates 50 common DLP detectors. Finally, it must explicitly clarify that active DLP rules/connectors do not guarantee that the Security Insights dashboard is active (dashboard activation requires explicit activation, e.g. via the 1-click flow).',
}
