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

## Prerequisites

Before setting up the MCP server, ensure you have the following:

1.  **Node.js & npm:** Node.js version `20.0.0` or higher installed locally.
2.  **Google Workspace Account:**
    - Any Workspace edition with a [Chrome Enterprise Premium](https://docs.cloud.google.com/chrome-enterprise-premium/docs/overview) license.
    - An administrator role in the [Admin Console](https://admin.google.com/) (Super Admin or delegated with **Chrome Management** and **DLP** permissions). Standard Workspace accounts (or Google Cloud IAM permissions alone) do not grant access and will return `403 Permission Denied` errors with no indication that a Workspace role is missing.
3.  **OAuth App Trust (if required):** If your organization restricts third-party app access, a Super Admin must [trust the OAuth client](docs/troubleshooting.md#configure-oauth-app-for-sensitive-scopes) in the Admin Console before you can authenticate.
4.  **MCP Client:** A compatible MCP host application (such as Gemini CLI, Claude Desktop, Cursor, Windsurf, or VS Code).

---

### Quick start

Get up and running in less than 2 minutes using the bundled Google-managed OAuth client. No repository cloning required!

### 1. Sign in

Run the authentication CLI once before you connect your MCP client:

```bash
npx @google/chrome-enterprise-premium-mcp auth login
```

A browser tab opens on Google's consent screen. Sign in with your Google Workspace administrator account and approve the requested permissions.

Once approved, the CLI retrieves an access token and saves it securely to `~/.config/cep-mcp/tokens.json` (file mode `0600`). The MCP server reads this file on every tool call, so you only need to sign in once.

### 2. Connect your MCP client

The server uses **stdio** transport; your MCP client launches it as a child process. Depending on your client, connect the server using one of the following methods:

**If you are using the Gemini CLI**, you can install this repository directly as an extension with a single command. This automatically configures the MCP connection and loads the built-in AI guidance rules:

```bash
gemini extensions install https://github.com/google/chrome-enterprise-premium-mcp
```

**For all other MCP-compatible clients** (such as Claude Desktop, Cursor, Windsurf, or VSCode), add this configuration block to your client's settings file (e.g., `claude_desktop_config.json` or `~/.gemini/settings.json`):

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

### 3. Verify

Restart your MCP client, then ask the agent:

> "What Chrome Enterprise Premium tools do you have access to?"

You should see the available tools listed in the response. If they don't appear, see [Troubleshooting](docs/troubleshooting.md).

---

## Security & Blast Radius Warning

> [!CAUTION]
> **This server is an administrator-level interface to Chrome Enterprise Premium.**
> When you connect it to an MCP client, you can use natural-language prompts to:
>
> - **Create and modify DLP rules and content detectors.**
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
> - Pay extra attention to mutating tools (`create_*`, `update_*`, `enable_*`); they have tenant-wide security impact.
> - Use a dedicated, least-privilege admin account when experimenting.

## Workspace Scopes & Permissions

The scope set requested during the "Sign in" consent flow maps directly to the underlying Google APIs needed for the server's tools:

| Scope                                 | API                                                                             | Used for                                             |
| :------------------------------------ | :------------------------------------------------------------------------------ | :--------------------------------------------------- |
| `openid`, `userinfo.email`            | OpenID Connect                                                                  | Identifies the logged-in admin in startup output     |
| `chrome.management.policy`            | [Chrome Policy](https://developers.google.com/chrome/policy)                    | Reading and writing connector and extension policies |
| `chrome.management.reports.readonly`  | [Chrome Management](https://developers.google.com/chrome/management)            | Telemetry version counts                             |
| `chrome.management.profiles.readonly` | [Chrome Management](https://developers.google.com/chrome/management)            | Listing managed browser profiles                     |
| `admin.reports.audit.readonly`        | [Admin SDK Reports](https://developers.google.com/admin-sdk/reports)            | Fetching Chrome activity logs                        |
| `admin.directory.orgunit.readonly`    | [Admin SDK Directory](https://developers.google.com/admin-sdk/directory)        | Organizational Unit hierarchy                        |
| `admin.directory.customer.readonly`   | [Admin SDK Directory](https://developers.google.com/admin-sdk/directory)        | Customer ID resolution                               |
| `apps.licensing`                      | [Enterprise License Manager](https://developers.google.com/admin-sdk/licensing) | CEP subscription and per-user license checks         |
| `cloud-identity.policies`             | [Cloud Identity](https://cloud.google.com/identity/docs)                        | Managing DLP rules and content detectors (CRUD)      |
| `service.management`                  | [Service Usage](https://cloud.google.com/service-usage/docs)                    | Verifying and enabling required Google Cloud APIs    |

> [!NOTE]
> **OAuth App Trust Required:** If your organization restricts third-party app access, a Super Admin must [trust the OAuth client](docs/troubleshooting.md#configure-oauth-app-for-sensitive-scopes) in the Admin Console before you can authenticate.

## Advanced Authentication Options

For production environments, headless systems, or customized configurations, the server supports alternative auth pathways:

- **Custom OAuth Client:** To run under your own Google Cloud project instead of the default managed one (enabling you to manage your own consent screen and credentials), see [Use a Custom OAuth Client](docs/auth-bring-your-own-oauth-client.md).
- **Headless / SSH Sessions:** To authenticate on remote hosts or CI runners without a web browser, see [Sign In from a Host Without a Browser](docs/auth-bring-your-own-oauth-client.md#sign-in-from-a-host-without-a-browser).
- **Hosted Deployments:** For Cloud Run, Vertex AI Agent Engine, or service-account automation, see the [Authentication Setup Matrix](docs/configuration.md#authenticate-to-google-apis).

---

## Configuration

For environment variables and stdio vs. HTTP transport, see
[`docs/configuration.md`](docs/configuration.md).

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
- **DLP:** list/create DLP rules, list/create detectors (regex,
  word list, URL list), create default rule sets
- **Connectors:** get connector policy status, enable Chrome Enterprise
  connectors
- **Extensions:** check SEB extension status, install SEB extension
- **Security:** get Chrome activity logs, check and enable required APIs
- **Knowledge:** retrieve documentation from the built-in Chrome Enterprise Premium knowledge base

## Architecture

The codebase has three layers: API clients in `lib/api/` (one interface +
real implementation per Google API), MCP tools and prompts in `tools/` and
`prompts/`, and the server entry point in `mcp-server.js`. Integration tests
redirect the real API clients at an in-process Express fake under
`test/helpers/`. For the directory layout, design patterns, and how the test
backends are wired, see [`docs/architecture.md`](docs/architecture.md).

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

Contributions are welcome! For local development setup, building, testing, and contributor guidelines, please see [CONTRIBUTING.md](CONTRIBUTING.md).

## Legal

This repository is provided as a reference implementation that customers can explore and adapt under the Apache 2.0 license. It is not an officially supported Google product.

- **License:** [Apache License 2.0](LICENSE)
- **Terms of Service:** [Terms of Service](https://policies.google.com/terms)
- **Privacy Policy:** [Privacy Policy](https://policies.google.com/privacy)
- **Security:** [Security Policy](SECURITY.md)

<!-- Kokoro CI auth test comment -->
