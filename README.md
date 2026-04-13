# Chrome Enterprise Premium MCP Server

> [!NOTE] This is an officially supported Google product, but it is currently
> in an early stage of development. It is intended as a working example of how
> to build an MCP server that wraps Google Cloud and Workspace APIs and does
> not yet support the full range of features.

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server for
[Chrome Enterprise Premium](https://docs.cloud.google.com/chrome-enterprise-premium/docs/overview)
(CEP). CEP extends Chrome's built-in security with Data Loss Prevention (DLP),
real-time threat protection (phishing and malware scanning), and Context-Aware
Access controls. This server exposes CEP's DLP rules, content detectors,
connector policies, browser telemetry, and license management as MCP tools —
letting any MCP-compatible AI agent inspect and configure a Chrome Enterprise
environment.

The codebase also serves as a worked example of wrapping Google Workspace and
Cloud APIs in an MCP server: client abstraction with test doubles, offline CEL
validation, retry logic, structured tool output, and an evaluation harness.

## Important security consideration: Indirect Prompt Injection Risk

When exposing any language model to untrusted data, there's a risk of an
[indirect prompt injection attack](https://en.wikipedia.org/wiki/Prompt_injection).
Agentic tools like Gemini CLI, connected to MCP servers, have access to a wide
array of tools and APIs.

This MCP server grants the agent the ability to read, modify, and delete your
Google Account data, as well as other data shared with you.

- Never use this with untrusted tools
- Never include untrusted inputs into the model context. This includes asking
  Gemini CLI to process mail, documents, or other resources from unverified
  sources.
- Untrusted inputs may contain hidden instructions that could hijack your CLI
  session. Attackers can then leverage this to modify, steal, or destroy your
  data.
- Always carefully review actions taken by Gemini CLI on your behalf to ensure
  they are correct and align with your intentions.

## Quick Start

```bash
git clone <repo-url>
cd cmcp
npm install
```

### 1. Authenticate with Google Cloud

Install the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) if you
don't have it, then create
[Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials)
(ADC) with the scopes needed by each API:

```bash
gcloud auth application-default login \
  --scopes="https://www.googleapis.com/auth/chrome.management.policy,https://www.googleapis.com/auth/chrome.management.reports.readonly,https://www.googleapis.com/auth/chrome.management.profiles.readonly,https://www.googleapis.com/auth/admin.reports.audit.readonly,https://www.googleapis.com/auth/admin.directory.orgunit.readonly,https://www.googleapis.com/auth/admin.directory.customer.readonly,https://www.googleapis.com/auth/cloud-identity.policies,https://www.googleapis.com/auth/apps.licensing,https://www.googleapis.com/auth/cloud-platform"
```

These scopes map to the underlying APIs:

| Scope                                 | API                                                                             | Used for                                                       |
| :------------------------------------ | :------------------------------------------------------------------------------ | :------------------------------------------------------------- |
| `chrome.management.policy`            | [Chrome Policy](https://developers.google.com/chrome/policy)                    | Reading/writing connector policies, extension install policies |
| `chrome.management.reports.readonly`  | [Chrome Management](https://developers.google.com/chrome/management)            | Browser version counts, customer profiles                      |
| `chrome.management.profiles.readonly` | [Chrome Management](https://developers.google.com/chrome/management)            | Managed browser profiles                                       |
| `admin.reports.audit.readonly`        | [Admin SDK Reports](https://developers.google.com/admin-sdk/reports)            | Chrome activity logs                                           |
| `admin.directory.orgunit.readonly`    | [Admin SDK Directory](https://developers.google.com/admin-sdk/directory)        | Organizational unit hierarchy                                  |
| `admin.directory.customer.readonly`   | [Admin SDK Directory](https://developers.google.com/admin-sdk/directory)        | Customer ID resolution                                         |
| `cloud-identity.policies`             | [Cloud Identity](https://cloud.google.com/identity/docs)                        | DLP rules and content detectors (CRUD)                         |
| `apps.licensing`                      | [Enterprise License Manager](https://developers.google.com/admin-sdk/licensing) | CEP subscription and per-user license checks                   |
| `cloud-platform`                      | [Service Usage](https://cloud.google.com/service-usage/docs)                    | Checking and enabling required APIs                            |

Then set a quota project (identifies which GCP project's API enablement and
quotas to use):

```bash
gcloud auth application-default set-quota-project YOUR_PROJECT_ID
```

> **Scopes must be provided at login time.** You cannot add scopes to existing
> ADC credentials. If you get "insufficient scopes" errors, delete
> `~/.config/gcloud/application_default_credentials.json` and re-run the login
> command above.
>
> **No per-call charges.** These APIs are included with your Google Workspace /
> Chrome Enterprise Premium license. The quota project is for API enablement and
> rate limiting, not billing. If you skip setting it, you'll see a "quota
> project not set" error on the first API call.

### 2. Enable Required APIs

These APIs must be enabled on your GCP project:

```bash
gcloud services enable \
  admin.googleapis.com \
  chromemanagement.googleapis.com \
  chromepolicy.googleapis.com \
  cloudidentity.googleapis.com \
  licensing.googleapis.com \
  serviceusage.googleapis.com
```

Or enable them from the
[API Library](https://console.cloud.google.com/apis/library) in Cloud Console.

> **Propagation delay:** Newly enabled APIs can take 1–5 minutes to become
> available. The server handles this automatically by retrying
> `PERMISSION_DENIED` errors with exponential backoff. If you see retry messages
> on first run, wait — don't restart.

### 3. Connect Your MCP Client

The server uses **stdio** transport — your MCP client launches it as a child
process. Add the config snippet for your client:

<details>
<summary><strong>Claude Desktop</strong></summary>

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "chrome-enterprise": {
      "command": "node",
      "args": ["/absolute/path/to/cmcp/mcp-server.js"],
      "env": { "GCP_STDIO": "true" }
    }
  }
}
```

</details>

<details>
<summary><strong>Claude Code</strong></summary>

Add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "chrome-enterprise": {
      "command": "node",
      "args": ["/absolute/path/to/cmcp/mcp-server.js"],
      "env": { "GCP_STDIO": "true" }
    }
  }
}
```

</details>

<details>
<summary><strong>VS Code</strong></summary>

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "chrome-enterprise": {
      "command": "node",
      "args": ["/absolute/path/to/cmcp/mcp-server.js"],
      "env": { "GCP_STDIO": "true" }
    }
  }
}
```

</details>

<details>
<summary><strong>Gemini CLI</strong></summary>

Add to `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "chrome-enterprise": {
      "command": "node",
      "args": ["/absolute/path/to/cmcp/mcp-server.js"],
      "env": { "GCP_STDIO": "true" }
    }
  }
}
```

</details>

> Replace `/absolute/path/to/cmcp/` with the actual path where you cloned the
> repo. Relative paths may not resolve correctly depending on the client.

### 4. Verify

Restart your MCP client, then ask:

> "What Chrome Enterprise Premium tools do you have access to?"

You should see the agent discover and list the available tools. If tools don't
appear, see [Troubleshooting](#troubleshooting).

### Configuration (`.env`)

The server loads a `.env` file from the project root on startup if one exists.
Copy the example to get started:

```bash
cp .env.example .env
```

See `.env.example` for all available variables with inline documentation on how
to obtain each value. At minimum, you'll want to set
`GOOGLE_CLOUD_QUOTA_PROJECT` to avoid repeated `--set-quota-project` commands.

## Prerequisites

| Requirement          | Details                                                                                                                                                                                                                               |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Node.js**          | >= 18.0.0 (`node --version` to check)                                                                                                                                                                                                 |
| **Google Cloud CLI** | [`gcloud`](https://cloud.google.com/sdk/docs/install) installed and on your PATH (`gcloud --version` to check)                                                                                                                        |
| **Google Workspace** | Any edition, plus a [Chrome Enterprise Premium](https://docs.cloud.google.com/chrome-enterprise-premium/docs/overview) license ([60-day free trial available](https://docs.cloud.google.com/chrome-enterprise-premium/docs/overview)) |
| **Admin role**       | Google Workspace Super Admin, or a delegated admin with Chrome Management and DLP permissions                                                                                                                                         |
| **GCP project**      | Linked to your Workspace domain, with required APIs enabled                                                                                                                                                                           |

> **GCP IAM is not enough.** Chrome Management and Admin SDK APIs require a
> Google Workspace admin role _in addition to_ GCP IAM roles. The user must hold
> an admin role in the [Admin Console](https://admin.google.com/) (Super Admin
> or delegated with Chrome Management permissions). Having only GCP IAM
> permissions produces `403 Permission Denied` with no indication that a
> Workspace role is missing.

## Available Tools and Prompts

### Prompts

| Prompt         | Description                                                                            |
| :------------- | :------------------------------------------------------------------------------------- |
| `cep:diagnose` | Health check of the Chrome Enterprise environment (APIs, DLP, connectors, extensions). |
| `cep:maturity` | DLP maturity assessment based on rule configuration and events.                        |
| `cep:noise`    | Rule noise analysis (false positives/overrides) with optimization recommendations.     |
| `cep:expert`   | Loads the Chrome Enterprise Premium expert persona with full product context.          |

### Tools

The server exposes tools for reading and managing Chrome Enterprise resources:

- **Discovery** — get customer ID, list org units, count browser versions, list
  customer profiles
- **Licensing** — check CEP subscription status, check per-user license
  assignment
- **DLP** — list/create/delete DLP rules, list/create/delete detectors (regex,
  word list, URL list), create default rule sets
- **Connectors** — get connector policy status, enable Chrome Enterprise
  connectors
- **Extensions** — check SEB extension status, install SEB extension
- **Security** — get Chrome activity logs, check and enable required APIs
- **Knowledge** — search the built-in Chrome Enterprise Premium knowledge base

## Architecture

```text
/
├── lib/
│   ├── api/              # Google Cloud API clients
│   │   ├── interfaces/   # Abstract client contracts
│   │   ├── real_*.js     # Production clients (live Google APIs)
│   │   └── fake_*.js     # Test doubles (local mock server)
│   ├── util/             # Auth, retry logic, CEL validation, logging
│   └── constants.js      # Centralized configuration
├── prompts/              # MCP prompt definitions
│   ├── definitions/      # Individual prompt implementations
│   └── index.js
├── tools/
│   ├── definitions/      # Individual tool implementations
│   ├── utils/            # Tool-specific utilities
│   └── index.js          # Tool registration entry point
├── test/                 # Unit, integration, and eval tests
└── mcp-server.js         # Server entry point
```

Key design patterns:

- **Client abstraction** — each Google API has an interface (`interfaces/`), a
  real implementation (`real_*.js`), and a fake (`fake_*.js`). Tools depend on
  the interface, making them testable without live API calls.
- **Structured tool output** — tools return structured JSON with both
  machine-readable data and human-readable summaries.
- **Retry with backoff** — API calls retry on `PERMISSION_DENIED` (gRPC code 7)
  to handle eventual consistency after enabling APIs.
- **CEL validation** — DLP rule conditions are validated offline against the
  Chrome CEL grammar before submission.

## Development

### Fake vs. real backends

Tests and evals can run against two backends:

- **Fake** (default) — an in-process Express server
  (`test/helpers/fake-api-server.js`) that simulates all five Google APIs.
  Returns canned responses, tracks mutations, and resets state between tests. No
  network calls, no credentials needed.
- **Real** — calls the live Google APIs using your ADC credentials. Requires
  authentication (Step 1) and API enablement (Step 2). Used for post-merge
  validation.

The `CEP_BACKEND` environment variable controls the backend. Integration test
scripts accept `fake` or `real` as a positional argument.

### Running tests

> 🚦 **Run `npm run presubmit` before every PR.** It runs unit tests, fake
> integration tests, and a smoke test. If presubmit passes, your change is safe
> to submit.

```bash
# Before submitting (no credentials needed)
npm run presubmit

# After merge (requires real API credentials)
npm run postsubmit
```

Individual test commands:

```bash
npm run test:unit                # Unit tests (test/local/)
npm run test:integration:fake    # Integration tests (fake)
npm run test:integration:real    # Integration tests (real)
npm run test:smoke               # Server starts and responds
npm test                         # Unit + smoke
```

### Evaluations

Evals measure agent behavior end-to-end: a Gemini-powered agent calls MCP tools
against the fake backend, and responses are graded by deterministic checks and
an LLM judge. Requires `GEMINI_API_KEY`. See
[test/evals/README.md](test/evals/README.md) for the full eval framework
documentation.

```bash
npm run eval                     # All evals
npm run eval:knowledge           # Knowledge grounding only
npm run eval:agentic             # Tool use only
npm run eval:full                # 3 judge runs per eval
```

The eval runner accepts flags for filtering and tuning:

```bash
# Run a specific eval by ID
node test/evals/run.js --id m01

# Run a category
node test/evals/run.js --category mutation

# Multiple judge runs for consistency
node test/evals/run.js --runs 5

# Skip the LLM judge (deterministic checks only)
node test/evals/run.js --no-judge

# Dry run: validate eval config without Gemini
node test/evals/run.js --dry-run

# Verbose: show full agent responses
node test/evals/run.js --id k01 --verbose

# Write JSON results to a file
node test/evals/run.js --output results/eval.json
```

### Debugging

The [MCP Inspector](https://github.com/modelcontextprotocol/inspector) provides
a browser UI for invoking tools and prompts directly:

```bash
npm run mcp-inspector
```

### Linting and Formatting

```bash
npm run lint                     # Check for errors
npm run lint -- --fix            # Auto-fix
npm run format                   # Prettier
```

### HTTP Mode with OAuth

The server also supports HTTP transport with optional OAuth — useful for shared
or remote deployments where multiple users connect to a single server instance.

In this mode, the MCP client (e.g., Gemini CLI) authenticates the end user via
OAuth and passes their access token as a Bearer header. The server validates the
token and uses it directly for Google API calls — ADC is not involved.

```bash
GCP_STDIO=false npm start
```

See `.env.example` for the full set of OAuth variables and how to configure
them. The server exposes `.well-known/oauth-protected-resource` and
`.well-known/oauth-authorization-server` endpoints so clients can auto-discover
the OAuth flow.

## Troubleshooting

### Authentication

#### "Could not load the default credentials"

ADC is not configured. Run the login command from
[Step 1](#1-authenticate-with-google-cloud). Verify credentials exist afterward:

```bash
cat ~/.config/gcloud/application_default_credentials.json
```

If the file doesn't exist, login didn't complete (check for browser popup you
may have missed).

#### "Request had insufficient authentication scopes"

Credentials were created without the required scopes — usually because
`gcloud auth application-default login` was run without `--scopes`. The default
scope (`cloud-platform`) does not cover Workspace APIs like Admin SDK or Chrome
Management. You must delete and re-create credentials:

```bash
rm ~/.config/gcloud/application_default_credentials.json
```

Then re-run the full login command from
[Step 1](#1-authenticate-with-google-cloud). There is no way to add scopes to
existing ADC credentials.

#### "API requires a quota project, which is not set by default"

Google needs to know which project's API quotas and enablement to use. This
error appears on the first API call, not at login:

```bash
gcloud auth application-default set-quota-project YOUR_PROJECT_ID
```

If you're unsure which project to use, run `gcloud projects list` and pick the
one linked to your Workspace domain.

#### "invalid_grant" or "Token has been revoked"

Cached credentials are stale. Common causes: password change, admin revoked
access, MFA re-enrollment, or token expired after 7 days of inactivity. Delete
`~/.config/gcloud/application_default_credentials.json` and re-authenticate.

#### `gcloud` is installed but `gcloud auth` fails with "command not found"

Your shell can find `gcloud` but not the auth component. Run
`gcloud components install` or reinstall the Cloud SDK. On macOS with Homebrew,
`brew install google-cloud-sdk` sometimes doesn't add auth components — use the
[official installer](https://cloud.google.com/sdk/docs/install) instead.

### Permissions

#### "The caller does not have permission" (403)

This is almost always one of three things:

1. **API not enabled** — run the `gcloud services enable` command from
   [Step 2](#2-enable-required-apis). This is the most common cause on first
   setup.
2. **Missing Workspace admin role** — Chrome and Admin SDK APIs require a Google
   Workspace admin role (Super Admin or delegated) configured in the
   [Admin Console](https://admin.google.com/) > Account > Admin roles. GCP IAM
   roles alone are not sufficient for Workspace APIs.
3. **Missing GCP IAM role** — the user needs roles on the GCP project itself
   (e.g., `roles/browser.admin`, `roles/serviceusage.serviceUsageAdmin`).

#### "PERMISSION_DENIED" followed by retries

Normal on first run. The server retries `PERMISSION_DENIED` (gRPC code 7) up to
7 times with exponential backoff — the first retry waits 15 seconds. This
handles the propagation delay after enabling APIs. If retries exhaust, the
permission issue is real — check the three items above.

### Node.js

#### "Cannot find module" or "ERR_MODULE_NOT_FOUND"

Dependencies are missing. Run `npm install` from the project root.

#### "ExperimentalWarning: ... is an experimental feature"

Harmless. Some Node.js features used by dependencies emit warnings on older Node
versions. Upgrade to Node 20+ to suppress, or ignore them — they don't affect
functionality.

#### Wrong Node version

The server requires Node >= 18. Check with `node --version`. If you're using
[nvm](https://github.com/nvm-sh/nvm), make sure you've run `nvm use 18` (or
higher) in the project directory. MCP clients launch `node` as a subprocess —
they use whatever `node` is on the system PATH, which may differ from your
shell's `nvm`-managed version.

### MCP Client Integration

#### Tools don't appear in the client

1. **Restart the client** after editing its config file — most clients don't
   hot-reload MCP config.
2. **Use absolute paths** — the `args` path in your config must be absolute.
   Relative paths resolve from the client's working directory, which is
   unpredictable.
3. **Check `node` visibility** — GUI apps (Claude Desktop, VS Code) may not
   inherit your shell PATH. Try the full path to node:
   `"command": "/usr/local/bin/node"` (find yours with `which node`).
4. **Test manually** — run `node /path/to/cmcp/mcp-server.js` in a terminal. You
   should see
   `[mcp] Chrome Enterprise Premium MCP server stdio transport connected` on
   stderr. If you see errors instead, fix those first.

#### Server starts but immediately exits

Check stderr output. Common causes: missing `.env` values the server expects, or
a port conflict if accidentally running in HTTP mode (`GCP_STDIO=false`).

## FAQ

### Do I need a Chrome Enterprise Premium license?

Yes. DLP rules, content detectors, Chrome connectors, and threat protection are
CEP features — they require an active Chrome Enterprise Premium license
[assigned to the relevant users](https://docs.cloud.google.com/chrome-enterprise-premium/docs/overview).
Without it, most tools will return permission errors. A 60-day free trial is
available from the Admin Console or Cloud Console.

### Which Google Workspace edition do I need?

Chrome Enterprise Premium is a paid add-on available with any Google Workspace
edition. Chrome Enterprise Core (free) provides policy management for over 300
policies but does not include DLP, threat protection, or Context-Aware Access.
See
[Chrome Enterprise Premium pricing](https://docs.cloud.google.com/chrome-enterprise-premium/docs/overview)
for current rates.

### Can I use a service account instead of user credentials?

Yes, but the service account must have
[domain-wide delegation](https://developers.google.com/identity/protocols/oauth2/service-account#delegatingauthority)
configured in the Admin Console with the required scopes. Set
`GOOGLE_APPLICATION_CREDENTIALS` to point to the key file.

### Why do I see "Retrying in 15s..." on first use?

Newly enabled APIs take a few minutes to propagate. The server retries
automatically. This is normal on first run and should resolve within a minute or
two.

### How do I enable experimental features?

Some tools (e.g., deletion of DLP rules and detectors) are gated behind feature
flags and disabled by default. Enable them with `EXPERIMENT_` prefixed
environment variables:

```bash
EXPERIMENT_DELETE_TOOL_ENABLED=true npm start
```

See `lib/util/feature_flags.js` for the full list of available flags.

## Reporting Bugs

If something isn't working:

1. In Gemini CLI, run `/bug` to capture session diagnostics. Attach the
   generated file to your issue.
2. Run `npm run presubmit` and include the output — this helps determine whether
   the issue is environmental or a code bug.
3. Describe what you expected vs. what actually happened, including the exact
   error message.

## Contributing

Contributions are welcome! Please read the [CONTRIBUTING.md](CONTRIBUTING.md)
file for details on how to contribute to this project.

## Legal

- **License**: [Apache License 2.0](LICENSE)
- **Terms of Service**: [Terms of Service](https://policies.google.com/terms)
- **Privacy Policy**: [Privacy Policy](https://policies.google.com/privacy)
- **Security**: [Security Policy](SECURITY.md)
