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
  id: 'k20',
  priority: 'P1',
  tags: ['dlp', 'scanning'],
  requiredPatterns: ['50'],
  prompt: 'What is the size limit for deep scanning files?',
  goldenResponse:
    'The size limit for file content deep scanning (for DLP and malware) in Chrome Enterprise Premium is 50MB., files larger than this cannot be scanned. You can configure the behavior for unscannable files, including those exceeding the size limit, in the Chrome Enterprise Connector settings.',
}
