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

### "Could not load the default credentials"

Your Application Default Credentials are not configured. Run the login command from [Application Default Credentials](../README.md#application-default-credentials), then verify the credentials file exists:

```bash
cat ~/.config/gcloud/application_default_credentials.json
```

If the file does not exist, the login did not complete; check whether your browser opened a consent tab that you missed.

### "Request had insufficient authentication scopes"

The credentials lack the required scopes. The most common cause is running `gcloud auth application-default login` without the `--scopes` flag; the default scope (`cloud-platform`) does not cover Workspace APIs such as the Admin SDK or Chrome Management. You cannot add scopes to existing ADC credentials, so delete and re-create them:

```bash
rm ~/.config/gcloud/application_default_credentials.json
```

Then re-run the full login command from [Application Default Credentials](../README.md#application-default-credentials).

### "API requires a quota project, which is not set by default"

Google needs to know which project's API quotas and enablement to use. The error appears on the first API call, not at login:

```bash
gcloud auth application-default set-quota-project YOUR_PROJECT_ID
```

Replace `YOUR_PROJECT_ID` with your Google Cloud project ID. If you do not know which project to use, run `gcloud projects list` and pick the one linked to your Workspace domain.

### "invalid_grant" or "Token has been revoked"

Cached credentials are stale. Common causes are a password change, an admin revoking access, MFA re-enrollment, or the token expiring after seven days of inactivity. Delete `~/.config/gcloud/application_default_credentials.json` and re-authenticate.

### Configure OAuth app for sensitive scopes

This step is required because Chrome Enterprise Premium requests access to
sensitive scopes, so the gcloud OAuth app needs to be explicitly
allow-listed.

1.  Go to [App Access Control](https://admin.google.com/ac/owl/list?tab=configuredApps) in the Admin Console. Check that you are logged in with the right account via upper-right account icon.
2.  Click **Configure new app** and select **OAuth App Name Or Client ID**.
3.  Search for the OAuth app ID: `764086051850-6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com`.
4.  Select the **Google Cloud SDK** app from the results.
5.  Check the box for the **OAuth Client ID** and click **Select**.
6.  Select **Trusted: Can access all Google services** for Access to Google Data and click **Configure**.

### `gcloud` is installed but `gcloud auth` fails with "command not found"

Your shell can find a `gcloud` binary but the auth subcommand does not run as expected. Check that `which gcloud` points at the binary you intend, and confirm with `gcloud version` that the install is recent. If the install looks broken, reinstall the Cloud SDK from the [official installer](https://docs.cloud.google.com/sdk/docs/install).

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

The server requires Node 18 or later. Check with `node --version`. If you use [nvm](https://github.com/nvm-sh/nvm), run `nvm use 18` (or later) in the project directory. MCP clients launch `node` as a subprocess and use whatever `node` is on the system PATH, which can differ from the version your shell's `nvm` selects.

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
