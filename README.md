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

The server uses **stdio** transport. Depending on your client, use one of the following configurations:

#### 🟢 Gemini CLI (Officially Supported)

You can install this repository directly as an extension. This automatically configures the connection and loads the built-in AI guidance:

```bash
gemini extensions install https://github.com/google/chrome-enterprise-premium-mcp
```

#### 🟢 Claude Desktop (Officially Supported)

Add this to your `claude_desktop_config.json`:

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

- **macOS path:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows path:** `%APPDATA%\Claude\claude_desktop_config.json`

#### 🔵 Cursor (Community Configured)

1. Go to **Settings > Models > MCP**.
2. Click **+ Add New MCP Server**.
3. Fill in:
   - **Name:** `chrome-enterprise-premium`
   - **Type:** `command`
   - **Command:** `npx -y @google/chrome-enterprise-premium-mcp@latest`

#### 🔵 VS Code (via Roo Code / Roo Cline)

Add the server configuration block to your Roo Code settings:

- **Path:** `~/Library/Application Support/Code/User/globalSettings.json` (under `roo-cline.mcpSettings`) or configure via the Roo Code UI in the Extensions tab.
- **Config:**

```json
{
  "cep": {
    "command": "npx",
    "args": ["-y", "@google/chrome-enterprise-premium-mcp@latest"],
    "env": { "GCP_STDIO": "true" }
  }
}
```

#### 🔵 Windsurf (Community Configured)

Add the configuration block to your global Windsurf MCP configuration file:

- **Path:** `~/.codeium/windsurf/mcp_config.json`
- **Config:**

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

The server requests a set of OAuth scopes to access the Google APIs required for its tools. For a detailed reference on required OAuth scopes, Google APIs, and Workspace admin privileges, see [Workspace Scopes & Permissions](docs/permissions.md).

## Advanced Authentication Options

For production environments, headless systems, or customized configurations, the server supports alternative auth pathways:

- **Custom OAuth Client:** To run under your own Google Cloud project instead of the default managed one (enabling you to manage your own consent screen and credentials), see [Use a Custom OAuth Client](docs/auth-bring-your-own-oauth-client.md).
- **Headless / SSH Sessions:** To authenticate on remote hosts or CI runners without a web browser, see [Sign In from a Host Without a Browser](docs/auth-bring-your-own-oauth-client.md#sign-in-from-a-host-without-a-browser).
- **Hosted Deployments:** For Cloud Run, Vertex AI Agent Engine, or service-account automation, see the [Authentication Setup Matrix](docs/configuration.md#authenticate-to-google-apis).

---

## Configuration

For environment variables and stdio vs. HTTP transport, see
[`docs/configuration.md`](docs/configuration.md).

## Example Prompts

Once connected, you can interact with the server using natural-language queries. Here are some examples:

### DLP Policy & Rules

- _"List all of our active DLP rules."_
- _"Create a new DLP rule named 'Block Credit Cards' that blocks uploads of files matching the credit card detector."_
- _"Delete the content detector named 'temp-phone-list'."_

### Browser Telemetry & Audits

- _"How many of our managed browsers are running outdated Chrome versions?"_
- _"Retrieve the Chrome activity logs for user admin@example.com."_
- _"Run a diagnostic check of our Chrome Enterprise environment."_

### Policy & Extensions

- _"Check the status of the Secure Enterprise Browser (SEB) extension."_
- _"Force-install the SEB extension on the '/Sales' Organizational Unit."_
- _"Enable Chrome Enterprise Connectors for malware and threat protection."_

## Available tools and prompts

### Prompts

| Prompt         | Description                                                                            |
| :------------- | :------------------------------------------------------------------------------------- |
| `cep:health`   | Health check of the Chrome Enterprise environment (APIs, DLP, connectors, extensions). |
| `cep:optimize` | Rule-by-rule review with tuning, enforcement, and cleanup recommendations.             |
| `cep:expert`   | Manually re-injects the expert persona and rules (useful if the agent loses context).  |

### Tools

The server exposes tools for inspecting and modifying Chrome Enterprise resources. Click below to view the detailed tools reference for each category:

<details>
<summary><b>DLP Policy & Detector Tools</b> (click to expand)</summary>

| Tool Name                   | Description                                       | Key Arguments                |
| :-------------------------- | :------------------------------------------------ | :--------------------------- |
| `list_dlp_rules`            | Lists all active DLP rules                        | `customerId` (optional)      |
| `get_dlp_rule`              | Retrieves a specific DLP rule by name             | `ruleName`                   |
| `create_chrome_dlp_rule`    | Creates a new DLP rule                            | `displayName`, `rules`, etc. |
| `delete_agent_dlp_rule`     | Deletes a DLP rule created by the agent           | `ruleName`                   |
| `list_detectors`            | Lists custom content detectors                    | `customerId` (optional)      |
| `create_regex_detector`     | Creates a regex-based detector                    | `displayName`, `regex`       |
| `create_word_list_detector` | Creates a word-list-based detector                | `displayName`, `words`       |
| `create_url_list_detector`  | Creates a URL-list-based detector                 | `displayName`, `urls`        |
| `delete_detector`           | Deletes a custom detector                         | `detectorName`               |
| `create_default_dlp_rules`  | Deploys a set of standard best-practice DLP rules | None                         |

</details>

<details>
<summary><b>Telemetry & Security Tools</b> (click to expand)</summary>

| Tool Name                 | Description                                 | Key Arguments                   |
| :------------------------ | :------------------------------------------ | :------------------------------ |
| `diagnose_environment`    | Runs a complete environment health check    | `summaryMode` (optional)        |
| `get_chrome_activity_log` | Retrieves Chrome security event audit logs  | `userEmail` (optional)          |
| `count_browser_versions`  | Summarizes enrolled Chrome browser versions | `customerId` (optional)         |
| `security_insights`       | Manages Chrome Security Insights enablement | `action` (check/enable/disable) |

</details>

<details>
<summary><b>Policy & Connector Tools</b> (click to expand)</summary>

| Tool Name                             | Description                                       | Key Arguments             |
| :------------------------------------ | :------------------------------------------------ | :------------------------ |
| `get_connector_policy`                | Reads current policy settings for a connector     | `connectorType`           |
| `enable_chrome_enterprise_connectors` | Configures and enables Chrome security connectors | `connectors`, `targetOus` |
| `check_seb_extension_status`          | Verifies if the SEB extension is force-installed  | `targetOu` (optional)     |
| `install_seb_extension`               | Force-installs the SEB extension                  | `targetOu` (optional)     |

</details>

<details>
<summary><b>Discovery & Licensing Tools</b> (click to expand)</summary>

| Tool Name                  | Description                                   | Key Arguments            |
| :------------------------- | :-------------------------------------------- | :----------------------- |
| `get_customer_id`          | Resolves the Google Workspace customer ID     | None                     |
| `list_org_units`           | Lists the organizational unit hierarchy       | `orgUnitPath` (optional) |
| `list_customer_profiles`   | Lists enrolled browser profiles               | `customerId` (optional)  |
| `check_cep_subscription`   | Verifies CEP license subscription status      | None                     |
| `check_user_cep_license`   | Checks license assignment for a specific user | `userEmail`              |
| `check_and_enable_cep_api` | Checks and enables required Google Cloud APIs | None                     |

</details>

<details>
<summary><b>Product Knowledge Base Tools</b> (click to expand)</summary>

| Tool Name        | Description                                        | Key Arguments        |
| :--------------- | :------------------------------------------------- | :------------------- |
| `search_content` | Performs a keyword search on CEP documentation     | `query`              |
| `get_document`   | Retrieves the full text of reference documents     | `filename` (or list) |
| `list_documents` | Lists all articles available in the knowledge base | None                 |

</details>

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
