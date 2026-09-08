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
  id: 'k37',
  priority: 'P1',
  tags: ['gateway', 'troubleshooting', 'knowledge'],
  requiredPatterns: ['401', 're:https|443|tls'],
  prompt:
    'Users are getting a 401 Unauthorized error in Google Chrome when attempting to access an internal web application (configured on port 80) via the BeyondCorp Secure Gateway. Why is this happening and how can we resolve it?',
  goldenResponse:
    'Google Chrome and the SEB Extension require access over HTTPS on a configured TLS port (such as 443, 8443, etc.) for browser-based Secure Gateway routing. When accessing an internal application over unencrypted HTTP (such as port 80), Chrome sends direct GET requests instead of establishing a CONNECT tunnel, which results in a 401 Unauthorized error from the gateway. To resolve this, you must terminate TLS in your VPC (e.g., using an Internal Load Balancer or local server certificate) so that browser traffic is routed over HTTPS.',
}
