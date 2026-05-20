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

# Bring your own OAuth client

By default, the CLI's `auth login` subcommand uses a Google-managed Desktop OAuth client that ships with this project. You do not need to supply your own credentials to authenticate.

The command form depends on how you installed the server.

Via npx:

```bash
npx -y @google/chrome-enterprise-premium-mcp@latest auth login
```

From a local checkout after `npm install`, the `chrome-enterprise-premium-mcp` binary is on your PATH:

```bash
chrome-enterprise-premium-mcp auth login
```

The rest of this document writes the command as `auth login` for brevity. Prefix it with whichever invocation suits your setup.

Set `CEP_OAUTH_CLIENT_ID` and `CEP_OAUTH_CLIENT_SECRET` only if you want to authenticate through a Desktop OAuth client that you have created in a Google Cloud project of your own. With a custom client, the OAuth consent screen and any authorization grants are scoped to your own project rather than to the bundled one.

> [!NOTE]
> The `client_secret` of a Desktop OAuth client is a public value, not a confidential credential. Per Google's documentation for installed applications, the secret is "embedded in the source code of your application" and "is obviously not treated as a secret." Authorization is bound to the end user's Google consent and to the registered loopback redirect URI (`http://127.0.0.1`), not to the secret. The same property holds for any Desktop OAuth client you create yourself.

When you log in, the CLI writes an access token to `~/.config/cep-mcp/tokens.json` with file mode `0600`. The cache contains the access token only—no refresh token—and the access token expires after about an hour.

## Create a Desktop OAuth client

Follow these steps to create a Desktop OAuth client and copy its credentials:

1. Open the [Google Cloud console Clients page](https://console.cloud.google.com/auth/clients).
2. Click **Create client**.
3. In the **Application type** menu, select **Desktop app**.
4. In the **Name** field, enter a descriptive name.
5. Click **Create**.
6. From the **OAuth client created** dialog, copy the client ID and the client secret.

## Enable required APIs

The project that owns your OAuth client must have every Google API the server calls enabled. If an API is disabled, the first tool call against it returns `SERVICE_DISABLED`. Enable them up front so you don't hit that mid-session.

With gcloud:

```bash
gcloud services enable \
  admin.googleapis.com \
  chromemanagement.googleapis.com \
  chromepolicy.googleapis.com \
  cloudidentity.googleapis.com \
  licensing.googleapis.com \
  serviceusage.googleapis.com \
  servicemanagement.googleapis.com \
  --project=YOUR_PROJECT_ID
```

Or, from the [API Library](https://console.cloud.google.com/apis/library) in the Cloud Console, enable each of:

- Admin SDK API
- Chrome Management API
- Chrome Policy API
- Cloud Identity API
- Enterprise License Manager API
- Service Usage API
- Service Management API

> [!NOTE]
> Newly enabled APIs can take 1–5 minutes to propagate. The server retries `PERMISSION_DENIED` automatically with exponential backoff, so wait through any retry messages on first run instead of restarting.

## Sign in for the first time

Follow these steps to authenticate the CLI with the OAuth client you created:

1. Export the credentials in your shell. Replace `CLIENT_ID` and `CLIENT_SECRET` with the values you copied:

   ```bash
   export CEP_OAUTH_CLIENT_ID="CLIENT_ID"
   export CEP_OAUTH_CLIENT_SECRET="CLIENT_SECRET"
   ```

2. Run `auth login`.
3. Approve consent in the browser that the CLI opens.
4. Verify the cache by running `auth status`.

## Sign in from a host without a browser

Use this path for continuous integration runners, SSH sessions, and containers without a local browser.

Follow these steps to sign in by pasting the redirect URL from a different machine:

1. Run `auth login`. The CLI prints a consent URL to standard error.
2. Copy the consent URL.
3. Open the URL in a browser on a machine that has one, such as your laptop.
4. Approve consent on the Google consent screen.
5. Copy the full redirect URL from the browser address bar, including the `code=` parameter.
6. Paste the redirect URL at the CLI's stdin prompt.

**Note:** After approval, the browser fetches `http://127.0.0.1:<port>/?code=...` and shows "connection refused" or 404. This is expected; the loopback address points to the host running the CLI, not the host with the browser. The redirect URL with the `code=` parameter is in the address bar regardless.

## Scopes

When you log in, you'll see a consent screen requesting the full scope set the server needs (defined in `lib/constants.js`). To see which scopes the cached token actually granted, run `auth status`.

## Refresh expired tokens

The access token expires after about an hour. The cache holds no refresh token, so the next Google API call returns `401 Unauthorized`. Run `auth login` again to mint a new access token.
