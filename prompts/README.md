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

# MCP Prompts

The Chrome Enterprise Premium MCP server provides a set of prompts to guide the
agent through complex diagnostic and optimization workflows.

## Structure

- `index.js` — Registers all prompts with the server.
- `definitions/` — One file per prompt, each exporting a
  `registerXxxPrompt(server)` function.
- `system-prompt.md` — The agent's behavioral instructions. It is automatically
  injected into the first tool response by `tools/utils/wrapper.js` to
  establish the agent's persona and constraints seamlessly. However, because some
  MCP clients occasionally drop context or allow the persona to fade during long
  conversations, the `cep:expert` prompt serves as a manual override. Invoking
  `cep:expert` forcefully re-injects this entire system prompt directly into the
  chat context.

## Current prompts

| Name           | File          | Description                                            |
| :------------- | :------------ | :----------------------------------------------------- |
| `cep:health`   | `health.js`   | Health check of the Chrome Enterprise environment.     |
| `cep:optimize` | `optimize.js` | Rule optimization and maturity assessment.             |
| `cep:expert`   | `expert.js`   | Loads the full expert persona from `system-prompt.md`. |

## Shared diagnostic rules (`definitions/shared.js`)

The `SHARED_DIAGNOSTIC_RULES` constant contains markdown formatting instructions
(status table format, severity tiers, tone) appended to the diagnostic prompts
(health). This keeps the output format consistent across
health-check workflows.

## Adding a new prompt

1. Create `definitions/new_prompt.js` exporting a `registerNewPrompt(server)`
   function.
2. Call `server.registerPrompt(name, schema, handler)` where the handler returns
   a `messages` array.
3. Import and call the register function in `index.js`.
