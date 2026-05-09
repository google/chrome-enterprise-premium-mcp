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
  id: 'i07',
  priority: 'P2',
  tags: ['browsers', 'versions'],
  scenario: 'outdated-browser-versions',
  expectedTools: ['count_browser_versions'],
  prompt: `What Chrome browser versions are deployed across my organization? Is the fleet
up to date?`,
  goldenResponse: `Agent should report three versions across 102 devices: v120 on 87 devices, v130
on 12 devices, and v134 on 3 devices. The significant version spread (14 major
versions between oldest and newest) and the concentration on the oldest version
suggests most of the fleet has not been updated recently. The agent should flag
these older versions as outdated or legacy.`,
  judgeInstructions: `The agent must note the version distribution and highlight that most devices are
clustered on the oldest version, explicitly flagging them as outdated or legacy.
It does not need to know the absolute latest Chrome release — the version spread
itself is the signal. If the agent simply lists the versions without commenting
on the concentration or flagging them as outdated, grade as FAIL.`,
}
