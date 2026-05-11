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

# lib/api

Google Cloud and Workspace API clients. Every API has a single client
wrapper. Tools depend on these clients directly; for integration tests,
we redirect them to an in-process fake HTTP server without changing tool
code.

## Client pattern

Every API has a single file:

- `foo_client.js`: production implementation. Authenticates through ADC and
  calls the live Google API. Each method also accepts a bearer token,
  which when supplied takes the place of ADC.

For tests, we instantiate the same `*Client` class and redirect it at the
fake API server in `test/helpers/fake-api-server.js`. The factory in
`test/helpers/integration/tools/client_factory.js` does the wiring:

```js
// Real backend (production / postsubmit): no args, uses ADC.
new AdminSdkClient()

// Fake backend (presubmit): same class, redirected through rootUrl + a fake
// auth provider that short-circuits getAuthClient().
new AdminSdkClient({ rootUrl, auth: fakeAuth })
```

`mcp-server.ts` uses the same trick: when `GOOGLE_API_ROOT_URL` is set, it
passes `rootUrl` into each client.

## API domains

| Domain            | Client File                   | APIs used                                                                                   |
| :---------------- | :---------------------------- | :------------------------------------------------------------------------------------------ |
| Admin SDK         | `admin_sdk_client.js`         | Directory (org units, customer ID), Reports (activity logs), Licensing (CEP license checks) |
| Chrome Management | `chrome_management_client.js` | Browser version counts, customer profiles                                                   |
| Chrome Policy     | `chrome_policy_client.js`     | Connector policies, extension install policies                                              |
| Cloud Identity    | `cloud_identity_client.js`    | DLP rules, detectors (CRUD)                                                                 |
| Service Usage     | `service_usage_client.js`     | API enablement checks                                                                       |

## Adding a new API client

1. Create `new_client.js` that implements the client using `googleapis`
   or `@google-cloud/*`. Take an optional `apiOptions` argument and pass it
   through to your client constructor so `rootUrl` and `auth` overrides work.
2. Wire the new client into `mcp-server.ts` (both the
   `GOOGLE_API_ROOT_URL`-set and unset branches construct the same
   clients).
3. Add the new client to `getApiClients()` in
   `test/helpers/integration/tools/client_factory.js`. Mirror the existing
   pattern: instantiate with no args for the `real` branch, and with
   `{ rootUrl, auth: fakeAuth }` for the `fake` branch.
4. Add HTTP handlers for the new API to `test/helpers/fake-api-server.js` so
   the fake backend can serve the requests your client will make.
