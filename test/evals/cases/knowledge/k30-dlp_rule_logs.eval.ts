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
  id: 'k30',
  priority: 'P2',
  tags: ['dlp', 'troubleshooting'],
  prompt: `Support asked for logs regarding a DLP rule that isn't triggering. Which logs are needed?`,
  goldenResponse: `For troubleshooting DLP rules:

- **Client-side:** Ask the user to check \`chrome://policy\` to verify the rule has been received by the browser.
- **Server-side:** Check the 'Chrome log events' in the Google Admin Console under Reporting > Audit and investigation. Filter by the user, time range, and event type (e.g., 'Data Loss Prevention'). Ensure the user is licensed and the rule is correctly scoped to their OU or group.`,
}
