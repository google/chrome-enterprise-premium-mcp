<!--
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
-->

# prompts

MCP prompt definitions. Prompts are pre-built instruction sequences a user can
invoke (e.g., `cep:diagnose`) that return structured messages to guide the agent
through a specific workflow.

## Structure

- `index.js` — Registers all prompts with the server.
- `definitions/` — One file per prompt, each exporting a
  `registerXxxPrompt(server)` function.
- `system-prompt.md` — The agent's behavioral instructions. Not a prompt itself
  — it is injected into the first tool response by `tools/utils/wrapper.js` to
  establish the agent's persona and constraints.

## Current prompts

| Name           | File          | Description                                            |
| :------------- | :------------ | :----------------------------------------------------- |
| `cep:diagnose` | `diagnose.js` | Health check of the Chrome Enterprise environment.     |
| `cep:maturity` | `maturity.js` | DLP maturity assessment based on rule configuration.   |
| `cep:noise`    | `noise.js`    | Rule noise analysis with optimization recommendations. |
| `cep:expert`   | `expert.js`   | Loads the full expert persona from `system-prompt.md`. |
| `cep:feedback` | `feedback.js` | Generates a diagnostic feedback report.                |

## Shared diagnostic rules (`definitions/shared.js`)

The `SHARED_DIAGNOSTIC_RULES` constant contains markdown formatting instructions
(status table format, severity tiers, tone) appended to the diagnostic prompts
(diagnose, maturity, noise). This keeps the output format consistent across
health-check workflows.

## Adding a new prompt

1. Create `definitions/new_prompt.js` exporting a `registerNewPrompt(server)`
   function.
2. Call `server.registerPrompt(name, schema, handler)` where the handler returns
   a `messages` array.
3. Import and call the register function in `index.js`.
