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
import { adcCredential } from './adc.js'
import { oauthFlowCredential } from './oauth_flow.js'
import { buildScopesField } from '../auth_messages.js'
import { SCOPES } from '../../constants.js'
import { resolveOAuthClientConfig } from './oauth_client_config.js'
import { TokenCache } from './token_cache.js'

/**
 * Probes the ADC and OAuth-flow credential factories and prints a two-line
 * status report. Exits 0 in all cases — a non-OK probe is informational.
 */
export async function runAuthStatusCommand(): Promise<void> {
  const scopes = Object.values(SCOPES)
  const adcProbe = await adcCredential().probe()
  const oauthProbe = await oauthFlowCredential().probe()
  console.log('Auth status:')
  console.log('  ADC:        ' + buildScopesField(adcProbe, scopes))
  console.log('  OAuth flow: ' + buildScopesField(oauthProbe, scopes))
}

const NOTICE_LINES = [
  'Custom OAuth client detected. Verify the following before proceeding:',
  '  - Redirect URI: http://127.0.0.1 (and optionally http://localhost) is registered on the client.',
  '  - Scopes: every entry from lib/constants.js#SCOPES is granted on the consent screen.',
  '  - Brand verification: required for non-internal users on Workspace-restricted scopes (Admin SDK Directory and Reports).',
  'See docs/auth-bring-your-own-oauth-client.md for the full setup.',
]

export interface CustomClientNoticeOptions {
  noticePath?: string | null
  configResolver?: (env?: NodeJS.ProcessEnv) => { clientId: string; clientSecret: string; source: string }
}

/**
 * Prints the one-time custom-client notice when the marker is missing.
 * Does NOT write the marker; the caller writes it after `runLoginFlow`
 * succeeds, so a failed login surfaces the notice again next time.
 * @param opts Injection points for testability.
 * @returns The marker path and whether the notice was printed.
 */
async function maybePrintCustomClientNotice({
  noticePath,
  configResolver = resolveOAuthClientConfig,
}: CustomClientNoticeOptions = {}): Promise<{ markerPath: string | null; printed: boolean }> {
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
 * @param markerPath Path to the marker file.
 */
async function writeCustomClientNoticeMarker(markerPath: string): Promise<void> {
  await fs.mkdir(path.dirname(markerPath), { recursive: true })
  await fs.writeFile(markerPath, new Date().toISOString())
}

export interface LoginCommandOptions {
  credentialFactory?: () => ReturnType<typeof oauthFlowCredential>
  noticePath?: string | null
  configResolver?: (env?: NodeJS.ProcessEnv) => { clientId: string; clientSecret: string; source: string }
}

/**
 * Runs the managed-OAuth login flow and prints a one-line success message.
 * When using a custom OAuth client, prints a one-time notice on the first run.
 * @param opts Injection points for testability.
 */
export async function runLoginCommand({
  credentialFactory = oauthFlowCredential,
  noticePath,
  configResolver,
}: LoginCommandOptions = {}): Promise<void> {
  const notice = await maybePrintCustomClientNotice({ noticePath, configResolver })
  const cred = credentialFactory()
  await cred.runLoginFlow()
  if (notice.printed && notice.markerPath) {
    await writeCustomClientNoticeMarker(notice.markerPath)
  }
  console.log('Tokens cached. Run mcp auth-status to verify.')
}
