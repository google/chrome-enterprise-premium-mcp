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

Yes, you need an active Chrome Enterprise Premium license assigned to the relevant users. DLP rules, content detectors, Chrome connectors, and threat protection are all Chrome Enterprise Premium features. Without the license, most tools return permission errors. A 60-day trial is available; see the [Chrome Enterprise Premium overview](https://docs.cloud.google.com/chrome-enterprise-premium/docs/overview) for the trial and license details.

## Which Google Workspace edition do I need?

Chrome Enterprise Premium is a paid add-on available with any Google Workspace edition. Chrome Enterprise Core, which is included with Google Cloud at no additional cost, provides policy management for over 300 Chrome policies but does not include DLP, threat protection, or Context-Aware Access. For pricing details, see the [Chrome Enterprise Premium overview](https://docs.cloud.google.com/chrome-enterprise-premium/docs/overview).

## Which auth path should I use?

The right path depends on your environment.

- **Workstation (default):** Run `npx -y @google/chrome-enterprise-premium-mcp@latest auth login` (or `chrome-enterprise-premium-mcp auth login` from a local checkout). To use your own OAuth client instead of the bundled Google-managed one, see [`auth-bring-your-own-oauth-client.md`](auth-bring-your-own-oauth-client.md).
- **Hosted on Cloud Run, Vertex AI Agent Engine, or a similar managed environment:** OAuth bearer per request. The caller sets `Authorization: Bearer <id-token>`, and the server verifies the token's `aud` claim against `CEP_BEARER_AUDIENCE`.

  A service account with domain-wide delegation is the alternative: set `GOOGLE_APPLICATION_CREDENTIALS` to the key file path, and set `CEP_IMPERSONATE_SUBJECT` to the user the SA should act as.

  OAuth is preferred for hosted deployments because domain-wide delegation grants the server impersonation rights for every user in the domain, which is a much wider trust grant than per-user OAuth.

For the per-mechanism technical reference (transport, credential source, setup walkthrough), see the [authentication matrix](configuration.md#authenticate-to-google-apis) in `configuration.md`.

## Can I use a service account instead of user credentials?

Yes. The service account must have [domain-wide delegation](https://developers.google.com/identity/protocols/oauth2/service-account#delegatingauthority) configured in the Admin Console with the required scopes. Set `GOOGLE_APPLICATION_CREDENTIALS` to the path of the service account key file, and set `CEP_IMPERSONATE_SUBJECT` to the email of the user the service account should act as.

## Why do I see "Retrying in 15s..." on the first call?

Newly enabled APIs take a few minutes to propagate. The server retries `PERMISSION_DENIED` (gRPC code 7) up to seven times automatically, with a 15-second initial delay. The behavior is normal on first run and resolves within a minute or two.

## How do I enable experimental features?

Some tools, such as deletion of DLP rules and detectors, are gated behind feature flags and disabled by default. Enable them with `EXPERIMENT_`-prefixed environment variables.

```bash
EXPERIMENT_DELETE_TOOL_ENABLED=true npm start
```

For the full list of feature flags, see [`lib/util/feature_flags.js`](../lib/util/feature_flags.js).
