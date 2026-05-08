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
  id: 'k26',
  priority: 'P2',
  tags: ['url-filtering'],
  prompt: 'How do I properly use wildcards when configuring URL filtering policies in CEP?',
  goldenResponse: `When configuring URL filtering policies in Chrome Enterprise Premium, the wildcard usage is as follows:

- \`example.com\`: This will match \`example.com\` and all its subdomains (e.g., \`www.example.com\`, \`app.example.com\`).
- \`.example.com\`: Use this syntax to match _only_ the exact domain \`example.com\` and NOT its subdomains.
- \`*\`: This acts as a general wildcard, often used for matching any URL in certain policy contexts, but should be used carefully to avoid unintended blocking or allowing.`,
}
