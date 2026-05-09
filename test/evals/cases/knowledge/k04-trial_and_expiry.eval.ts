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
  id: 'k04',
  priority: 'P2',
  tags: ['trial'],
  requiredPatterns: ['60'],
  prompt: 'How do I start a trial, and what happens when it expires?',
  goldenResponse:
    'You can start a 60-day trial for up to 5,000 users. Upon expiration, you are not automatically charged. Premium features (custom DLP, CAA) immediately stop functioning, but your configuration settings are saved.',
}
