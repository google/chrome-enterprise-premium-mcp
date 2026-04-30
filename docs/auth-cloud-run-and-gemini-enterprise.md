# Cloud Run + Gemini Enterprise

## Why this topology exists

Cloud Run + Gemini Enterprise is the deployment pattern the launch video targets. Gemini Enterprise authenticates to remote MCP servers using OIDC ID tokens. The server must act on behalf of the user to call Google APIs.

## Recommendation: prefer OAuth over service-account + DWD

For new Cloud Run + Gemini Enterprise deployments, prefer the **OAuth flow** over server-side service-account + DWD impersonation. SA + DWD grants the server's service account the ability to impersonate any user in the domain for the granted scopes — too broad as a default. The OAuth flow scopes are bounded to the consenting user and revocable at `myaccount.google.com`.

The reference pattern is the [ADK + OAuth + Gemini Enterprise article](https://fmind.medium.com/powering-up-your-agent-in-production-with-adk-oauth-and-gemini-enterprise-a52b0716fcba): Authorization Code flow with redirect URI `https://vertexaisearch.cloud.google.com/oauth-redirect`, consent handled by the Vertex AI Agent Engine on the user's behalf, tokens cached in agent state.

The CEP MCP server's existing OAuth flow (`mcp auth login`) ships with a loopback redirect URI (`http://127.0.0.1:<port>`), which is the right design for **local CLI use** but not for Cloud Run deployments consumed by Gemini Enterprise. A web-redirect OAuth path for the Cloud Run topology is a tracked follow-up; until it ships, the SA + DWD flow documented below is the available path.

Use SA + DWD only when OAuth is not viable: cross-org automation, headless contexts, or environments where the user cannot complete an interactive consent.

## The deployment shape (SA + DWD path)

The MCP server runs as a Cloud Run service with a service account configured for domain-wide delegation (DWD) in the Workspace Admin Console. Inbound requests from Gemini Enterprise carry an OIDC ID token in the `Authorization: Bearer ...` header. The server validates the JWT, extracts the `email` claim, and uses its service account to mint a user-scoped access token for that email via the google-auth-library's JWT class. The user-scoped token is then passed to Google APIs.

## Configuration steps

### a. Create the service account

In the Cloud Console, create a service account:

```bash
gcloud iam service-accounts create cep-mcp-sa --project=<project>
```

Note the service account's numeric Client ID (the `unique_id`). Step 3b requires this value.

### b. Configure domain-wide delegation

In the Workspace Admin Console:

1. Go to **Security** → **API Controls** → **Domain-wide Delegation**.
2. Click **Add new**.
3. Enter the service account's numeric Client ID (not the email address).
4. In the **Scopes** field, paste all scopes from `lib/constants.js#SCOPES`:

   ```
   https://www.googleapis.com/auth/userinfo.email,https://www.googleapis.com/auth/chrome.management.policy,https://www.googleapis.com/auth/chrome.management.reports.readonly,https://www.googleapis.com/auth/chrome.management.profiles.readonly,https://www.googleapis.com/auth/admin.reports.audit.readonly,https://www.googleapis.com/auth/admin.directory.orgunit.readonly,https://www.googleapis.com/auth/admin.directory.customer.readonly,https://www.googleapis.com/auth/apps.licensing,https://www.googleapis.com/auth/cloud-identity.policies,https://www.googleapis.com/auth/cloud-platform
   ```

5. Click **Authorize**.

### c. Deploy to Cloud Run

Build and push the image:

```bash
docker build -t gcr.io/<project>/cep-mcp:latest .
docker push gcr.io/<project>/cep-mcp:latest
```

Deploy to Cloud Run with the service account:

```bash
gcloud run deploy cep-mcp \
  --image=gcr.io/<project>/cep-mcp:latest \
  --service-account=cep-mcp-sa@<project>.iam.gserviceaccount.com \
  --project=<project>
```

The output includes `Service URL: https://...`. Store this URL for step 3d.

### d. Set environment variables

In the Cloud Run service configuration, set the following environment variables:

- `GCP_STDIO=false` — Run in HTTP mode.
- `GOOGLE_CLOUD_QUOTA_PROJECT=<project>` — Set the quota project for API calls.
- `CEP_OAUTH_EXPECTED_AUDIENCE=<service-url>` (optional) — Set this only if Cloud Run is fronted by a custom domain or load balancer that rewrites the Host header. Otherwise, leave unset and the server uses the `Host` header from the request.

## Failure modes the server reports

The server validates the OIDC token at request time and reports these errors:

- **JWT signature fails** — "Bearer is an OIDC ID token, but the signature does not verify against Google's public keys." The token did not come from Google or was tampered with.
- **Audience mismatch** — "ID token audience does not match this server. Verify the client is calling the correct service URL." The Cloud Run service URL does not match the `aud` claim in the token.
- **Server SA not DWD-configured** — "Server cannot impersonate the requesting user. Configure domain-wide delegation for the server's service account in the Workspace Admin Console with the scopes from lib/constants.js#SCOPES." Step 3b was skipped or incomplete.
- **Insufficient scopes in DWD** — "Domain-wide delegation does not grant scope X." An API call requires a scope that is not listed in the DWD configuration. Add the missing scope to the SA's DWD grant in the Workspace Admin Console and redeploy.

## Verification

Send a test request to the service using Gemini Enterprise's OIDC token:

```bash
gcloud auth print-identity-token --audiences=<service-url> | \
  curl -H "Authorization: Bearer $(cat)" https://<service-url>/some-mcp-endpoint
```

The server responds with real CEP data, indicating that impersonation succeeded.
