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

# gemini-extension

`CONTEXT.md` is the grounding context [Gemini CLI](https://github.com/google-gemini/gemini-cli)
prepends to every agent session when a user installs this repo as an
extension. It sets the agent's persona, the operating protocol it
follows, and the technical anchors (pricing, IAM roles, deployment
commands) the agent should cite when answering CEP questions.

The file is intentionally **not** named `GEMINI.md`: that name would
collide with Gemini CLI's workspace context loader if a contributor ran
`gemini` inside this repo, mixing the end-user CEP persona with their
coding session. Gemini CLI loads `CONTEXT.md` only via the explicit
manifest path below, not via the workspace scanner.

The extension manifest at the repo root
([`gemini-extension.json`](../gemini-extension.json)) points at it and
tells Gemini CLI to launch `mcp-server.js` as the MCP backend.

> **`oauth_scopes` is install-time only:**
>
> - The list in this manifest drives the consent screen the Gemini CLI extension installer shows during `gemini extension install`.
> - The server's runtime scope set lives separately in `lib/constants.js#SCOPES`.
> - Keep the two lists in sync. If they diverge, the install-time consent screen asks for different scopes than the runtime token request, and sign-in fails.
