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
  id: 'k08',
  priority: 'P1',
  tags: ['deployment'],
  prompt: 'How do I deploy the Chrome browser for my organization?',
  goldenResponse:
    'Download the Chrome Enterprise bundle (MSI, PKG, and policy templates). Deploy via SCCM, Intune, or other MDM tools, and sync management to the cloud via Chrome Enterprise Core.',
}
