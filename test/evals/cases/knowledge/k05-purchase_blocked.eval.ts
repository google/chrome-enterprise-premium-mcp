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
  id: 'k05',
  priority: 'P2',
  tags: ['iam', 'purchase'],
  requiredPatterns: ['BeyondCorp'],
  prompt: `Why can't I complete the purchase of Chrome Enterprise Premium in the Google
Cloud Console? I am a Workspace Super Admin.`,
  goldenResponse: `To purchase or manage CEP via the Cloud Console, your account needs specific Identity and Access Management (IAM) roles granted at the Google Cloud _Organization_ level. The official documentation identifies the **'Cloud BeyondCorp Admin'** role as necessary for initial purchase and setup. The **'Cloud BeyondCorp Subscription Admin'** role is also commonly required for subscription management. Workspace Super Admin permissions are not sufficient on their own for these GCP-level tasks.`,
  judgeInstructions: `The agent must correctly identify that purchasing requires Google Cloud Organization-level permissions, not just Workspace Super Admin. It must specifically mention the 'Cloud BeyondCorp Admin' or 'Cloud BeyondCorp Subscription Admin' roles.`,
}
