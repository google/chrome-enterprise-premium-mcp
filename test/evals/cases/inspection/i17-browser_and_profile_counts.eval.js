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
  id: 'i17',
  priority: 'P1',
  tags: ['inspection', 'browsers', 'profiles'],
  scenario: 'healthy',
  expectedTools: ['count_browser_versions', 'list_customer_profiles'],
  prompt:
    'Please report two metrics for my organization: 1) How many total Chrome browsers are deployed (check browser versions), and 2) How many total Chrome browser profiles are managed?',
  goldenResponse:
    'Agent should invoke count_browser_versions and list_customer_profiles and clearly report 89 total managed browsers (across 3 version buckets) and 3 managed browser profiles.',
  judgeInstructions:
    'The agent must explicitly report the total number of managed browsers (89) AND the total number of managed profiles (3). If the agent confuses the number of version buckets (3) with the total browser count, or fails to report the profile count, grade as FAIL.',
}
