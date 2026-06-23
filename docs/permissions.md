# Permissions & Scopes Reference

This document describes the OAuth scopes, Google APIs, and Google Workspace administrator privileges required to run the Chrome Enterprise Premium MCP Server.

## OAuth Scopes & Google APIs

The server requests the following OAuth scopes during the authentication flow. These scopes must be enabled in your Google Cloud project (if using a custom OAuth client) and allowed in your Workspace domain.

| Scope                                 | API                                                                             | Used for                                             |
| :------------------------------------ | :------------------------------------------------------------------------------ | :--------------------------------------------------- |
| `openid`, `userinfo.email`            | OpenID Connect                                                                  | Identifies the logged-in admin in startup output     |
| `chrome.management.policy`            | [Chrome Policy](https://developers.google.com/chrome/policy)                    | Reading and writing connector and extension policies |
| `chrome.management.reports.readonly`  | [Chrome Management](https://developers.google.com/chrome/management)            | Telemetry version counts                             |
| `chrome.management.profiles.readonly` | [Chrome Management](https://developers.google.com/chrome/management)            | Listing managed browser profiles                     |
| `admin.reports.audit.readonly`        | [Admin SDK Reports](https://developers.google.com/admin-sdk/reports)            | Fetching Chrome activity logs                        |
| `admin.directory.orgunit.readonly`    | [Admin SDK Directory](https://developers.google.com/admin-sdk/directory)        | Organizational Unit hierarchy                        |
| `admin.directory.customer.readonly`   | [Admin SDK Directory](https://developers.google.com/admin-sdk/directory)        | Customer ID resolution                               |
| `apps.licensing`                      | [Enterprise License Manager](https://developers.google.com/admin-sdk/licensing) | CEP subscription and per-user license checks         |
| `cloud-identity.policies`             | [Cloud Identity](https://cloud.google.com/identity/docs)                        | Managing DLP rules and content detectors (CRUD)      |
| `service.management`                  | [Service Usage](https://cloud.google.com/service-usage/docs)                    | Verifying and enabling required Google Cloud APIs    |

> [!NOTE]
> **OAuth App Trust Required:** If your organization restricts third-party app access, a Super Admin must [trust the OAuth client](troubleshooting.md#configure-oauth-app-for-sensitive-scopes) in the Admin Console before you can authenticate.

## Google Workspace Admin Privileges

To call Google Workspace APIs, the user account that authenticates the server must hold appropriate administrator privileges.

### Prebuilt Roles

- **Super Admin**: Grants all required privileges automatically.
- **Chrome Admin**: Grants Chrome Management privileges (covers policy tools, but not DLP or reports).

### Custom / Delegated Roles

If you use a custom admin role, it must have the following privileges enabled in the Google Admin Console under **Account > Admin roles**:

1.  **Chrome Management**:
    - **Settings** (or **Manage User Settings** and **Manage Application Settings**): Required to read and write connector policies and extension configurations.
    - **Managed Browsers**: Required to view and manage enrolled browsers.
    - **View Reports**: Required for browser telemetry tools (versions, insights).
2.  **Data Loss Prevention (DLP)**:
    - **Manage DLP Rules**: Required to create, edit, or delete DLP rules and content detectors.
3.  **Reports**:
    - **Audit Reports**: Required to fetch Chrome activity logs (Admin SDK Reports API).
4.  **Organizational Units**:
    - **Read**: Required to resolve organizational unit hierarchies.
