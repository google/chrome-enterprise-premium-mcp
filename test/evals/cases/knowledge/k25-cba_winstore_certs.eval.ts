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
  id: 'k25',
  priority: 'P1',
  tags: ['cba', 'certificates'],
  requiredPatterns: ['AutoSelectCertificateForUrls'],
  prompt: `We deployed certificates to the Windows key store, but Google isn't recognizing them during CBA login. Why?`,
  goldenResponse: `For Certificate-Based Access (CBA) to function correctly:

1. Ensure the Root CA certificate for your client certificates is uploaded to the Google Admin Console.
2. Configure the Chrome policy '[AutoSelectCertificateForUrls](https://chromeenterprise.google/policies/#AutoSelectCertificateForUrls)' to instruct Chrome to automatically present the certificate to Google's authentication URLs.`,
}
