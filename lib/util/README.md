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

- `credential/` — three credential factories sharing one contract
  (`probe()`, `getClient()`, `buildRemediation()`):
  - `adc.js` — Application Default Credentials. The boot probe runs
    tokeninfo against the access token, resolves the principal email,
    and diffs granted scopes against `lib/constants.js#SCOPES`.
  - `bearer.js` — wraps an `Authorization: Bearer …` token from an HTTP
    request. Detects access tokens vs OIDC ID tokens; ID tokens go
    through signature verification (jose, JWK set at `oauth2/v3/certs`),
    audience validation, and DWD impersonation via google-auth-library's
    `JWT` class.
  - `oauth_flow.js` — managed OAuth flow. Loopback installed-app
    consent. Access tokens are cached at
    `~/.config/cep-mcp/tokens.json` mode `0600`; refresh tokens are
    not persisted (consent uses an access-token-only grant).
    Reads `CEP_OAUTH_CLIENT_ID` / `CEP_OAUTH_CLIENT_SECRET` for BYO;
    falls back to the bundled Google-managed client.
  - `cli_commands.js` — `runAuthStatusCommand`, `runLoginCommand`.
  - `oauth_client_config.js`, `token_cache.js`, `loopback_server.js`,
    `jwt_classify.js`, `jwk_cache.js` — supporting helpers.
- `auth_messages.js` — banner-field renderers (`buildScopesField`,
  `buildAuthRemediationLines`, `buildOAuthClientField`,
  `buildQuotaProjectWarning`).
- `auth-error.js` — Google API error → human-readable message.
  Detects `gcloud` installation and suggests fix commands.
- `google-auth-provider.js` — production auth provider used by the
  real API clients.

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
