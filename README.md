# Chrome Enterprise Premium MCP Server

A Model Context Protocol (MCP) server that provides AI agents with access to Chrome Enterprise Premium security telemetry and policies. This enables agents to perform health checks, assess DLP maturity, and analyze security events.

## Architecture

```text
/
├── lib/
│   ├── api/              # Google Cloud API clients
│   │   ├── admin_sdk.js
│   │   ├── chromemanagement.js
│   │   ├── chromepolicy.js
│   │   └── cloudidentity.js
│   ├── util/             # Shared utilities (Auth, GCP, Helpers)
│   └── constants.js      # Centralized configuration
├── prompts/              # MCP Prompt definitions
│   ├── definitions/
│   └── index.js
├── tools/
│   ├── definitions/      # Individual tool implementations
│   ├── tools.js          # Entry point for tool registration
│   └── utils.js          # Tool-specific utilities
├── test/                 # Unit and integration tests
└── mcp-server.js         # Server entry point
```

## Prerequisites

- **Node.js**: >=18.0.0
- **npm**: Installed with Node.js
- **Google Cloud Project**: With the following APIs enabled:
  - `admin.googleapis.com` (Admin SDK)
  - `chromemanagement.googleapis.com`
  - `chromepolicy.googleapis.com`
  - `cloudidentity.googleapis.com`
- **Authentication**: Google Cloud CLI (`gcloud`) authenticated with necessary scopes.

## Development Setup

**1. Install Dependencies:**

```bash
npm install
```

**2. Authenticate:**

Run the following command to set up Application Default Credentials (ADC) with the required scopes:

```bash
gcloud auth application-default login --scopes https://www.googleapis.com/auth/chrome.management.policy,https://www.googleapis.com/auth/chrome.management.reports.readonly,https://www.googleapis.com/auth/admin.reports.audit.readonly,https://www.googleapis.com/auth/admin.directory.orgunit.readonly,https://www.googleapis.com/auth/admin.directory.customer.readonly,https://www.googleapis.com/auth/cloud-identity.policies,https://www.googleapis.com/auth/cloud-platform
```

**3. Run Locally (Stdio Mode):**

```bash
npm start
```

Or use the MCP Inspector for debugging:

```bash
npm run mcp-inspector
```

**4. Run Tests:**

```bash
npm test
```

## Linting and Formatting

This project uses ESLint for linting and Prettier for code formatting.

**Check for linting errors:**

```bash
npm run lint
```

**Automatically fix fixable linting errors:**

```bash
npm run lint -- --fix
```

**Format all files in the project:**

```bash
npm run format
```

## Available Commands (Prompts)

| Command        | Description                                                                       |
| :------------- | :-------------------------------------------------------------------------------- |
| `cep`          | **Main Entry Point**. Launches the diagnostics prompt.                            |
| `cep:diagnose` | Runs a comprehensive **Health Check** of the Chrome Enterprise environment.       |
| `cep:maturity` | Assesses the **DLP Maturity** level based on rule configuration and events.       |
| `cep:noise`    | Analyzes **Rule Noise** (false positives/overrides) and recommends optimizations. |

## Environment Variables

| Variable               | Description                                      | Default        |
| :--------------------- | :----------------------------------------------- | :------------- |
| `GOOGLE_CLOUD_PROJECT` | GCP Project ID (overrides metadata server).      | `undefined`    |
| `GOOGLE_CLOUD_REGION`  | GCP Region (overrides metadata server).          | `europe-west1` |
| `GCP_STDIO`            | Force Stdio mode (`true`) or SSE mode (`false`). | Auto-detected  |
| `PORT`                 | Port for SSE/HTTP server.                        | `3000`         |

## License

Apache-2.0
