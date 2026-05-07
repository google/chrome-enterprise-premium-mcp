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

# Troubleshooting

## Authentication

### "No cached OAuth credentials" or "No Google credentials configured"

You haven't authorized the server yet. Run `mcp auth login`; a consent page opens in your browser, and on approval the access token is written to `~/.config/cep-mcp/tokens.json`.

If the file does not exist after the login flow, the consent didn't complete; check whether your browser opened a consent tab you missed.

### "Request had insufficient authentication scopes"

The cached OAuth token does not cover one or more required scopes. Re-run `mcp auth login` to re-consent with the full scope set.

Scopes can't be added to an existing token; the cache is replaced on every login.

### "API has not been used in project … before or it is disabled"

A required API is not enabled in the Google Cloud project that owns your OAuth client.

If you're using the bundled Google-managed OAuth client, you should never see this error.

If you're using a [BYO OAuth client](auth-bring-your-own-oauth-client.md), the project where you created the client must enable the same APIs the server uses. The fastest path is to call the `check_and_enable_cep_api` tool against your project, or run:

```bash
gcloud services enable admin.googleapis.com chromemanagement.googleapis.com chromepolicy.googleapis.com cloudidentity.googleapis.com licensing.googleapis.com serviceusage.googleapis.com --project=YOUR_PROJECT_ID
```

### "invalid_grant" or "Token has been revoked"

Cached credentials are stale. Common causes are a password change, an admin revoking access, MFA re-enrollment, or the access token expiring. Delete `~/.config/cep-mcp/tokens.json` and re-run `mcp auth login`.

### Configure OAuth app for sensitive scopes

This step is required because Chrome Enterprise Premium requests access to
sensitive scopes, so the OAuth app the server uses must be explicitly
allow-listed.

1.  Go to [App Access Control](https://admin.google.com/ac/owl/list?tab=configuredApps) in the Admin Console. Check that you are logged in with the right account via the upper-right account icon.
2.  Click **Configure new app** and select **OAuth App Name Or Client ID**.
3.  Search for the OAuth client ID. For the Google-managed bundled client, look up the value the CLI prints in its banner under "API credentials"; for [BYO clients](auth-bring-your-own-oauth-client.md) use your own client ID.
4.  Select the matching app from the results.
5.  Check the box for the **OAuth Client ID** and click **Select**.
6.  Select **Trusted: Can access all Google services** for Access to Google Data and click **Configure**.

## Permissions

### "The caller does not have permission" (403)

The cause is almost always one of three things.

1. **An API is not enabled.** Run the `gcloud services enable` command from the [Quick Start](../README.md#2-enable-required-apis). This is the most common cause on first setup.
2. **A Workspace admin role is missing.** Chrome Management and Admin SDK APIs require a Google Workspace admin role (Super Admin or delegated) configured in the [Admin Console](https://admin.google.com/) under **Account > Admin roles**. Google Cloud IAM roles alone are not sufficient for Workspace APIs.
3. **A Google Cloud IAM role is missing.** The user needs roles on the Google Cloud project itself, such as `roles/browser.admin` or `roles/serviceusage.serviceUsageAdmin`.

### "PERMISSION_DENIED" followed by retries

This is normal on first run. The server retries `PERMISSION_DENIED` (gRPC code 7) up to seven times with exponential backoff; the first retry waits 15 seconds. The behavior handles propagation delay after enabling APIs. If retries exhaust, the permission issue is real; check the three items in the previous section.

## Node.js

### "Cannot find module" or "ERR_MODULE_NOT_FOUND"

Dependencies are missing. Run `npm install` from the project root.

### "ExperimentalWarning: ... is an experimental feature"

These warnings are harmless. Some Node.js features used by dependencies emit warnings on older Node versions. Upgrade to Node 20 or later to suppress them, or ignore them; they do not affect functionality.

### Wrong Node version

The server requires Node 18 or later. Check with `node --version`. If you use [nvm](https://github.com/nvm-sh/nvm), run `nvm use 18` (or later) in the project directory.

When an MCP client spawns `node`, it picks up whatever is on the system PATH, which can differ from the version your shell's `nvm` selects.

## MCP client integration

### Tools do not appear in the client

Try these in order.

1. **Restart the client** after editing its config file. Most clients do not hot-reload MCP configuration.
2. **Run the client's MCP-reload command.** Some clients pick up tool registrations only after an explicit reload, even after a restart. Consult your client's documentation for the reload command.
3. **Use absolute paths.** The `args` path in your config must be absolute. Relative paths resolve from the client's working directory, which is unpredictable.
4. **Check that the client can find `node`.** Graphical-interface clients might not inherit your shell PATH. Try the full path to node, for example `"command": "/usr/local/bin/node"`. Find yours with `which node`.
5. **Test the server manually.** Run `npx -y @google/chrome-enterprise-premium-mcp@latest` in a terminal. The server prints `[mcp] Chrome Enterprise Premium MCP server stdio transport connected` on standard error. If you see errors, fix those first.

### Server starts but immediately exits

Check standard-error output. The most common causes are missing `.env` values that the server expects, or a port conflict if you ran the server in HTTP mode (`GCP_STDIO=false`) by accident.
