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
  id: 'k29',
  priority: 'P2',
  tags: ['policy', 'gpo'],
  requiredPatterns: [],
  prompt: `We set a cloud policy to block an extension, but \`chrome://policy\` shows it's allowed with the source 'Platform'.`,
  goldenResponse: `Local 'Platform' policies (e.g., from GPO on Windows, Configuration Profiles on macOS) take precedence over Cloud policies by default. You can change this behavior by enabling the '[CloudPolicyOverridesPlatformPolicy](https://chromeenterprise.google/policies/#CloudPolicyOverridesPlatformPolicy)' policy. The default policy precedence is also discussed in the Recommended CEP Settings for a POV document.`,
}
