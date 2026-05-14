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

# Cloud Run and Gemini Enterprise deployment

For hosted deployments, OAuth is the recommended authentication path. A service account with domain-wide delegation is the alternative when OAuth is not viable; the service account setup is at the end of this page.

## Recommended: OAuth bearer per request

OAuth bearer per request has two parts.

The first part is the OAuth-handling layer. With Vertex AI Agent Engine, OAuth consent is managed for you: you register your OAuth client with Agent Engine using the redirect URI `https://vertexaisearch.cloud.google.com/oauth-redirect`. From then on, the user's access token (or ID token) is forwarded on every tool-call request to your MCP server.

The second part is inbound verification. In HTTP mode, set `CEP_BEARER_AUDIENCE` to the OAuth client ID you registered. With it set, every inbound request's `Authorization: Bearer <id-token>` is checked against that audience before any forward to Google, and failures return `401 Unauthorized`.

For the full set of HTTP-mode variables, see [`configuration.md`](configuration.md#authenticate-to-google-apis).

### Cloud Run setup sketch

```bash
gcloud run deploy cep-mcp \
  --source=. \
  --region=us-central1 \
  --no-allow-unauthenticated \
  --set-env-vars=GCP_STDIO=false,CEP_BEARER_AUDIENCE=YOUR_OAUTH_CLIENT_ID
```

Replace `YOUR_OAUTH_CLIENT_ID` with the client ID of the OAuth client you registered with Agent Engine.

Register the OAuth client with Vertex AI Agent Engine through the Agent Engine console or its CLI. The exact `create-auth` invocation lives in the Agent Engine documentation. For this MCP server, the registration needs the OAuth client ID, the OAuth client secret, Google's standard authorization and token URIs, and a scope list.

For the scope list, use the full scope set the server requests (defined in `lib/constants.js`).

A reference walkthrough of an end-to-end ADK agent on Vertex AI Agent Engine with OAuth is the third-party blog post [Powering up your agent in production with ADK, OAuth, and Gemini Enterprise](https://fmind.medium.com/powering-up-your-agent-in-production-with-adk-oauth-and-gemini-enterprise-a52b0716fcba).

## Alternative: service account with domain-wide delegation

For deployments where Agent Engine is unavailable or OAuth consent is not viable, a service account with domain-wide delegation is the alternative. The setup matches the [FAQ entry on service accounts](faq.md#can-i-use-a-service-account-instead-of-user-credentials). On Cloud Run, set `GOOGLE_APPLICATION_CREDENTIALS` to the path inside the container where the JSON key file is mounted.

> [!CAUTION]
> A service account with domain-wide delegation grants the server impersonation rights for any user in the domain for the granted scopes. The trust grant is broader than per-user OAuth. Choose the OAuth path when feasible.

## Status

The MCP server's bearer pass-through and ID-token verification are ready in this codebase. Vertex AI Agent Engine's `create-auth` API is in private preview, so production wiring depends on whether the maintainer has access. Until Agent Engine reaches general availability, the loopback OAuth flow (`mcp auth login`) is the workstation-only equivalent and is not a drop-in for hosted deployments.
