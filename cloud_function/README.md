# cloud_function

Cloud Run service that handles the Google OAuth redirect for the Chrome Enterprise Premium MCP.

After the user consents in their browser, Google redirects to this service with an authorization code. The service exchanges the code for tokens server-side (so the OAuth client secret never leaves the server), then either 302-redirects back to the user's local loopback server (same-machine flow) or renders a page with a copyable credentials JSON (headless flow). The MCP code that consumes the redirect lands in follow-up PRs tracked under #239.

This is the standalone Cloud Run service. It does not import any code from the parent repo and ships with its own `package.json`, dependencies, and tests.

## Environment variables

| Name                       | Required | Description                                                                                                        |
| -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `OAUTH_CLIENT_ID`          | yes      | Web-application OAuth client ID. Not the secret.                                                                   |
| `OAUTH_CLIENT_SECRET_NAME` | yes      | Full Secret Manager resource name, e.g. `projects/$PROJECT/secrets/cep-mcp-oauth-client-secret/versions/latest`.   |
| `REDIRECT_URI`             | yes      | The redirect URI registered on the OAuth client; must match exactly. Typically the Cloud Run URL plus `/redirect`. |
| `PORT`                     | no       | Listen port. Defaults to `8080` (Cloud Run's default).                                                             |

The client secret itself is never read from an env var. The service fetches it from Secret Manager on first request and caches it in memory for the lifetime of the revision.

## Deploy

Grant the Cloud Run service account `roles/secretmanager.secretAccessor` on the secret, then:

```sh
gcloud run deploy cep-mcp-oauth-redirect \
  --source cloud_function/ \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars OAUTH_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com \
  --set-env-vars OAUTH_CLIENT_SECRET_NAME=projects/$PROJECT/secrets/cep-mcp-oauth-client-secret/versions/latest \
  --set-env-vars REDIRECT_URI=https://your-service.example.com/redirect
```

Full setup steps live in `docs/gcp-recreation.md` (added in a follow-up PR for #239).

## Local tests

```sh
cd cloud_function
npm install
npm test
```

Tests use Node's built-in test runner and stub the token-exchange call—no network access required.

## Routes

- `GET /redirect?code=...&state=...` — the OAuth callback. `state` is a JSON string carrying `{ csrf, manual, loopback_port? }`.
- `GET /redirect?error=...` — Google's failure callback. Renders an error page; never redirects with secrets.
- `GET /` and `GET /healthz` — liveness probes.
