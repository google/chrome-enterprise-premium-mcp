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
  id: 'i03',
  priority: 'P0',
  tags: ['inspection'],
  expectedTools: ['count_browser_versions'],
  requiredPatterns: ['120', '121'],
  prompt: 'What Chrome browser versions are deployed across my organization? Are any outdated?',
  goldenResponse:
    'Two versions detected: v120.0.6099.71 on 15 devices (STABLE channel) and v121.0.6167.85 on 3 devices (BETA channel). Agent should note the version distribution.',
}
