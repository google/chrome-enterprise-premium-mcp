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

# Documentation

Reference documentation for operating and extending the Chrome Enterprise Premium MCP server. The root [`README.md`](../README.md) covers installation and connecting an MCP client. These docs cover what you need after the server is running.

- [`configuration.md`](./configuration.md): Environment variables, stdio and HTTP transport modes, and the per-mechanism authentication matrix.
- [`troubleshooting.md`](./troubleshooting.md): Authentication, permission, Node.js, and MCP-client integration issues with their fixes.
- [`architecture.md`](./architecture.md): Code layout, the client abstraction, retry behavior, and CEL validation.
- [`faq.md`](./faq.md): License requirements, service accounts, experimental features, and other recurring questions.
- [`auth-bring-your-own-oauth-client.md`](./auth-bring-your-own-oauth-client.md): How to create a Desktop OAuth client and run the CLI's `auth login` subcommand.
- [`auth-cloud-run-and-gemini-enterprise.md`](./auth-cloud-run-and-gemini-enterprise.md): How to deploy the server behind Cloud Run with Gemini Enterprise.

For contributing changes, see [`CONTRIBUTING.md`](../CONTRIBUTING.md). For the test infrastructure, see [`test/README.md`](../test/README.md).
