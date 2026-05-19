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

# Recreating the GCP project

> Status: this setup is documented for the upcoming WS-style hosted-redirect flow. The MCP-side changes are tracked in #239.

This guide walks through standing up the Google Cloud Platform (GCP) infrastructure that backs the hosted OAuth redirect for `chrome-enterprise-premium-mcp`. Follow it if you want to host your own redirect service instead of using the bundled one.

## Overview

The MCP uses a hybrid OAuth flow. The local client opens the consent URL and listens on a loopback port. The hosted Cloud Run service receives the consent callback, exchanges the authorization code for tokens using a client secret it loads from Secret Manager, and either 302-redirects back to the local loopback with the credentials in the query string (same-machine flow) or renders the credentials JSON on a page with a Copy button (headless flow).

The pieces are:

- **Local client**: starts the OAuth flow, holds no client secret, receives tokens either via loopback redirect or via paste-back.
- **Cloud Run service**: handles the consent callback, performs the server-side token exchange, returns credentials to the user.
- **Secret Manager**: stores the OAuth client secret. The Cloud Run service account reads it at request time.

The refresh token lands in the OS keychain on the user's machine. The access token, scope list, and expiry stay in the existing on-disk cache.

## Prerequisites

- A GCP project with billing enabled.
- The [Google Cloud CLI (gcloud)](https://cloud.google.com/sdk/docs/install), installed and authenticated against an account with project-owner or equivalent permissions.
- Node.js and npm, for deploying the Cloud Run source.

Set the project once so subsequent commands inherit it:

```bash
export PROJECT_ID="your-project-id"
export SERVICE_NAME="cep-mcp-redirect"
export REGION="us-central1"
gcloud config set project "$PROJECT_ID"
```

Enable the APIs the rest of the guide depends on:

```bash
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  iamcredentials.googleapis.com \
  --project="$PROJECT_ID"
```

## Step 1: Create the OAuth client

Create a **Web application** OAuth client in the same project that hosts the Cloud Run service. Installed-app (Desktop) clients do not accept `https://*.run.app` or vanity HTTPS redirect URIs, so the client type matters.

1. Open the [Google Cloud console Clients page](https://console.cloud.google.com/auth/clients).
2. Click **Create client**.
3. In the **Application type** menu, select **Web application**.
4. In the **Name** field, enter a descriptive name (for example, `cep-mcp-redirect`).
5. Leave **Authorized redirect URIs** empty for now. You will return to this screen after deploying the Cloud Run service to fill in the deployed URL.
6. Click **Create**.
7. From the **OAuth client created** dialog, copy the client ID and the client secret. You will need both in later steps.

## Step 2: Configure the OAuth consent screen

The consent screen lists the scopes the user is asked to approve and the user types allowed to grant them.

1. Open the [OAuth consent screen](https://console.cloud.google.com/auth/branding) for your project.
2. Choose **Internal** if every user signs in with a Google Workspace account in the same organization as the project. Choose **External** otherwise. Internal skips the verification process; external requires verification once you exceed the unverified-app user cap.
3. Add an application name, support email, and developer contact email.
4. Add the scopes the MCP requests. The current list, taken from `lib/constants.js#SCOPES`, is:
   - `openid`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/chrome.management.policy`
   - `https://www.googleapis.com/auth/chrome.management.reports.readonly`
   - `https://www.googleapis.com/auth/chrome.management.profiles.readonly`
   - `https://www.googleapis.com/auth/admin.reports.audit.readonly`
   - `https://www.googleapis.com/auth/admin.directory.orgunit.readonly`
   - `https://www.googleapis.com/auth/admin.directory.customer.readonly`
   - `https://www.googleapis.com/auth/apps.licensing`
   - `https://www.googleapis.com/auth/cloud-identity.policies`
   - `https://www.googleapis.com/auth/service.management`
5. If you chose **External** and are not yet verified, add the Google accounts that will test sign-in under **Test users**.
6. Save.

## Step 3: Store the client secret in Secret Manager

The Cloud Run service reads the client secret from Secret Manager at request time. It is never baked into the deployed image.

Create the secret and add the value you copied in Step 1:

```bash
gcloud secrets create cep-mcp-oauth-client-secret \
  --replication-policy="automatic" \
  --project="$PROJECT_ID"

printf '%s' "YOUR_CLIENT_SECRET" | gcloud secrets versions add cep-mcp-oauth-client-secret \
  --data-file=- \
  --project="$PROJECT_ID"
```

Use `printf` rather than `echo` so a trailing newline is not appended to the stored secret. A trailing newline produces an opaque `invalid_client` response from Google's token endpoint.

## Step 4: Deploy the Cloud Run service

Deploy the source under `cloud_function/` (see [`cloud_function/README.md`](../cloud_function/README.md) for the service-specific environment and runtime notes; that file lands with the Cloud Run service PR):

```bash
gcloud run deploy "$SERVICE_NAME" \
  --source=./cloud_function \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --set-env-vars="OAUTH_CLIENT_ID=YOUR_CLIENT_ID,OAUTH_CLIENT_SECRET_NAME=cep-mcp-oauth-client-secret" \
  --project="$PROJECT_ID"
```

The service must be reachable without authentication because the OAuth consent callback is unauthenticated by construction. `--allow-unauthenticated` is correct here.

Grant the runtime service account read access to the secret:

```bash
SERVICE_ACCOUNT=$(gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format='value(spec.template.spec.serviceAccountName)')

gcloud secrets add-iam-policy-binding cep-mcp-oauth-client-secret \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor" \
  --project="$PROJECT_ID"
```

Capture the deployed URL for the next step:

```bash
gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format='value(status.url)'
```

## Step 5: Register the deployed URL with the OAuth client

Return to the [Clients page](https://console.cloud.google.com/auth/clients) and open the Web-app client you created in Step 1.

1. Under **Authorized redirect URIs**, add the Cloud Run URL from Step 4, suffixed with the service's redirect path (for example, `https://cep-mcp-redirect-abc123.run.app/redirect`). If you have mapped a vanity domain, register that URL instead.
2. Save.

Google's OAuth infrastructure caches redirect-URI lists. Allow a few minutes after saving before the first sign-in attempt or you will see `redirect_uri_mismatch` even though the URI is correct.

## Step 6: Point the MCP at your deployment

Set the two environment variables the MCP uses to reach your hosted redirect:

```bash
export CEP_HOSTED_REDIRECT_URL="https://cep-mcp-redirect-abc123.run.app/redirect"
export CEP_OAUTH_CLIENT_ID="YOUR_CLIENT_ID"
```

`CEP_HOSTED_REDIRECT_URL` overrides the bundled redirect. `CEP_OAUTH_CLIENT_ID` overrides the bundled Web-app client ID. The MCP never reads the client secret on the local machine; the Cloud Run service holds it.

Run `mcp auth login` (or trigger the agent-led `cep_auth` tool) to complete a sign-in against your deployment.

## Common gotchas

**`redirect_uri_mismatch` on trailing slash.** Google compares the redirect URI character-for-character. `https://.../redirect` and `https://.../redirect/` are different values. Match what the Cloud Run service sends exactly.

**Propagation delay after editing the OAuth client.** A newly added redirect URI takes a few minutes to propagate. If the first sign-in attempt after a change fails with `redirect_uri_mismatch`, wait and retry before debugging further.

**Consent-screen user type.** If you chose **External** but did not add your own account under **Test users**, sign-in fails with "Access blocked: This app's request is invalid." Switch to **Internal**, or add the testing account.

**Keychain prompts on first sign-in.** The first time the MCP stores a refresh token, macOS Keychain and the Windows Credential Vault prompt for permission. On Linux, the user's session must have `libsecret` or `gnome-keyring` running for the keychain backend to be available. Without one, refresh tokens are not persisted and the user re-consents on access-token expiry.

## References

- [`gemini-cli-extensions/workspace/docs/GCP-RECREATION.md`](https://github.com/gemini-cli-extensions/workspace/blob/main/docs/GCP-RECREATION.md) is the reference implementation this guide mirrors.
- [`cloud_function/README.md`](../cloud_function/README.md) covers the Cloud Run service source layout and runtime configuration.
- [`docs/auth-bring-your-own-oauth-client.md`](./auth-bring-your-own-oauth-client.md) covers the simpler Desktop-client setup if you do not need a hosted redirect.
