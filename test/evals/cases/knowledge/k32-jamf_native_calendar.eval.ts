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
  id: 'k32',
  priority: 'P2',
  tags: ['jamf', 'native-apps'],
  prompt: `Our Jamf BeyondCorp integration works for Chrome, but doesn't stop unmanaged devices from syncing the native macOS Calendar app.`,
  goldenResponse: `Native apps like Calendar (CalDAV) don't natively present device context. You must restrict API access using certificates or IdP device trust.`,
}
