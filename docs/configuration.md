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

You configure the server with environment variables. How you set them depends on the transport mode.

## MCP client (stdio mode)

Add the variables to the `env` block of your MCP client's settings file. The client injects them into the server's environment on startup.

```json
{
  "mcpServers": {
    "cep": {
      "command": "npx",
      "args": ["-y", "@google/chrome-enterprise-premium-mcp@latest"],
      "env": {
        "GCP_STDIO": "true"
      }
    }
  }
}
```

## Standalone (HTTP mode)

You can pass variables inline on the command line or load them from a `.env` file in your working directory. For the full set of options, see [`.env.example`](../.env.example).

```bash
PORT=8080 GCP_STDIO=false npx -y @google/chrome-enterprise-premium-mcp@latest
```

## Key variables

| Variable              | Description                                                                                                                                                                                                                                        | Default |
| :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------ |
| `GCP_STDIO`           | `true` for stdio (local), `false` for HTTP (remote).                                                                                                                                                                                               | `true`  |
| `PORT`                | Network port when `GCP_STDIO=false`.                                                                                                                                                                                                               | `0`     |
| `LOG_LEVEL`           | Verbosity. One of `error`, `warn`, `info`, `debug`.                                                                                                                                                                                                | `info`  |
| `CEP_BEARER_AUDIENCE` | When set in HTTP mode, every inbound request must carry an `Authorization: Bearer <id-token>` whose `aud` claim is in this value (comma-separated for multiple). When unset, ID-token verification is off and the server prints a startup warning. | -       |

> [!NOTE]
> When `GCP_STDIO=false` and `PORT` is unset or `0`, the server binds to a random available port. The actual port is logged at startup, for example: `Chrome Enterprise Premium MCP server listening on port X`.

## Authenticate to Google APIs

The server resolves credentials in `lib/util/auth.js#getAuthClient` and tries each source in turn:

1. **Inbound bearer token.** If the HTTP request carries an `Authorization: Bearer <token>` header, the server forwards that token to Google verbatim.

2. **Service-account key.** Otherwise, if `GOOGLE_APPLICATION_CREDENTIALS` is set, the server reads the service-account JSON key file and signs requests with a JWT. Set `CEP_IMPERSONATE_SUBJECT` to a user email to enable domain-wide delegation.

3. **Cached OAuth token.** Otherwise, the server reads the access token that `mcp auth login` cached at `~/.config/cep-mcp/tokens.json`.

Most workstation users want the OAuth flow. Most hosted deployments (Cloud Run, Vertex AI Agent Engine) want bearer pass-through. Service accounts cover the cases where neither fits.

If you're not sure which path applies to you, the [Which auth path should I use?](faq.md#which-auth-path-should-i-use) FAQ entry walks through the common deployment shapes.

| Setup                          | Transport | Credential source                           | Setup walkthrough                                                                               |
| :----------------------------- | :-------- | :------------------------------------------ | :---------------------------------------------------------------------------------------------- |
| `mcp auth login` (recommended) | stdio     | OAuth token cache                           | [`auth-bring-your-own-oauth-client.md`](auth-bring-your-own-oauth-client.md)                    |
| Bearer pass-through            | HTTP      | per-request `Authorization: Bearer <token>` | The caller sets the header; the server forwards it to Google verbatim.                          |
| Service account + DWD          | stdio     | Service account with domain-wide delegation | [FAQ entry on service accounts](faq.md#can-i-use-a-service-account-instead-of-user-credentials) |

> [!IMPORTANT]
> The HTTP-mode default has no network-layer authentication. Bind the listener to a trusted interface only, or set `CEP_BEARER_AUDIENCE` (HTTP mode only) for per-request ID-token verification.

### Inbound bearer ID-token verification (HTTP mode)

For HTTP-mode deployments behind an OAuth-bearing caller, such as Vertex AI Agent Engine, set `CEP_BEARER_AUDIENCE` to the OAuth client ID whose ID-token issuance is allowed for this server. With it set, every inbound request must carry `Authorization: Bearer <id-token>`, and the server checks the token's `aud` claim against `CEP_BEARER_AUDIENCE`. Failures return `401 Unauthorized` ahead of any forward to Google. When `CEP_BEARER_AUDIENCE` is unset, the check is off and the server prints a startup warning.
