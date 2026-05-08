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
  id: 'k23',
  priority: 'P2',
  tags: ['caa', 'troubleshooting'],
  requiredPatterns: ['401'],
  prompt: `Users are getting '401 Unauthorized' errors when accessing an internal web app via the BeyondCorp Security Gateway.`,
  goldenResponse: `A 401 Unauthorized error typically means the request lacks valid authentication credentials for the resource. When using the BeyondCorp Security Gateway, which leverages Identity-Aware Proxy (IAP), this error indicates that the user's access was likely denied by the Context-Aware Access (CAA) policies you've configured. You should review the IAP logs and your Access Level definitions. More on IAP can be found in the [Chrome Enterprise Premium documentation hub](https://cloud.google.com/beyondcorp-enterprise/docs).`,
}
