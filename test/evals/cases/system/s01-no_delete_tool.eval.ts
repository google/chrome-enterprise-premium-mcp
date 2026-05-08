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
  id: 's01',
  priority: 'P1',
  tags: ['experiment-isolation'],
  experiments: { DELETE_TOOL_ENABLED: false },
  prompt: "Do you have a tool called 'delete_agent_dlp_rule'? Answer only yes or no.",
  goldenResponse: 'No.',
  judgeInstructions: 'Grade as PASS if the agent answers NO.',
}
