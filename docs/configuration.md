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

# Configuration

The server is configured via environment variables. How you set them depends
on which transport mode you are using.

## MCP client (stdio mode)

Add variables to the `env` block of your client's settings file. The client
injects them into the server's environment on startup.

```json
{
  "mcpServers": {
    "cep": {
      "command": "npx",
      "args": ["-y", "@google/chrome-enterprise-premium-mcp@latest"],
      "env": {
        "GCP_STDIO": "true",
        "GOOGLE_CLOUD_QUOTA_PROJECT": "your-project-id"
      }
    }
  }
}
```

## Standalone (HTTP mode)

You can pass variables inline or load them from a `.env` file in your working
directory. See [`.env.example`](../.env.example) for the full set of options.

```bash
PORT=8080 GCP_STDIO=false npx -y @google/chrome-enterprise-premium-mcp@latest
```

## Key variables

| Variable                     | Description                                          | Default |
| :--------------------------- | :--------------------------------------------------- | :------ |
| `GCP_STDIO`                  | `true` for Stdio (local); `false` for HTTP (remote). | `true`  |
| `PORT`                       | Network port when `GCP_STDIO=false`.                 | `0`     |
| `GOOGLE_CLOUD_QUOTA_PROJECT` | GCP project ID for API quotas.                       | -       |
| `LOG_LEVEL`                  | Verbosity (`error`, `warn`, `info`, `debug`).        | `info`  |

> [!NOTE]
> When `GCP_STDIO=false` and `PORT` is unset or `0`, the server binds to a
> random available port. The actual port is logged at startup, e.g.
> `Chrome Enterprise Premium MCP server listening on port X`.

## Authentication

Authentication has two independent layers.

**Layer 1 — transport.** Stdio has no transport-layer auth; the OS process
boundary is the security perimeter. HTTP has no built-in transport auth; bind
it to a trusted interface (reverse proxy, VPC, localhost) and that boundary is
the access control.

**Layer 2 — Google API credentials.** Three delivery mechanisms are in scope:
ADC discovery, bearer pass-through via `Authorization: Bearer …`, and an OAuth
flow with cached tokens (proposed). Two principal types exist: EUC (end-user
credentials) and SA (service account).

### Credential matrix

| #   | Transport     | Delivery                                  | Principal | Status    |
| --- | ------------- | ----------------------------------------- | --------- | --------- |
| 1   | stdio         | ADC                                       | EUC       | Available |
| 2   | stdio         | ADC                                       | SA        | Available |
| 3   | HTTP          | ADC                                       | EUC       | Available |
| 4   | HTTP          | ADC                                       | SA        | Available |
| 5   | HTTP          | Bearer (Google access token)              | EUC or SA | Available |
| 6   | HTTP          | Bearer (OIDC ID token) + DWD on server SA | EUC       | Proposed  |
| 7   | stdio or HTTP | OAuth flow with cached tokens             | EUC       | Proposed  |

Stdio has no `Authorization` header concept, so stdio + bearer is not a valid
combination.

### Cell 1 — stdio + ADC + EUC (Quick Start path)

`gcloud auth application-default login --scopes=…`, then run the server in
stdio mode (`GCP_STDIO=true`, the default). Quick Start path.

### Cell 2 — stdio + ADC + service account

`GOOGLE_APPLICATION_CREDENTIALS=path/to/sa.json` (the SA needs domain-wide
delegation in the Workspace Admin Console), then run the server in stdio mode.

### Cell 3 — HTTP + ADC + EUC (single shared user)

`gcloud auth application-default login --scopes=…`, then run the server with
`GCP_STDIO=false`. The host's ADC user is the principal for every connecting
client.

### Cell 4 — HTTP + ADC + service account

`GOOGLE_APPLICATION_CREDENTIALS=path/to/sa.json` (or
workload-identity-equivalent on the host), then run the server with
`GCP_STDIO=false`. The SA is the principal for every connecting client.

### Cell 5 — HTTP + bearer access token

Run the server with `GCP_STDIO=false`. The client acquires a Google access
token out of band (e.g., `gcloud auth print-access-token`) and sends
`Authorization: Bearer <token>` on each MCP request. The server forwards the
token verbatim and does not verify it.

### Cell 6 — HTTP + OIDC ID token + DWD impersonation (proposed)

The Cloud Run + Gemini Enterprise topology. The client (Gemini CLI / Enterprise)
sends its standard OIDC ID token in `Authorization: Bearer …`. The server
validates the JWT, extracts the `email` claim, and uses its own service account
— configured with domain-wide delegation in the Workspace Admin Console — to
mint a user-scoped access token for that principal.

This cell is proposed and not in the published version.

### Cell 7 — OAuth flow with cached tokens (proposed)

`npx -y @google/chrome-enterprise-premium-mcp@latest login` runs the consent
flow against a Google-managed CEP OAuth client (public, loopback redirect URI)
and caches refresh and access tokens locally. Subsequent server starts use the
cached tokens. Set `CEP_OAUTH_CLIENT_ID` and `CEP_OAUTH_CLIENT_SECRET` to use
your own OAuth client instead of the bundled one.

The managed client is not yet provisioned. Until it ships, only the BYO path
works — see `docs/auth-bring-your-own-oauth-client.md`. Until the managed
client is allowlisted, leaving both env vars unset prints
`OAuth client: TODO …` in the banner and `mcp auth login` exits with a
"Managed OAuth client is not yet provisioned" error.

### Decision tree

- **stdio + one user or service account** → Cell 1 (EUC) or Cell 2 (SA).
- **HTTP + all clients share one identity** → Cell 3 (EUC) or Cell 4 (SA).
- **HTTP + per-client Google access tokens** → Cell 5.
- **HTTP + per-user identity (Gemini CLI / Enterprise)** → Cell 6 once it ships; Cell 5 until then.
- **stdio or HTTP + interactive consent, cached tokens** → Cell 7 once it ships.
