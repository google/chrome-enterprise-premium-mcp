# Chrome Enterprise Premium MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server for
[Chrome Enterprise Premium](https://docs.cloud.google.com/chrome-enterprise-premium/docs/overview)
(CEP). CEP extends Chrome's built-in security with Data Loss Prevention (DLP),
real-time threat protection (phishing and malware scanning), and Context-Aware
Access controls. This server exposes CEP's DLP rules, content detectors,
connector policies, browser telemetry, and license management as MCP tools,
so any MCP-compatible AI agent can inspect and configure a Chrome Enterprise
environment.

<img width="1280" height="640" alt="c7b0d696-8488-48f9-8a11-bf8bbc72ee7e" src="https://github.com/user-attachments/assets/2665d05d-3f02-4577-8183-2972e74b02e6" />

## Quick start

```bash
git clone https://github.com/google/chrome-enterprise-premium-mcp.git
cd chrome-enterprise-premium-mcp
npm install
```

### 1. Sign in

Run `mcp auth login` and approve consent in the browser. The CLI caches
the access token at `~/.config/cep-mcp/tokens.json`.

To use a custom OAuth client in a Cloud project of your own, set
`CEP_OAUTH_CLIENT_ID` and `CEP_OAUTH_CLIENT_SECRET` and re-run
`mcp auth login`. See
[Use a custom OAuth client](docs/auth-bring-your-own-oauth-client.md).

For the paste-the-redirect flow on CI runners and SSH sessions without
a browser, see
[Sign in from a host without a browser](docs/auth-bring-your-own-oauth-client.md#sign-in-from-a-host-without-a-browser).

The scope set requested at consent maps to the underlying APIs:

| Scope                                 | API                                                                             | Used for                                                           |
| :------------------------------------ | :------------------------------------------------------------------------------ | :----------------------------------------------------------------- |
| `openid`, `userinfo.email`            | OpenID Connect                                                                  | Identifies the principal in startup banner output                  |
| `chrome.management.policy`            | [Chrome Policy](https://developers.google.com/chrome/policy)                    | Reading and writing connector policies, extension install policies |
| `chrome.management.reports.readonly`  | [Chrome Management](https://developers.google.com/chrome/management)            | Browser version counts                                             |
| `chrome.management.profiles.readonly` | [Chrome Management](https://developers.google.com/chrome/management)            | Listing managed browser profiles                                   |
| `admin.reports.audit.readonly`        | [Admin SDK Reports](https://developers.google.com/admin-sdk/reports)            | Chrome activity logs                                               |
| `admin.directory.orgunit.readonly`    | [Admin SDK Directory](https://developers.google.com/admin-sdk/directory)        | Organizational unit hierarchy                                      |
| `admin.directory.customer.readonly`   | [Admin SDK Directory](https://developers.google.com/admin-sdk/directory)        | Customer ID resolution                                             |
| `apps.licensing`                      | [Enterprise License Manager](https://developers.google.com/admin-sdk/licensing) | CEP subscription and per-user license checks                       |
| `cloud-identity.policies`             | [Cloud Identity](https://cloud.google.com/identity/docs)                        | DLP rules and content detectors (CRUD)                             |
| `service.management`                  | [Service Usage](https://cloud.google.com/service-usage/docs)                    | Checking and enabling required APIs                                |

> [!NOTE]
> If your organization restricts third-party app access, an administrator
> must
> [trust the OAuth client](docs/troubleshooting.md#configure-oauth-app-for-sensitive-scopes)
> before you can authenticate with sensitive Workspace scopes.

#### Hosted deployments

For Cloud Run, Vertex AI Agent Engine, or service-account automation, see
the
[authentication setup matrix](docs/configuration.md#authenticate-to-google-apis).

### 2. Enable required APIs (custom OAuth client or service account only)

Skip this step if you used the default Google-managed OAuth client.

For a custom OAuth client (`CEP_OAUTH_CLIENT_ID` /
`CEP_OAUTH_CLIENT_SECRET`) or a service-account key, enable these
APIs in the Cloud project that owns those credentials:

```bash
gcloud services enable \
  admin.googleapis.com \
  chromemanagement.googleapis.com \
  chromepolicy.googleapis.com \
  cloudidentity.googleapis.com \
  licensing.googleapis.com \
  serviceusage.googleapis.com \
  servicemanagement.googleapis.com
```

Or enable them from the
[API Library](https://console.cloud.google.com/apis/library) in Cloud Console.

> [!NOTE]
> Newly enabled APIs can take 1–5 minutes to become available.
> `PERMISSION_DENIED` responses are retried automatically with
> exponential backoff, so wait through any retry messages on first run
> instead of restarting.

### 3. Connect your MCP client

The server uses **stdio** transport; your MCP client launches it as a child
process. Add the config snippet for your client:

For example, add to `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "cep": {
      "command": "npx",
      "args": ["-y", "@google/chrome-enterprise-premium-mcp@latest"],
      "env": { "GCP_STDIO": "true" }
    }
  }
}
```

</details>

> [!TIP]
> If you are running from a local checkout instead of npx, replace the
> command with `node` and the args with the absolute path to
> `mcp-server.js`. Relative paths might not resolve depending on the
> client.

### 4. Verify

Restart your MCP client, then ask:

> "What Chrome Enterprise Premium tools do you have access to?"

You should see the available tools listed in the response. If they don't
appear, see [Troubleshooting](#troubleshooting) for the usual causes.

> [!CAUTION]
> **This server is an administrator-level interface to Chrome Enterprise Premium.**
> When you connect it to an MCP client, you can use natural-language prompts to:
>
> - Create, modify, and delete DLP rules and content detectors.
> - Change connector policies.
> - Force-install browser extensions onto every managed Chrome browser.
> - Enable Google Cloud APIs on your project.
>
> An attacker who plants hidden instructions in untrusted inputs—mail,
> documents, scraped pages, ticket bodies—can hijack the connected MCP
> client through [indirect prompt injection](https://en.wikipedia.org/wiki/Prompt_injection).
> The attacker can then run those tools without your consent.
>
> To reduce the blast radius:
>
> - Connect this server only to MCP clients you trust, on data sources you trust.
> - Treat every document, message, and webpage you put in front of the agent as untrusted. It might contain hidden instructions.
> - Pay extra attention to mutating tools (`create_*`, `update_*`, `delete_*`, `enable_*`); they have tenant-wide security impact.
> - Use a dedicated, least-privilege admin account when experimenting.

## Configuration

For environment variables and stdio vs. HTTP transport, see
[`docs/configuration.md`](docs/configuration.md).

## Prerequisites

| Requirement              | Details                                                                                                                                                                                                                               |
| :----------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Node.js**              | >= 18.0.0 (`node --version` to check)                                                                                                                                                                                                 |
| **Google Workspace**     | Any edition, plus a [Chrome Enterprise Premium](https://docs.cloud.google.com/chrome-enterprise-premium/docs/overview) license ([60-day free trial available](https://docs.cloud.google.com/chrome-enterprise-premium/docs/overview)) |
| **Admin role**           | Google Workspace Super Admin, or a delegated admin with Chrome Management and DLP permissions                                                                                                                                         |
| **Google Cloud project** | Linked to your Workspace domain, with required APIs enabled                                                                                                                                                                           |
| **OAuth App Trust**      | The OAuth client must be [trusted in the Admin Console](docs/troubleshooting.md#configure-oauth-app-for-sensitive-scopes) for sensitive scopes.                                                                                       |

> [!IMPORTANT]
> Chrome Management and Admin SDK APIs require a Google Workspace admin
> role in addition to Google Cloud IAM roles. You must hold an admin role
> in the [Admin Console](https://admin.google.com/) (Super Admin or
> delegated with Chrome Management permissions). With only Google Cloud
> IAM permissions, calls return `403 Permission Denied` with no indication
> that a Workspace role is missing.

## Available tools and prompts

### Prompts

| Prompt         | Description                                                                            |
| :------------- | :------------------------------------------------------------------------------------- |
| `cep:health`   | Health check of the Chrome Enterprise environment (APIs, DLP, connectors, extensions). |
| `cep:optimize` | Rule-by-rule review with tuning, enforcement, and cleanup recommendations.             |
| `cep:expert`   | Manually re-injects the expert persona and rules (useful if the agent loses context).  |

### Tools

The server exposes tools for reading and managing Chrome Enterprise resources:

- **Discovery:** get customer ID, list org units, count browser versions, list
  customer profiles
- **Licensing:** check CEP subscription status, check per-user license
  assignment
- **DLP:** list/create/delete DLP rules, list/create/delete detectors (regex,
  word list, URL list), create default rule sets
- **Connectors:** get connector policy status, enable Chrome Enterprise
  connectors
- **Extensions:** check SEB extension status, install SEB extension
- **Security:** get Chrome activity logs, check and enable required APIs
- **Knowledge:** search the built-in Chrome Enterprise Premium knowledge base

## Architecture

The codebase has three layers: API clients in `lib/api/` (one interface +
real implementation per Google API), MCP tools and prompts in `tools/` and
`prompts/`, and the server entry point in `mcp-server.js`. Integration tests
redirect the real API clients at an in-process Express fake under
`test/helpers/`. For the directory layout, design patterns, and how the test
backends are wired, see [`docs/architecture.md`](docs/architecture.md).

## Development

Run `npm run presubmit` before every PR. It runs unit tests, fake-backend
integration tests, and a smoke test against the in-process fake API server;
no credentials needed. After merge, `npm run postsubmit` re-runs the full
presubmit suite plus a real-API integration pass.

Presubmit is **read-only**. If formatting or lint fails, run
`npm run format` and `npm run lint:fix` to fix, then re-run. The husky
pre-commit hook auto-fixes staged files through lint-staged, so commits from a
clean working tree usually pass without manual fixup.

GitHub Actions runs the same checks on every pull request as four parallel
jobs (`lint`, `test-unit`, `test-integration-fake`, `test-smoke`); each
failure shows up as a separate PR check. The workflow is at
[`.github/workflows/node.js.yml`](.github/workflows/node.js.yml).

```bash
npm run presubmit               # Required before every PR
npm run postsubmit              # After merge (real API credentials)
npm run test:unit               # Unit tests only
npm run test:integration:fake   # Integration tests against the fake
npm run test:smoke              # Server starts and responds
npm run mcp-inspector           # Browser UI for invoking tools and prompts
npm run lint                    # Check formatting and lint
npm run lint -- --fix           # Auto-fix
npm run format                  # Prettier on everything
```

For evaluations (Gemini agent against fake backend, graded by deterministic
checks and an LLM judge), see [`test/evals/README.md`](test/evals/README.md).
For the test runner layout and how to add a test, see
[`test/README.md`](test/README.md). For contributing, see
[`CONTRIBUTING.md`](CONTRIBUTING.md).

## Troubleshooting

For known issues with auth, permissions, Node.js setup, and MCP client
integration (including the `/mcp` reload tip when CEP tools do not show up
right after restart), see
[`docs/troubleshooting.md`](docs/troubleshooting.md).

## FAQ

For license requirements, Workspace edition, service-account auth,
experimental features, and other recurring questions, see
[`docs/faq.md`](docs/faq.md).

## Reporting bugs

If something isn't working:

1. In Gemini CLI, run `/bug` to capture session diagnostics. Attach the
   generated file to your issue.
2. Run `npm run presubmit` and paste the output; this lets maintainers tell
   environmental problems from real code bugs.
3. Describe what you expected vs. what actually happened, including the exact
   error message.

## Contributing

Contributions are welcome. For details on how to contribute, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Legal

This repository is provided as a reference implementation that customers can explore and adapt under the Apache 2.0 license. It is not an officially supported Google product.

- **License:** [Apache License 2.0](LICENSE)
- **Terms of Service:** [Terms of Service](https://policies.google.com/terms)
- **Privacy Policy:** [Privacy Policy](https://policies.google.com/privacy)
- **Security:** [Security Policy](SECURITY.md)
