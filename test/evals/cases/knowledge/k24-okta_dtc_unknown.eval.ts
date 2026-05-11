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
  id: 'k24',
  priority: 'P2',
  tags: ['okta', 'device-trust'],
  prompt: `We set up the Device Trust Connector with Okta, but Okta says the device is
unmanaged. Where is the signal breaking?`,
  goldenResponse: `Device trust signals flow from Chrome through Chrome Enterprise Core to
the Device Trust Connector and then to Okta. When Okta reports a device as
unmanaged, check Google's side first (is the device enrolled in Chrome Enterprise Core and
reporting to the Admin Console?) and then Okta's side (are attribute mappings
and trust rules correctly configured?). On BYOD devices, the user may need to
consent to device signal collection.`,
}
