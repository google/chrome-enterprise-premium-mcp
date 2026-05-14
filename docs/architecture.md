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

# Architecture

```text
/
├── lib/
│   ├── api/              # Google Cloud and Workspace API clients (with redirect support)
│   ├── util/             # Auth, retry, CEL validation, logging, flags
│   └── constants.js      # Centralized configuration
├── prompts/              # MCP prompt definitions
│   ├── definitions/      # Individual prompt implementations
│   └── index.js
├── tools/
│   ├── definitions/      # Individual tool implementations
│   ├── utils/            # Tool-specific utilities
│   └── index.js          # Tool registration entry point
├── test/                 # Unit, integration, and eval tests
└── mcp-server.js         # Server entry point
```

## Key design patterns

- **Client abstraction.** Each Google API has a client wrapper in `lib/api/*_client.js`. Tool code calls these clients. For tests, the client instance receives a `rootUrl` override and a stub auth client to redirect calls at the in-process fake server. For the full pattern, see [`lib/api/README.md`](../lib/api/README.md).
- **Structured tool output.** Tools return structured JSON with both machine-readable data and a human-readable summary.
- **Retry with backoff.** The server retries `PERMISSION_DENIED` (gRPC code 7) up to seven times to handle eventual consistency after enabling APIs, with a 15-second initial delay; subsequent retries use exponential backoff.
- **CEL validation.** DLP rule conditions are validated offline against the Chrome CEL grammar before submission to Google.

## Test backends

Tests and evals run against two backends, controlled by the `CEP_BACKEND` environment variable.

- **Fake** (default for presubmit). An in-process Express server at `test/helpers/fake-api-server.js` mimics the five Google APIs the server uses. The client classes target it through a `rootUrl` override and a stub auth client. The fake backend makes no network calls and needs no credentials.
- **Real** (postsubmit). The client classes call the live Google APIs using your cached OAuth tokens (run `mcp auth login` first) or a service-account key from `GOOGLE_APPLICATION_CREDENTIALS`. The real backend requires authentication and the relevant APIs to be enabled.
