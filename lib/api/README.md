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

Google Cloud and Workspace API clients. Each API has an interface and a real
implementation. Tools depend on the interface so we can run integration tests
against an in-process fake without changing client code.

## Client pattern

Every API has two files:

- `interfaces/foo_client.js`: abstract base class. Methods throw
  `Error('Not implemented')`. Tools program against the interface.
- `real_foo_client.js`: production implementation. Authenticates via ADC and
  calls the live Google API. Each method also accepts a bearer token,
  which when supplied takes the place of ADC.

For tests, we instantiate the same `Real*Client` and redirect it at the
fake API server in `test/helpers/fake-api-server.js`. The factory in
`test/helpers/integration/tools/client_factory.js` does the wiring:

```js
// Real backend (production / postsubmit): no args, the wrapper passes a
// Credential (ADC, bearer, or oauth-flow) per request.
new RealAdminSdkClient()

// Fake backend (presubmit): same class, redirected via rootUrl. The fake
// API server ignores the auth header, so any Credential is accepted.
new RealAdminSdkClient({ rootUrl })
```

`mcp-server.js` uses the same trick: when `GOOGLE_API_ROOT_URL` is set, it
passes `rootUrl` into each Real client.

## API domains

| Domain            | Interface                     | APIs used                                                                                   |
| :---------------- | :---------------------------- | :------------------------------------------------------------------------------------------ |
| Admin SDK         | `admin_sdk_client.js`         | Directory (org units, customer ID), Reports (activity logs), Licensing (CEP license checks) |
| Chrome Management | `chrome_management_client.js` | Browser version counts, customer profiles                                                   |
| Chrome Policy     | `chrome_policy_client.js`     | Connector policies, extension install policies                                              |
| Cloud Identity    | `cloud_identity_client.js`    | DLP rules, detectors (CRUD)                                                                 |
| Service Usage     | `service_usage_client.js`     | API enablement checks                                                                       |

## Adding a new API client

1. Create `interfaces/new_client.js` with abstract methods.
2. Create `real_new_client.js` that implements the interface using `googleapis`
   or `@google-cloud/*`. Take an optional `apiOptions` argument and pass it
   through to your client constructor so `rootUrl` and `auth` overrides work.
3. Wire the new client into `mcp-server.js` (both the
   `GOOGLE_API_ROOT_URL`-set and unset branches construct the same Real
   clients).
4. Add the new client to `getApiClients()` in
   `test/helpers/integration/tools/client_factory.js`. Mirror the existing
   pattern: instantiate with no args for the `real` branch, and with
   `{ rootUrl, auth: fakeAuth }` for the `fake` branch.
5. Add HTTP handlers for the new API to `test/helpers/fake-api-server.js` so
   the fake backend can serve the requests your client will make.
