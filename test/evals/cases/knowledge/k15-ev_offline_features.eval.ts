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
  id: 'k15',
  priority: 'P2',
  tags: ['incognito'],
  prompt: `Do CEP security features and Endpoint Verification work when a user is in
Incognito mode?`,
  goldenResponse: `By default, extensions like Endpoint Verification are disabled in Incognito
mode. Administrators must use Chrome policies (e.g., force-enabling specific
extensions) to ensure EV and DLP protections remain active in Incognito.`,
}
