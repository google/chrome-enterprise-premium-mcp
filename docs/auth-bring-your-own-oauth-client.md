# Bring Your Own OAuth Client

The CEP MCP server will eventually ship with a bundled Google-managed OAuth client. Until that managed client is published and allowlisted, **bring-your-own (BYO) is the only way to use the `mcp auth login` flow**. After the managed client ships, BYO remains supported for customers who need it for audit, brand, compliance, or scope-restriction reasons.

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

If both variables are unset and the bundled managed client has not yet been provisioned, the server prints `OAuth client: TODO …` in the boot banner and `mcp auth login` exits with a clear "Managed OAuth client is not yet provisioned" error. Once the managed client ships, leaving both env vars unset selects it.

## Authenticate with the custom client

Run `mcp auth login` to authenticate against the custom client. The command opens your browser to the Google consent screen. After you grant consent, your access token is cached locally. Refresh tokens are not persisted; the server uses an access-token-only grant because the requested scopes are sensitive.

Once the cached token has expired, run `mcp auth login` again. Run it again whenever scopes change or the token has been revoked.
