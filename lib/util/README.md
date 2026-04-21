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

Shared infrastructure used by the API layer and tools. Nothing here is
Chrome-specific business logic — these are cross-cutting concerns.

## Files by function

**Auth**

- `auth.js` — Primary entry point. `getAuthClient()` returns an authenticated
  client using ADC or a passed-through OAuth token. Also exports
  `oauthMiddleware` for HTTP mode and `verifyToken` / `ensureADCCredentials`
  helpers.
- `auth-error.js` — Generates descriptive error messages for auth failures
  (missing credentials, insufficient scopes, quota project not set). Detects
  `gcloud` installation and suggests fix commands.
- `google-auth-provider.js` — Production auth provider class. Wraps
  `getAuthClient` for use by real API clients.
- `fake-auth-provider.js` — Test auth provider. Redirects requests to a local
  mock server via `GOOGLE_API_ROOT_URL`.

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
- `feature_flags.js` — Simple feature flag system. Flags are enabled via
  `EXPERIMENT_` prefixed environment variables. Currently gates the delete
  tools.
