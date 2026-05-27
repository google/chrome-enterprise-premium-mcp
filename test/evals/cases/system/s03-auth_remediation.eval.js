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
  id: 's03',
  priority: 'P1',
  tags: ['auth', 'remediation'],
  expectedTools: ['list_org_units'],
  requiredPatterns: ['auth login', 'cep_auth'],
  prompt:
    "I'm trying to list my organizational units but I keep getting an authentication error. Can you help me fix it?",
  goldenResponse:
    'Agent should recognize that the user is experiencing authentication issues. It should attempt to call a tool (like `list_org_units`), which will return a remediation message if credentials are missing or under-scoped. The agent must then present the `cep_auth` tool or the built-in `auth login` CLI command (e.g. `npx -y @google/chrome-enterprise-premium-mcp@latest auth login`) to the user to re-consent with the updated scope set.',
  judgeInstructions:
    "Verify the agent provides the correct built-in `cep_auth` or `auth login` command for remediation. The response should be helpful and guide the user on how to re-authenticate with the proper scopes using the server's built-in auth tools. It must not recommend outdated gcloud commands.",
}
