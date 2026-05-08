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
  id: 'k16',
  priority: 'P2',
  tags: ['dlp', 'copy-paste'],
  requiredPatterns: ['DLP'],
  prompt: 'How can I prevent users from copying data from company apps to personal apps like ChatGPT?',
  goldenResponse: `You can configure Data Loss Prevention (DLP) rules in the Admin Console to control copy and paste actions. Specify your company apps as the 'Source URL' and sites like ChatGPT as the destination URL or URL Category.`,
}
