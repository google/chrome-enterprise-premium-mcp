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
 * @file Single source of truth for the user-facing CLI invocation form.
 *
 * Users install the server two ways: as a local checkout (the bin
 * `chrome-enterprise-premium-mcp` is on PATH) or via npx
 * (`npx -y \@google/chrome-enterprise-premium-mcp\@latest`). Telling an npx
 * user to run `mcp auth login` fails—that binary does not exist on their
 * PATH. The default is the npx form so remediation text never makes a
 * false promise.
 */

import { execFileSync } from 'node:child_process'

const BIN_NAME = 'chrome-enterprise-premium-mcp'
const NPX_FORM = `npx -y @google/${BIN_NAME}@latest`

/**
 * The safe default invocation: the npx form, which works regardless of
 * install mode.
 */
export const CLI_INVOKE_DEFAULT = NPX_FORM

let cachedHasBin = null

/**
 * Probes PATH for the local bin. Result is cached per-process.
 * @returns {boolean} True if the bin is on PATH.
 */
function hasLocalBin() {
  if (cachedHasBin !== null) {
    return cachedHasBin
  }
  const cmd = process.platform === 'win32' ? 'where' : 'which'
  try {
    execFileSync(cmd, [BIN_NAME], { stdio: ['ignore', 'ignore', 'ignore'] })
    cachedHasBin = true
  } catch {
    cachedHasBin = false
  }
  return cachedHasBin
}

/**
 * Returns the user-facing CLI invocation string, optionally with a
 * subcommand appended.
 *
 * Detection order:
 * 1. `CEP_INVOKE_MODE=local|npx` env hint.
 * 2. Probe PATH for the `chrome-enterprise-premium-mcp` bin (local
 * install).
 * 3. Fall back to the npx form.
 * @param {string} [subcommand] Optional subcommand, e.g. `'auth login'`.
 * @returns {string} The invocation string to show the user.
 */
export function cliInvocation(subcommand) {
  const hint = (process.env.CEP_INVOKE_MODE || '').trim().toLowerCase()
  let base
  if (hint === 'local') {
    base = BIN_NAME
  } else if (hint === 'npx') {
    base = NPX_FORM
  } else if (hasLocalBin()) {
    base = BIN_NAME
  } else {
    base = NPX_FORM
  }
  return subcommand ? `${base} ${subcommand}` : base
}

/**
 * Test-only hook: clears the cached PATH probe result.
 * @returns {void}
 */
export function _resetCliInvocationCacheForTests() {
  cachedHasBin = null
}
