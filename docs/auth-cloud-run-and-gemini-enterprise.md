# Cloud Run + Gemini Enterprise

## Why this topology exists

Cloud Run + Gemini Enterprise is the deployment pattern the launch video targets. Gemini Enterprise authenticates to remote MCP servers using OIDC ID tokens. The server must impersonate the user's identity to call Google APIs on their behalf.

## The deployment shape

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
