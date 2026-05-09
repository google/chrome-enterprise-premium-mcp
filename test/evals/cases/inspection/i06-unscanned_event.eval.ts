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
  id: 'i06',
  priority: 'P1',
  tags: ['inspection'],
  fixtures: ['dlp-activities.json'],
  expectedTools: ['get_chrome_activity_log'],
  prompt: 'Have there been any recent data transfer violations or unscanned files?',
  goldenResponse: `Yes, there was a CONTENT_UNSCANNED event — a file download by alex@cep-netnew.cc
was not scanned by the DLP engine. This typically means the file was
password-protected, too large, or the download connector wasn't configured to
scan it.`,
  judgeInstructions: `The agent must identify the CONTENT_UNSCANNED event and the associated user.
Mentioning the specific filename or explaining the significance is a plus but not strictly required as long as the agent reports the unscanned event correctly.`,
}
