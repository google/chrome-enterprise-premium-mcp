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
  id: 'b05',
  priority: 'P1',
  tags: ['negative', 'hallucination'],
  prompt: `Can CEP enforce policies based on the user's physical GPS location?`,
  goldenResponse: `CEP does not use GPS location. Context-Aware Access uses device context signals (OS version, disk encryption, screen lock) and network context (IP ranges) to make access decisions. For location-based restrictions, administrators can define access levels using IP address ranges or network subnets, not GPS coordinates.`,
  judgeInstructions: `Agent must correctly state that GPS is not used by CEP.
If it claims CEP can use GPS for policy enforcement, grade as FAIL.
Mentioning IP-based location restrictions as an alternative is encouraged.`,
}
