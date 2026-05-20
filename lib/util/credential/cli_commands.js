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
 * @file CLI subcommand implementations for the credential layer.
 */

import path from 'node:path'
import fs from 'node:fs/promises'
import { oauthFlowCredential } from './oauth_flow.js'
import { SCOPES } from '../../constants.js'
import { resolveOAuthClientConfig } from './oauth_client_config.js'
import { TokenCache } from './token_cache.js'
import { cliInvocation } from '../cli_invocation.js'

/**
 * Probes the OAuth-flow credential cache and prints a short status report.
 * Exits 0 in all cases; a non-OK probe is informational. Status only—no
 * principal email is printed; the banner displays it separately when the
 * server starts.
 * @returns {Promise<void>}
 */
export async function runAuthStatusCommand() {
  const requiredScopes = Object.values(SCOPES)
  const probe = await oauthFlowCredential().probe()
  console.log('Auth status:')
  if (!probe.ok) {
    if (probe.scopesKnown && probe.missingScopes.length > 0) {
      console.log(`  OAuth: 🔴 ${probe.missingScopes.length} of ${requiredScopes.length} scopes missing`)
    } else {
      console.log('  OAuth: 🔴 no cached credentials')
    }
    return
  }
  console.log(`  OAuth: 🟢 ${requiredScopes.length}/${requiredScopes.length} scopes`)
}

const NOTICE_LINES = [
  'Custom OAuth client detected. Verify the following before proceeding:',
  '  - Redirect URI: http://127.0.0.1 (and optionally http://localhost) is registered on the client.',
  '  - Scopes: every entry from lib/constants.js#SCOPES is granted on the consent screen.',
  '  - Brand verification: required for non-internal users on Workspace-restricted scopes (Admin SDK Directory and Reports).',
  'See docs/auth-bring-your-own-oauth-client.md for the full setup.',
]

/**
 * Prints the one-time custom-client notice when the marker is missing.
 * Does NOT write the marker; the caller writes it after `runLoginFlow`
 * succeeds, so a failed login surfaces the notice again next time.
 * @param {object} [opts] Injection points for testability.
 * @param {string} [opts.noticePath] Path to the marker file; defaults to byo-notice.shown in the cache dir.
 * @param {(env?: object) => ReturnType<typeof resolveOAuthClientConfig>} [opts.configResolver] OAuth client config resolver; defaults to resolveOAuthClientConfig.
 * @returns {Promise<{markerPath: string, printed: boolean}>} The marker path and whether the notice was printed.
 */
async function maybePrintCustomClientNotice({ noticePath, configResolver = resolveOAuthClientConfig } = {}) {
  const config = configResolver()
  if (config.source !== 'custom') {
    return { markerPath: null, printed: false }
  }
  const markerPath = noticePath || path.join(path.dirname(TokenCache.defaultPath()), 'byo-notice.shown')
  try {
    await fs.access(markerPath)
    return { markerPath, printed: false }
  } catch {
    // missing — show notice below
  }
  for (const line of NOTICE_LINES) {
    console.log(line)
  }
  console.log()
  return { markerPath, printed: true }
}

/**
 * Writes the BYO-notice marker. Called after a successful runLoginFlow so a
 * failed login does not silently suppress the next reminder.
 * @param {string} markerPath Path to the marker file.
 * @returns {Promise<void>} Resolves when the marker is written.
 */
async function writeCustomClientNoticeMarker(markerPath) {
  await fs.mkdir(path.dirname(markerPath), { recursive: true })
  await fs.writeFile(markerPath, new Date().toISOString())
}

/**
 * Runs the managed-OAuth login flow and prints a one-line success message.
 * When using a custom OAuth client, prints a one-time notice on the first run.
 * @param {object} [opts] Injection points for testability.
 * @param {() => ReturnType<typeof oauthFlowCredential>} [opts.credentialFactory] Factory for the OAuth credential; defaults to oauthFlowCredential.
 * @param {string} [opts.noticePath] Path to the BYO-notice marker file for testing.
 * @param {(env?: object) => ReturnType<typeof resolveOAuthClientConfig>} [opts.configResolver] Resolves OAuth client config; defaults to resolveOAuthClientConfig.
 * @returns {Promise<void>}
 */
export async function runLoginCommand({ credentialFactory = oauthFlowCredential, noticePath, configResolver } = {}) {
  const notice = await maybePrintCustomClientNotice({ noticePath, configResolver })
  const cred = credentialFactory()
  await cred.runLoginFlow()
  if (notice.printed && notice.markerPath) {
    await writeCustomClientNoticeMarker(notice.markerPath)
  }
  console.log(`Tokens cached. Run \`${cliInvocation('auth status')}\` to verify.`)
}
