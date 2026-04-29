# Bring Your Own OAuth Client

By default, the CEP MCP server uses a bundled Google-managed OAuth client. The customer can swap in their own OAuth client for audit, brand, compliance, or scope-restriction reasons.

## Register the OAuth client

The OAuth client must be an **installed-app (Desktop) client**, not a Web client. Web clients do not allow loopback redirect URIs.

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to **APIs & Services** > **Credentials**.
3. Click **Create Credentials** > **OAuth client ID**.
4. Select **Application type: Desktop app**.
5. Click **Create**.
6. Note the **Client ID** and **Client Secret**; you will need them in the next section.

## Configure redirect URIs

The OAuth client must allow loopback redirect URIs. Add both of these to the client's **Authorized redirect URIs**:

- `http://127.0.0.1`
- `http://localhost` (optional)

## Grant scopes on the consent screen

The OAuth consent screen must include every scope that the CEP MCP server requires. In the Google Cloud Console, navigate to **APIs & Services** > **OAuth consent screen** and add these scopes:

- `EMAIL` (https://www.googleapis.com/auth/userinfo.email)
- `CHROME_MANAGEMENT_POLICY` (https://www.googleapis.com/auth/chrome.management.policy)
- `CHROME_MANAGEMENT_REPORTS_READONLY` (https://www.googleapis.com/auth/chrome.management.reports.readonly)
- `CHROME_MANAGEMENT_PROFILES_READONLY` (https://www.googleapis.com/auth/chrome.management.profiles.readonly)
- `ADMIN_REPORTS_AUDIT_READONLY` (https://www.googleapis.com/auth/admin.reports.audit.readonly)
- `ADMIN_DIRECTORY_ORGUNIT_READONLY` (https://www.googleapis.com/auth/admin.directory.orgunit.readonly)
- `ADMIN_DIRECTORY_CUSTOMER_READONLY` (https://www.googleapis.com/auth/admin.directory.customer.readonly)
- `LICENSING` (https://www.googleapis.com/auth/apps.licensing)
- `CLOUD_IDENTITY_POLICIES` (https://www.googleapis.com/auth/cloud-identity.policies)
- `CLOUD_PLATFORM` (https://www.googleapis.com/auth/cloud-platform)

## Brand verification for restricted scopes

Admin SDK Directory and Reports are restricted scopes. The OAuth consent screen must pass [Google brand verification](https://support.google.com/cloud/answer/13463073) before non-internal users can consent. If the organization has not passed brand verification, only users with project owner or editor roles can complete the consent flow.

## Set environment variables

The server reads the custom OAuth client from the `CEP_OAUTH_CLIENT_ID` and `CEP_OAUTH_CLIENT_SECRET` environment variables. **Both must be set.** If only one is set, the server exits with a fatal error.

```bash
export CEP_OAUTH_CLIENT_ID="<client-id>"
export CEP_OAUTH_CLIENT_SECRET="<client-secret>"
```

If both variables are unset, the server uses the bundled Google-managed client.

## Authenticate with the custom client

Run `mcp auth login` to authenticate against the custom client. The command opens your browser to the Google consent screen. Grant consent; the server caches your refresh and access tokens locally.

Subsequent server starts use the cached tokens. Run `mcp auth login` again if the tokens are revoked or scopes change.
