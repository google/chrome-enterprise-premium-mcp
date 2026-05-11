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
  id: 'k09',
  priority: 'P1',
  tags: ['deployment', 'ev', 'mdm'],
  requiredPatterns: ['ExtensionInstallForcelist'],
  prompt:
    'What is the best practice for silently deploying Endpoint Verification to all endpoints using an MDM like Intune?',
  goldenResponse: `The best practice involves two main steps:

1. Use your MDM to push the Endpoint Verification extension (ID: \`callobklhcbilhphinckomhgkigmfocg\`) as a force-installed extension using the \`ExtensionInstallForcelist\` policy.
2. Deploy the Endpoint Verification Native Helper application (MSI for Windows, PKG for macOS) as a required application via your MDM.
   Both components are necessary for Endpoint Verification to function. More details on EV deployment can be found under 'Deploying the Endpoint Verification native helper'.`,
}
