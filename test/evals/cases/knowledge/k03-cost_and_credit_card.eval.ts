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
  id: 'k03',
  priority: 'P0',
  tags: ['pricing', 'billing'],
  requiredPatterns: ['$6'],
  prompt: 'How much does Chrome Enterprise Premium cost, and can I pay with a credit card?',
  goldenResponse:
    'The standard list price is $6 USD per user, per month (volume discounts may apply). CEP supports credit card payments via a self-service option in the Google Cloud Console, alongside traditional offline invoicing.',
}
