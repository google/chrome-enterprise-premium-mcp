# CEP MCP Server Evals

This directory contains the evaluation suite for the Chrome Enterprise Premium
MCP server. Evals verify that the AI agent -- which wraps our MCP tools and
presents them to end users -- behaves correctly: calling the right tools,
producing accurate responses, and never leaking internal implementation details.

## What evals test

Unit and integration tests (in `test/local/` and `test/integration/tools/`)
cover deterministic behavior: "call `create_chrome_dlp_rule` with these args,
get this response." Evals cover the layer above: what happens when an LLM agent
decides which tools to call and how to present results to a user.

Each eval sends a natural language prompt to a Gemini-powered agent with access
to all MCP tools. The agent decides which tools to call, executes them against a
fake API backend, and produces a response. That response is graded on two axes:

1. **Deterministic checks** -- objective, instant, no LLM involved
2. **LLM-as-judge** -- semantic quality assessment via Gemini

Both must pass for an eval to pass.

## Architecture

```text
test/evals/
  run.js              CLI entry point
  global.yaml         Global forbidden patterns + default judge rubric
  lib/
    loader.js          Parses eval .md files into structured objects
    assertions.js      Deterministic checks (forbidden/required patterns, tool validation)
    judge.js           Gemini-as-judge for semantic evaluation
    agent.js           Lightweight Gemini function-calling agent loop
    reporter.js        Console + JSON output
  cases/
    knowledge/         Factual Q&A evals (search_content tool)
    inspection/        "Check my deployment" evals (read-only tool calls)
    troubleshooting/   Diagnostic evals (multi-tool investigation)
    mutation/          Create/delete resource evals (write tool calls)
    discovery/         "List my resources" evals
```

The agent loop in `agent.js` loads the server's system prompt from
`prompts/system-prompt.md`, gets tool schemas from the MCP harness, and runs a
Gemini function-calling conversation loop until the model produces a final text
response.

## Eval file format

Each eval is a Markdown file with YAML frontmatter. Example:

```markdown
---
id: m01
category: mutation
tags: [dlp, create]
expected_tools: [list_org_units, create_chrome_dlp_rule]
forbidden_patterns:
  - "re:policies/\\w+"
  - "re:fakeOUId\\d+"
required_patterns:
  - warn
---

## Prompt

Create a DLP rule that warns users when they try to upload files containing
credit card numbers. Apply it to the root organizational unit.

## Golden Response

Agent should identify the root OU, then create a DLP rule with warn action for
file upload trigger with a content condition for credit card patterns. Should
confirm the rule was created successfully. Confirmation must not expose internal
system identifiers like policy resource names or CEL syntax.

## Judge Instructions

Verify the agent actually created the rule (tool was called), not just described
how to create one. The response must confirm the action was taken and describe
what was configured in user-friendly terms.
```

### Frontmatter fields

| Field                | Type     | Description                                                                                                          |
| -------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| `id`                 | string   | Unique identifier (e.g., `k01`, `m01`, `t03`)                                                                        |
| `category`           | string   | One of: `knowledge`, `inspection`, `troubleshooting`, `mutation`, `discovery`                                        |
| `priority`           | string   | Classification: `P0` (launch blocking - must work), `P1` (agent must not get egregiously wrong), `P2` (nice to have) |
| `stability`          | number   | A float from `0.0` to `1.0` representing the pass rate of the test over a 10-run evaluation (e.g., `0.9`).           |
| `tags`               | string[] | Freeform tags for filtering (e.g., `[dlp, create]`)                                                                  |
| `expected_tools`     | string[] | Tools the agent should call. Validated deterministically.                                                            |
| `forbidden_patterns` | string[] | Strings/regexes that must NOT appear in the response. Merged with global patterns.                                   |
| `required_patterns`  | string[] | Strings/regexes that MUST appear in the response.                                                                    |

### Markdown sections

- **`## Prompt`** -- The user message sent to the agent. This is the input.
- **`## Golden Response`** -- What a correct response looks like. The LLM judge
  compares the agent's output against this. Not a word-for-word template -- the
  judge evaluates semantic equivalence.
- **`## Judge Instructions`** (optional) -- Per-eval rubric overrides. If
  absent, the default rubric from `global.yaml` is used.

## Grading: two layers

### Layer 1: Deterministic checks

These run first, are instant, and produce binary pass/fail results with no LLM
involvement.

**Forbidden pattern matching** checks that the agent's response text does not
contain any forbidden strings. Patterns are plain substring matches by default
(case-insensitive). Prefix with `re:` for regex:

```yaml
forbidden_patterns:
  - search_content # substring match
  - "re:policies/fake\\w+" # regex match
  - "re:all_content\\.matches_" # regex match
```

Each eval's `forbidden_patterns` are merged with the global list from
`global.yaml`, so you don't need to repeat tool names in every eval file. If a
forbidden pattern appears anywhere in the response, the eval fails immediately
regardless of the judge verdict.

**Required pattern matching** is the inverse -- the response must contain these
strings. Use sparingly and only for things with a canonical form: proper nouns
(`"Chrome Enterprise Premium"`), specific numbers (`"$6"`), exact URLs
(`"chrome://policy"`). For paraphrasable concepts ("the agent should mention
audit mode is silent"), use the judge instead.

**Expected tool validation** checks that every tool listed in `expected_tools`
was actually called by the agent. This catches a common failure mode: the agent
_describes_ what it would do instead of actually doing it.

### Layer 2: LLM-as-judge (Gemini)

After deterministic checks pass, the agent's response is sent to Gemini along
with the golden response and the judge rubric. The judge returns PASS/FAIL with
a one-sentence reasoning.

The default rubric (from `global.yaml`) evaluates:

1. **Core fact coverage** -- Does the response cover the primary technical facts
   from the golden response? Proactive troubleshooting (offering to check,
   asking for clarification) counts as coverage. Additional accurate info is
   encouraged.
2. **Hallucination & contradiction** -- Incorrect diagnostic steps or denying
   that a feature exists = FAIL.
3. **Tool name leakage** -- Naming internal tools in the user-facing response =
   FAIL. (This is also caught deterministically, but the judge provides a second
   layer.)
4. **Internal identifier leakage** -- Raw policy resource names, CEL
   expressions, API schema keys, or enum values appearing in the response =
   FAIL.

Per-eval `## Judge Instructions` override or extend this rubric for cases that
need specialized evaluation (e.g., "verify the agent actually created the rule,
not just described how").

### How the layers combine

```text
deterministic FAIL + judge PASS = FAIL  (leaked internal data but gave good answer)
deterministic PASS + judge FAIL = FAIL  (clean output but wrong/incomplete answer)
deterministic PASS + judge PASS = PASS
```

Both verdicts are recorded in the output so you can see _why_ something failed.

## Forbidden patterns

The agent should present results in user-friendly terms, never exposing internal
API plumbing. The `global.yaml` file defines forbidden patterns across seven
categories:

### MCP tool names

The 23 internal tool names (`search_content`, `create_chrome_dlp_rule`, etc.)
must never appear in user-facing text. The agent should say "I checked your DLP
rules" not "I called `list_dlp_rules`."

### Chrome trigger API strings

Internal trigger identifiers like `google.workspace.chrome.file.v1.upload`. The
agent should say "file uploads", not the API string.

### Chrome policy schema names

Schema keys like `chrome.users.OnFileAttachedConnectorPolicy`. The agent should
say "Upload content analysis connector", not the schema key.

### Service provider enum values

API enum values like `SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM` or
`DEFAULT_ACTION_ALLOW`. The agent should say "Chrome Enterprise Premium" or
"allow."

### Cloud Identity setting types

Internal type identifiers like `settings/rule.dlp` or
`settings/detector.url_list`.

### API field names

Internal action keys like `blockContent`, `warnUser`, `auditOnly`,
`delayDeliveryUntilVerdict`. The agent should say "block", "warn", "audit."

### CEL expression syntax

Common Expression Language patterns like `all_content.contains(...)` or
`body.matches_word_list(...)`. These are internal condition representations that
users should never see.

Per-eval forbidden patterns (in frontmatter) add to this global list. For
mutation evals that touch the fake API, you'll typically add patterns for fake
resource IDs (`re:policies/fake\\w+`, `re:fakeOUId\\d+`).

## Eval categories

### `knowledge/` -- Factual Q&A

The agent answers a question about Chrome Enterprise Premium using the
`search_content` tool (knowledge base lookup). Graded on factual accuracy
against the golden response. No tool calls besides `search_content`.

Examples: "What is CEP?", "How much does it cost?", "How do I deploy Chrome?"

### `inspection/` -- Read-only diagnostics

The agent proactively calls read-only tools to inspect the user's environment
and report findings. Tests tool selection (did it call the right tools?) and
synthesis (did it summarize findings usefully?).

Examples: "Are my users protected?", "Run a health check", "What browser
versions are deployed?"

### `troubleshooting/` -- Multi-step investigation

The agent investigates a reported problem by calling multiple tools, correlating
findings, and producing a diagnosis. Tests reasoning across tool outputs.

Examples: "My DLP rule isn't working", "Users see scan delays", "Splunk
dashboard is empty"

### `mutation/` -- Create/delete resources

The agent makes changes: creating DLP rules, deleting detectors, etc. These
evals have the strictest forbidden evidence requirements because the agent's
confirmation message must describe what was done without leaking resource IDs,
CEL syntax, or API internals.

Examples: "Create a DLP rule that warns on credit card uploads", "Delete the
Block test123.com rule"

### `discovery/` -- List resources

The agent enumerates resources (org units, detectors, etc.) and presents them
clearly. Tests completeness and formatting.

Examples: "What's my customer ID?", "Show me all content detectors"

## Running evals

```bash
# Run all evals
node test/evals/run.js

# Run a single eval
node test/evals/run.js --id m01

# Run a category
node test/evals/run.js --category mutation

# Run by tags
node test/evals/run.js --tags dlp,create

# Multiple judge runs for consistency measurement
node test/evals/run.js --runs 3

# CI mode: JSON output + exit code
node test/evals/run.js --output eval-results.json

# Verbose: show full agent responses
node test/evals/run.js --id k01 --verbose
```

### npm scripts

```bash
npm run eval              # all evals
npm run eval:knowledge    # knowledge category only
npm run eval:agentic      # all non-knowledge categories
npm run eval:full         # 3 runs per eval, JSON output
```

### Environment variables

| Variable         | Description                                                    | Default |
| ---------------- | -------------------------------------------------------------- | ------- |
| `GEMINI_API_KEY` | **Required.** Gemini API key for both the agent and the judge. | --      |
| `CEP_BACKEND`    | `fake` (in-process mock) or `real` (live Google APIs).         | `fake`  |
| `EVAL_CATEGORY`  | Alternative to `--category` flag.                              | --      |
| `EVAL_IDS`       | Alternative to `--id` flag. Comma-separated.                   | --      |
| `EVAL_TAGS`      | Alternative to `--tags` flag. Comma-separated.                 | --      |

### Output

**Console** (default): clean summary table with per-eval pass/fail, timing, and
failure reasons. Category-level breakdown at the end.

**JSON** (`--output <path>`): structured results file with per-eval details
including deterministic check results, judge verdict + reasoning, tool calls,
response text, and timing. CI systems can parse this for reporting.

**Exit code**: 0 if all evals pass, 1 if any fail.

## Writing new evals

1. Create a `.md` file in the appropriate `cases/<category>/` directory.
2. Use the naming convention `<id>-<short-slug>.md` (e.g.,
   `m04-delete-url-detector.md`).
3. Fill in the frontmatter: `id`, `category`, `tags`, `expected_tools`.
4. Add `forbidden_patterns` if the eval touches resources with internal IDs.
5. Add `required_patterns` only for canonical strings (proper nouns, numbers).
6. Write `## Prompt` -- what the user asks.
7. Write `## Golden Response` -- what a correct answer covers.
8. Optionally write `## Judge Instructions` if the default rubric needs
   overriding.

### Tips

- Golden responses don't need to be word-for-word templates. Describe the key
  facts and behaviors the response should exhibit. The judge evaluates semantic
  equivalence, not exact match.
- For mutation evals, always add `"re:policies/\\w+"` to forbidden patterns to
  catch resource ID leaks.
- The `expected_tools` check is strict: every listed tool must be called. Don't
  list tools that the agent _might_ call -- list tools it _should_ call.
- If the eval tests a tool that modifies state, the fake server resets between
  evals so ordering doesn't matter.

## Server integration

The eval agent runs against the actual server code:

- System prompt from `prompts/system-prompt.md`
- Tool schemas from `tools/index.js` via the MCP SDK's `client.listTools()`
- Tool execution through the in-memory MCP transport
- Fake API backend in `test/helpers/fake-api-server.js` (Express, in-process)

This means evals catch regressions in the system prompt, tool descriptions, tool
implementations, and response formatting.
