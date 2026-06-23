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

# tools

MCP tool definitions. Each file in `definitions/` registers one tool with the
server. `index.js` wires each tool to its API clients and session state.

## Tool anatomy

Every tool file exports a `registerXxxTool(server, options, sessionState)`
function that calls `server.registerTool(name, schema, handler)`. We wrap
each handler with `guardedToolCall` from `utils/wrapper.js`, which:

- **Resolves customer ID automatically.** When a tool needs a `customerId`
  and the caller did not pass one, the wrapper calls `get_customer_id` and
  caches the result in session state.
- **Normalizes org unit identifiers.** The wrapper strips `id:` prefixes
  off any incoming org unit ID before forwarding it to a Google API.
- **Injects the system prompt on first call.** On the first tool call of
  a session, the wrapper appends `prompts/system-prompt.md` and
  `lib/knowledge/0-agent-capabilities.md` to the response so the agent
  picks up its grounding context.
- **Catches and formats errors.** Each error reaches the client in a
  consistent shape.
- **Records each tool call in session state** for diagnostics.

## Response format

Tools return `formatToolResponse({ summary, data, structuredContent })`:

- `summary`: human-readable markdown shown to the user.
- `data`: fenced JSON block appended to the summary for structured detail.
- `structuredContent`: machine-readable JSON in the MCP `structuredContent`
  field.

## Tool groups

| Group       | Tools                                                                                                       | API domain                   |
| :---------- | :---------------------------------------------------------------------------------------------------------- | :--------------------------- |
| Discovery   | get_customer_id, list_org_units, count_browser_versions, list_customer_profiles                             | Admin SDK, Chrome Management |
| Licensing   | check_cep_subscription, check_user_cep_license                                                              | Admin SDK (Licensing)        |
| DLP         | list_dlp_rules, get_dlp_rule, create_chrome_dlp_rule, delete_agent_dlp_rule, create_default_dlp_rules       | Cloud Identity               |
| Detectors   | list_detectors, create_regex_detector, create_url_list_detector, create_word_list_detector, delete_detector | Cloud Identity               |
| Connectors  | get_connector_policy, enable_chrome_enterprise_connectors                                                   | Chrome Policy                |
| Extensions  | check_seb_extension_status, install_seb_extension                                                           | Chrome Policy                |
| Security    | get_chrome_activity_log, check_and_enable_cep_api                                                           | Admin SDK, Service Usage     |
| Diagnostics | diagnose_environment                                                                                        | Multi-API health check       |
| Knowledge   | get_document                                                                                                | Local knowledge base         |

## Feature-gated tools

Delete tools (`delete_agent_dlp_rule`, `delete_detector`) only register when
`EXPERIMENT_DELETE_TOOL_ENABLED=true`. See `lib/util/feature_flags.js`.

## Utilities (`utils/`)

- `wrapper.js`: `guardedToolCall` and `formatToolResponse` (described in the previous sections).
- `org-unit.js`: root org unit resolution with session caching.
- `detector.js`: shared helper for the three create-detector tools.

## Shared schemas (`definitions/shared.js`)

Common Zod input/output schemas reused across tools, such as the `customerId` and `orgUnitId` fields.

## Adding a new tool

1. Create `definitions/new_tool.js` exporting
   `registerNewTool(server, options, sessionState)`.
2. Define the input schema with Zod, the output schema, and the handler wrapped
   in `guardedToolCall`.
3. Import and call the register function in `index.js`, passing the appropriate
   API clients.
4. Add a test in `test/local/`.
