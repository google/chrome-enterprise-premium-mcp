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
│   ├── utils/            # Tool-specific utilities
│   └── index.js          # Entry point for tool registration
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
# Run all tests (JS unit tests and Python tests)
npm test

# Run only JS unit tests
npm run test:local

# Run only Python tests
npm run test:python
```

**5. Smoke Test:**

Run a quick smoke test to ensure the server starts and responds correctly.

```bash
npm run smoke
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

## Git Hooks (Husky)

This project uses [Husky](https://typicode.github.io/husky/) to enforce code quality before each commit.

**The pre-commit hook automatically runs:**
1.  `npm run lint -- --fix`: Ensures all code follows the style guide and automatically fixes formatting issues.
2.  `npm run presubmit`: Runs all unit, integration (fake), and smoke tests.

If any of these steps fail, the commit will be blocked.

### Emergency Bypass

In cases where you must commit despite a failing hook (e.g., documenting a broken state or emergency hotfix), you can bypass the hooks using the `--no-verify` flag:

```bash
git commit -m "Emergency commit" --no-verify
```

## Evaluation Runners

This project includes specialized evaluation suites to measure the factual accuracy, proactive behavior, and tool utilization of the CEP agent against curated datasets.

### 1. Golden Evaluation (Grounding)

Runs the "Golden Dataset" (34 scenarios) to measure factual accuracy and knowledge retrieval. Generates a Markdown report in `eval_results_golden_evals.md`.

```bash
npm run eval:golden
```

### 2. Agentic Evaluation (Tool Use)

Runs the "Agentic Dataset" (14 scenarios) to measure correct tool selection, parameters, and multi-step mutations. Generates a Markdown report in `eval_results_agentic_evals.md`.

```bash
npm run eval:agentic
```

### 3. Full Evaluation (Redundant Judging)

Runs the golden suite and executes the LLM-as-a-Judge **3 times per evaluation** to ensure consistent results and mitigate LLM variance. Generates `eval_results_golden_evals_full.md`.

```bash
npm run eval:full
```

### 4. Custom Testing

You can override the number of judge runs using the `FULL_EVAL` environment variable or target specific tests using the `EVAL_IDS` variable:

```bash
# Run judge 5 times per eval
FULL_EVAL=5 npm run eval:golden

# Run only evals 3, 5, and 8
EVAL_IDS="3,5,8" npm run eval:golden
```

## Environment Variables

...

| Variable                     | Description                                      | Default        |
| :--------------------------- | :----------------------------------------------- | :------------- |
| `GOOGLE_CLOUD_PROJECT`       | GCP Project ID (overrides metadata server).      | `undefined`    |
| `GOOGLE_CLOUD_REGION`        | GCP Region (overrides metadata server).          | `europe-west1` |
| `GCP_STDIO`                  | Force Stdio mode (`true`) or SSE mode (`false`). | Auto-detected  |
| `PORT`                       | Port for SSE/HTTP server.                        | `3000`         |
| `OAUTH_ENABLED`              | Enable OAuth authentication for tool calls.      | `false`        |
| `GOOGLE_OAUTH_CLIENT_ID`     | OAuth 2.0 Client ID.                             | `undefined`    |
| `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth 2.0 Client Secret.                         | `undefined`    |
| `GOOGLE_OAUTH_AUDIENCE`      | Expected audience (Client ID).                   | `undefined`    |
| `GOOGLE_OAUTH_REDIRECT_URI`  | OAuth Redirect URI.                              | `undefined`    |

## Using OAuth with Gemini CLI

The CEP MCP server supports direct OAuth authentication when used with the Gemini CLI. This allows for automatic discovery of authorization endpoints and secure user-based authentication.

**1. Configure Environment Variables:**

Create a `.env` file (see `.env.example`) with your OAuth credentials:

```text
OAUTH_ENABLED=true
GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_AUDIENCE=your-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:7777/oauth/callback

# Discovery endpoints (use ${PORT} for runtime interpolation if needed)
OAUTH_PROTECTED_RESOURCE=http://localhost:3000/mcp
OAUTH_AUTHORIZATION_SERVER=http://localhost:3000/auth/google
OAUTH_AUTHORIZATION_ENDPOINT=https://accounts.google.com/o/oauth2/v2/auth
OAUTH_TOKEN_ENDPOINT=https://oauth2.googleapis.com/token
```

**2. Start the Server in HTTP Mode:**

```bash
GCP_STDIO=false npm start
```

**3. Connect via Gemini CLI:**

When you add this server to the Gemini CLI, it will automatically detect the OAuth requirements via the `.well-known` endpoints and guide you through the authentication flow in your browser.

You must also configure the client ID and secret in your `~/.gemini/settings.json` file for the corresponding server entry:

```json
{
  "mcpServers": {
    "cep": {
      "httpUrl": "http://localhost:3000/mcp",
      "oauth": {
        "enabled": true,
        "clientId": "YOUR_CLIENT_ID",
        "clientSecret": "YOUR_CLIENT_SECRET"
      }
    }
  }
}
```

## Feature Flags & Experiments

This project uses a simple feature flag system to gate experimental or dangerous tools (e.g., deletion tools).

### 1. Adding a New Flag

Add the flag name to the `FLAGS` constant in `lib/util/feature_flags.js`:

```javascript
export const FLAGS = {
  DELETE_TOOL_ENABLED: 'DELETE_TOOL_ENABLED',
  EXAMPLE_GUARDED_FEATURE: 'EXAMPLE_GUARDED_FEATURE',
}
```

### 2. Using a Flag

In `tools/index.js` (or anywhere else), use the `featureFlags` utility:

```javascript
import { featureFlags, FLAGS } from '../lib/util/feature_flags.js'

if (featureFlags.isEnabled(FLAGS.EXAMPLE_GUARDED_FEATURE)) {
  // Register experimental tool or enable logic
}
```

### 3. Enabling a Flag

Experimental flags are **opt-in** and disabled by default. Enable them via environment variables with the `EXPERIMENT_` prefix:

```bash
export EXPERIMENT_DELETE_TOOL_ENABLED=true
export EXPERIMENT_EXAMPLE_GUARDED_FEATURE=true
npm start
```

### 4. Testing Feature Flags

Every feature flag should be tested in two ways:

1.  **Unit Tests**: Verify the parsing logic in `test/unit/feature_flags.test.js`.
2.  **Isolation Tests**: Create a dedicated test file in `test/local/experiments/` to verify the behavior when the flag is toggled.

**Example Isolation Test Pattern:**

```javascript
import { featureFlags, FLAGS } from '../../../lib/util/feature_flags.js'

describe('Experiment: MY_FEATURE', () => {
  beforeEach(() => {
    process.env.EXPERIMENT_MY_FEATURE = 'true'
  })

  it('should behave correctly when enabled', () => {
    if (featureFlags.isEnabled(FLAGS.MY_FEATURE)) {
      // assert expected behavior
    }
  })
})
```

### 5. Removing a Flag (Cleanup)

Once a feature is stable (GA):

1. Remove the conditional check and make the feature code permanent.
2. Delete the flag from `lib/util/feature_flags.js`.
3. Delete any experiment-specific test files in `test/local/experiments/`.

## License

Apache-2.0
