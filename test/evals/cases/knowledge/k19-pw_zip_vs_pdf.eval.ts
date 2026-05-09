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
  id: 'k19',
  priority: 'P2',
  tags: ['dlp', 'encrypted-files'],
  prompt:
    'My DLP rule blocks uploads of password-protected ZIP archives, but allows password-protected PDFs. Is this expected?',
  goldenResponse:
    'This behavior is generally expected. Detecting password protection is often more reliable for ZIP archives due to their header structure. Encrypted PDFs and Office documents can be harder to identify as password-protected without attempting to open them. CEP cannot scan the _content_ of password-protected files. However, you can choose to block all password-protected files (that can be detected) within the Chrome Enterprise Connector settings.',
}
