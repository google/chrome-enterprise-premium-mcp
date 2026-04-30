#!/usr/bin/env node
/*
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
*/

/**
 * @file CLI entry point. Dispatches argv[2] to a subcommand or to the MCP server.
 */

/* eslint-disable n/no-process-exit */

import { runServer } from '../mcp-server.js'

/**
 * Dispatches the CLI subcommand.
 * @returns {Promise<void>} Resolves when the chosen command finishes.
 */
async function main() {
  const sub = process.argv[2]
  if (sub === 'auth-status') {
    const { runAuthStatusCommand } = await import('../lib/util/credential/cli_commands.js')
    return runAuthStatusCommand()
  }
  if (sub === 'login') {
    const { runLoginCommand } = await import('../lib/util/credential/cli_commands.js')
    return runLoginCommand()
  }
  return runServer()
}

main().catch(err => {
  console.error(err.message || err)
  process.exit(1)
})
