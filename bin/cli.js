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
 * @file CLI entry point for the Chrome Enterprise Premium MCP tool.
 *
 * Usage: node bin/cli.js <subcommand>
 *
 * Subcommands:
 *   auth-status   Print the current ADC and OAuth-flow credential state.
 *   login         Initiate the managed OAuth login flow (not yet implemented).
 */

/* eslint-disable n/no-process-exit */

const [, , sub] = process.argv

if (sub === 'auth-status') {
  const { runAuthStatusCommand } = await import('../lib/util/credential/cli_commands.js')
  await runAuthStatusCommand()
} else if (sub === 'login') {
  console.error('login: not yet implemented')
  process.exit(1)
} else {
  console.error(`Unknown subcommand: ${sub || '(none)'}`)
  console.error('Usage: node bin/cli.js <auth-status|login>')
  process.exit(1)
}
