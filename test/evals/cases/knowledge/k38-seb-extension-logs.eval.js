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
  id: 'k38',
  priority: 'P1',
  tags: ['gateway', 'troubleshooting', 'knowledge', 'seb'],
  requiredPatterns: ['re:ekajlcmdfcigmdbphhifahdfjbkciflj|options'],
  prompt:
    "Where can I find the Secure Enterprise Browser (SEB) extension logs on a user's machine to troubleshoot Secure Gateway routing issues? Are they available in Chrome Reporting Connector or Workspace log events?",
  goldenResponse:
    'SEB extension logs are NOT part of Chrome Reporting Connector or Chrome log events. Instead, client-side extension logs are located on the user\'s machine in the SEB extension options page at chrome://extensions/?options=ekajlcmdfcigmdbphhifahdfjbkciflj by navigating to the Troubleshooting section and clicking "Show Log".',
}
