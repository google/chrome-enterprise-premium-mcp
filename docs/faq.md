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

# FAQ

## Do I need a Chrome Enterprise Premium license?

Yes. DLP rules, content detectors, Chrome connectors, and threat protection
are CEP features. They require an active Chrome Enterprise Premium license
[assigned to the relevant users](https://docs.cloud.google.com/chrome-enterprise-premium/docs/overview).
Without it, most tools will return permission errors. A 60-day free trial is
available from the Admin Console or Cloud Console.

## Which Google Workspace edition do I need?

Chrome Enterprise Premium is a paid add-on available with any Google
Workspace edition. Chrome Enterprise Core (free) provides policy management
for over 300 policies but does not include DLP, threat protection, or
Context-Aware Access. See
[Chrome Enterprise Premium pricing](https://docs.cloud.google.com/chrome-enterprise-premium/docs/overview)
for current rates.

## Can I use a service account instead of user credentials?

Yes, but the service account must have
[domain-wide delegation](https://developers.google.com/identity/protocols/oauth2/service-account#delegatingauthority)
configured in the Admin Console with the required scopes. Set
`GOOGLE_APPLICATION_CREDENTIALS` to point to the key file.

## Why do I see "Retrying in 15s..." on first use?

Newly enabled APIs take a few minutes to propagate. The server retries
automatically. Normal on first run; should resolve within a minute or two.

## How do I enable experimental features?

Some tools (e.g., deletion of DLP rules and detectors) are gated behind
feature flags and disabled by default. Enable them with `EXPERIMENT_`-prefixed
environment variables:

```bash
EXPERIMENT_DELETE_TOOL_ENABLED=true npm start
```

See [`lib/util/feature_flags.js`](../lib/util/feature_flags.js) for the full
list.

## Which auth path should I use?

- One developer on a workstation, stdio MCP client → cell 1 (`gcloud auth application-default login`).
- Server-to-server automation with a service account → cell 2 (or cell 4 for HTTP), with domain-wide delegation in the Workspace Admin Console.
- Cloud Run deployment with Gemini Enterprise → cell 6 (server validates the OIDC ID token and impersonates via DWD; see [`docs/auth-cloud-run-and-gemini-enterprise.md`](auth-cloud-run-and-gemini-enterprise.md)).
- Interactive developer who wants OAuth instead of `gcloud` → cell 7 (`mcp auth login`, once the managed client ships).
- Bringing your own OAuth client → see [`docs/auth-bring-your-own-oauth-client.md`](auth-bring-your-own-oauth-client.md).
