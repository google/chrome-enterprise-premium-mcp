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

Google Cloud and Workspace API clients. Each API is wrapped behind a client
abstraction so tools depend on interfaces and tests can swap in fakes without
network calls.

## Client triad pattern

Every API has three files:

- `interfaces/foo_client.js` — Abstract base class. Methods throw
  `Error('Not implemented')`. Defines the contract that tools program against.
- `real_foo_client.js` — Production implementation. Authenticates via ADC or a
  passed-through OAuth token, calls the real Google API.
- `fake_foo_client.js` — Test double. Returns canned responses and tracks calls.
  Used by the fake API server in `test/helpers/fake-api-server.js`.

The server wires real or fake clients in `mcp-server.js` based on whether
`GOOGLE_API_ROOT_URL` is set.

## API domains

| Domain            | Interface                     | APIs used                                                                                   |
| :---------------- | :---------------------------- | :------------------------------------------------------------------------------------------ |
| Admin SDK         | `admin_sdk_client.js`         | Directory (org units, customer ID), Reports (activity logs), Licensing (CEP license checks) |
| Chrome Management | `chrome_management_client.js` | Browser version counts, customer profiles                                                   |
| Chrome Policy     | `chrome_policy_client.js`     | Connector policies, extension install policies                                              |
| Cloud Identity    | `cloud_identity_client.js`    | DLP rules, detectors (CRUD)                                                                 |
| Service Usage     | `service_usage_client.js`     | API enablement checks                                                                       |

## Legacy standalone wrappers

The bare files (`admin_sdk.js`, `chromemanagement.js`, `chromepolicy.js`,
`cloudidentity.js`) are earlier standalone implementations that predate the
client abstraction. They are not imported anywhere and will be removed in a
future cleanup.

## Adding a new API client

1. Create `interfaces/new_client.js` with abstract methods.
2. Create `real_new_client.js` implementing the interface with `googleapis` or
   `@google-cloud/*`.
3. Create `fake_new_client.js` returning canned data.
4. Wire both into `mcp-server.js` (in the real/fake client blocks).
5. Add the fake to `test/helpers/integration/tools/client_factory.js`.
