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
  id: 'k34',
  priority: 'P1',
  tags: ['dlp', 'actions'],
  prompt: 'What does the "Audit" action do in a DLP rule compared to "Warn" or "Block"?',
  goldenResponse: `The 'Audit only' action in a Data Loss Prevention (DLP) rule means that when the rule's conditions are met, the event is logged for administrators to review, but the end-user is not blocked or warned, and their action is not interrupted. This is useful for testing rule efficacy before full enforcement.`,
}
