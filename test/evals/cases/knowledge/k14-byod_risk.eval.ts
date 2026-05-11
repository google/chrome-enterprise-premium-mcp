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
  id: 'k14',
  priority: 'P2',
  tags: ['byod'],
  prompt: 'Can CEP help manage risks when employees use personal (BYOD) devices?',
  goldenResponse:
    'Yes. CEP enforces policies when users sign into a managed Chrome Profile. It detects if security settings are overridden and can block access to corporate apps if the device fails compliance.',
}
