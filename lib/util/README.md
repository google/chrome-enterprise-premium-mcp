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

# lib/util

Cross-cutting helpers the API layer and tools share: authentication,
logging, retry, GCP detection, CEL validation, and feature flags.

## Files by function

**Auth**

- `auth.js`: `getAuthClient(scopes, authToken)`. Three credential
  sources, in priority order:
  1. bearer header on the request,
  2. Application Default Credentials,
  3. cached OAuth token (fires only when ADC throws).

  Also exports `ensureADCCredentials()`.

- `auth-error.js`: error-message formatter for auth failures (missing
  credentials, insufficient scopes, quota project not set). Includes
  `gcloud`-installation detection and fix-command suggestions.

- `auth_messages.js`: pure formatters for the startup banner. The
  `CredentialProbe` typedef is the shared shape across credential
  factories (ADC, OAuth-flow, bearer); `buildScopesField` consumes it.

**Credential factories** (`credential/`)

- `adc.js`: `adcCredential()`. Probe sequence: ADC, then tokeninfo,
  then scope diff against the required set.

- `oauth_flow.js`: `oauthFlowCredential()`. Managed-OAuth login flow
  through `runLoginFlow()` (loopback callback or headless paste-back) and
  a probe over the cached token. Default scopes: `Object.values(SCOPES)`.

- `token_cache.js`: `TokenCache`. Read-write access on a path-injected
  file with mode 0600. Refresh tokens are stripped.

- `loopback_server.js`: random-port `127.0.0.1` HTTP server for the
  OAuth callback.

- `oauth_client_config.js`: resolves OAuth client config (managed
  bundled placeholder, BYO env vars, or future custom modes).

- `cli_commands.js`: `runAuthStatusCommand` and `runLoginCommand` for
  the `mcp auth status` and `mcp auth login` CLI subcommands.

- `jwt_verifier.js`: `verifyIdToken` plus `parseExpectedAudience`. Used
  by `mcp-server.js` middleware in HTTP mode when `CEP_BEARER_AUDIENCE`
  is set.

**API plumbing**

- `api-client.js` — Factory function that creates authenticated `googleapis`
  service clients.
- `helpers.js` — `callWithRetry()` for API calls with exponential backoff on
  `PERMISSION_DENIED`. `handleApiError()` for structured error logging and
  re-throwing.

**DLP domain constants**

- `chrome_dlp_constants.js` — Chrome DLP trigger types, action types, CEL
  grammar reference, content types, web categories, and validation constraints.
  Large reference file used by the CEL validator and tool descriptions.
- `cel_validator.js` — Offline validation of CEL conditions against the Chrome
  DLP grammar. Checks parentheses, method names, content types, trigger
  compatibility, and action parameters before submitting rules to the API.

**Infrastructure**

- `logger.js` — Leveled logger (DEBUG/INFO/WARN/ERROR). Routes all output to
  stderr in stdio mode so stdout stays clean for MCP protocol messages.
- `gcp.js` — GCP metadata server utilities. `checkGCP()` detects the runtime
  environment; `ensureApisEnabled()` checks and enables required APIs.
- `feature_flags.js` — Reads `EXPERIMENT_`-prefixed environment variables
  to enable experimental tools. Today the delete tools sit behind
  `EXPERIMENT_DELETE_TOOL_ENABLED`.
