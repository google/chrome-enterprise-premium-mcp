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

# test

Tests are organized into tiers that run at different stages of the development
workflow.

## Test tiers

**`local/`** — The primary test suite (31 files). These run without network
access, using in-process fakes or pure unit logic. Covers API client wrappers,
tool behavior, CEL validation, auth, prompts, server lifecycle, and the eval
infrastructure itself. Most new tests go here.

**`unit/`** — Isolated unit tests (currently feature flags, connector
enablement). Strictly unit-level with no MCP harness or API mocking.

**`integration/`** — End-to-end tests that exercise tools through the full MCP
client/server harness. The `tools/` subdirectory contains lifecycle tests (rule
CRUD, detector CRUD, connector enablement) that run against both fake and real
API backends.

**`evals/`** — LLM-as-judge evaluation suite. Sends natural language prompts to
a Gemini-powered agent, grades responses on factual accuracy and tool usage. Has
its own [README](evals/README.md).

## Test infrastructure (`helpers/`)

- `fake-api-server.js` — Express app that simulates all five Google APIs
  in-process. Serves canned responses, tracks mutations, and resets state
  between tests.
- `integration/tools/harness.js` — Sets up a full MCP client/server pair with
  fake or real API clients. Provides `callTool()` helper for integration tests.
- `integration/tools/client_factory.js` — Creates the appropriate API client set
  (fake or real) based on `CEP_BACKEND` env var.

## Runner scripts

| Script                    | npm command                     | What it runs                               |
| :------------------------ | :------------------------------ | :----------------------------------------- |
| `run-unit.js`             | `npm run test:unit`             | `unit/` tests                              |
| `run-all.js`              | `npm test`                      | Unit + smoke                               |
| `run-integration.js`      | `npm run test:integration:fake` | Integration tests against fake backend     |
| `run-integration.js real` | `npm run test:integration:real` | Integration tests against live Google APIs |

**Composite scripts:**

- `npm run presubmit` — unit + fake integration + smoke. Run before submitting.
- `npm run postsubmit` — presubmit + real API integration. Run after merge.
- `npm run test:smoke` — Quick check that the server starts and responds.

## Adding a new test

Most new tests go in `local/`. If your test needs the full MCP harness (client ↔
server ↔ API clients), add it in `integration/tools/`. If you're testing a new
API endpoint, add the route to `helpers/fake-api-server.js` first.

Test files use Node's built-in `node:test` runner and `node:assert`. No external
test framework.
