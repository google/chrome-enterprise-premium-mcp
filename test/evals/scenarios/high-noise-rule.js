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

/**
 * @fileoverview Scenario: one DLP rule generates high event volume.
 *
 * The "Audit pastes to generative AI sites" rule fires many times,
 * producing a noisy activity log that the agent should flag.
 */

/** @param {object} state - Cloned base state. */
export function mutate(state) {
  const noisyEvents = []
  const users = ['alice@example.com', 'bob@example.com', 'carol@example.com', 'dave@example.com']
  const urls = [
    'https://chat.openai.com',
    'https://gemini.google.com',
    'https://chat.openai.com/c/abc',
    'https://gemini.google.com/app',
  ]

  // Generate 24 events for the noisy rule over 3 days
  for (let day = 1; day <= 3; day++) {
    for (let i = 0; i < 8; i++) {
      const hour = 8 + i
      noisyEvents.push({
        id: { time: `2026-04-0${day}T${String(hour).padStart(2, '0')}:00:00Z`, applicationName: 'chrome' },
        actor: { email: users[i % users.length] },
        events: [
          {
            type: 'DLP_EVENT',
            name: 'DLP_AUDIT',
            parameters: [
              { name: 'TRIGGER', value: 'WEB_CONTENT_UPLOAD' },
              { name: 'MATCHED_RULE', value: 'Audit pastes to generative AI sites' },
              { name: 'URL', value: urls[i % urls.length] },
            ],
          },
        ],
      })
    }
  }

  // Keep 1 event from the block rule for contrast
  state.activities = [state.activities[0], ...noisyEvents]
  return state
}
