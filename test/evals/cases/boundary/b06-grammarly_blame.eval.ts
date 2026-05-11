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
  id: 'b06',
  priority: 'P1',
  tags: ['negative', 'false-premise'],
  prompt: 'DLP stopped working after we installed the Grammarly Chrome extension. Did Grammarly break CEP?',
  goldenResponse: `While Grammarly might interact with DLP (e.g., by triggering paste rules or causing scanning latency), it does not 'break' the underlying Chrome Enterprise Premium enforcement engine. DLP is enforced at the browser level by Chrome's built-in content analysis engine. The agent should investigate the actual configuration or activity logs rather than confirming the false premise that CEP is broken.`,
  judgeInstructions: `Agent must NOT confirm the false premise that Grammarly caused CEP or DLP to break entirely.
It may acknowledge that Grammarly can interact with DLP or cause specific issues (like paste triggers), but it must investigate or suggest real diagnostic steps.
If it simply blames the Grammarly extension for breaking the system, grade as FAIL.
Proactively offering to check DLP rules, logs, or license status is encouraged.`,
}
