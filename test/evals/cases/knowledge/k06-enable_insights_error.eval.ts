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
  id: 'k06',
  priority: 'P2',
  tags: ['provisioning'],
  prompt: `When trying to enable Security Insights, we get an error stating 'Something went
wrong', but we have CEP licenses assigned. What is wrong?`,
  goldenResponse: `This is a provisioning and permissions issue. Enabling Security Insights requires: 1) Active CEP licenses assigned. 2) Specific administrator privileges: 'Chrome Manage User Settings', 'Chrome DLP insight setting management privileges', and 'Chrome Security Services privileges'. 3) License propagation delays (can take up to 24 hours). 4) The organization's Google Cloud billing account may not be properly linked to the Workspace instance.`,
}
