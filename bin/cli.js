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
 * @file CLI entry point. Dispatches `auth <verb>` subcommands or starts the
 * MCP server. Recognized verbs: `auth login`, `auth status`. Anything else
 * (or no argument) starts the server in stdio mode.
 */

/* eslint-disable n/no-process-exit */

import { runServer } from '../mcp-server.js'

const AUTH_HELP = [
  'Usage: mcp auth <verb>',
  '',
  'Verbs:',
  '  login    Authenticate via OAuth and cache an access token.',
  '  status   Show OAuth credential status.',
].join('\n')

/**
 * Dispatches an `auth` subcommand verb to the matching cli_commands handler.
 * @param {string|undefined} verb - The verb passed after `auth` on the command line.
 * @returns {Promise<void>} Resolves when the chosen handler finishes.
 */
async function runAuth(verb) {
  if (verb === 'login') {
    const { runLoginCommand } = await import('../lib/util/credential/cli_commands.js')
    return runLoginCommand()
  }
  if (verb === 'status') {
    const { runAuthStatusCommand } = await import('../lib/util/credential/cli_commands.js')
    return runAuthStatusCommand()
  }
  if (!verb) {
    process.stderr.write(`${AUTH_HELP}\n`)
    return
  }
  process.stderr.write(`Unknown auth verb: ${verb}\n\n${AUTH_HELP}\n`)
  process.exit(2)
}

/**
 * Dispatches the CLI subcommand.
 * @returns {Promise<void>} Resolves when the chosen command finishes.
 */
async function main() {
  const sub = process.argv[2]
  if (sub === 'auth') {
    return runAuth(process.argv[3])
  }
  return runServer()
}

main().catch(err => {
  console.error(err.message || err)
  process.exit(1)
})
