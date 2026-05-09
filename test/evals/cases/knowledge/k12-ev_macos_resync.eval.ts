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
  id: 'k12',
  priority: 'P2',
  tags: ['ev', 'macos'],
  requiredPatterns: ['Sync Now'],
  prompt: `After a user updates macOS, EV doesn't report the new OS immediately, blocking their access. Can we trigger a sync programmatically?`,
  goldenResponse: `No native API exists to trigger this sync via MDM post-update. The user must manually click 'Sync Now' in the EV extension toolbar to push the new OS version to the access engine.`,
}
