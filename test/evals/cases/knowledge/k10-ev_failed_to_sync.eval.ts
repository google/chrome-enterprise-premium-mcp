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
  id: 'k10',
  priority: 'P1',
  tags: ['ev', 'troubleshooting'],
  requiredPatterns: [],
  prompt: `A user sees a 'Failed to sync' error on the EV extension. We reinstalled the extension but it didn't help. Fixes?`,
  goldenResponse:
    'The issue is usually OS-level. Check for: 1) Missing EV Native Helper. 2) EDR/Antivirus blocking the Native Helper. 3) Corrupted macOS Keychain or Windows DPAPI. 4) Firewalls blocking `*.google.com`.',
}
