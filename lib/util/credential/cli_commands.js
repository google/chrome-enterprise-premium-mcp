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
 * @file CLI command implementations for the auth subcommands.
 */

import { adcCredential } from './adc.js'
import { oauthFlowCredential } from './oauth_flow.js'
import { buildScopesField } from '../auth_messages.js'
import { SCOPES } from '../../constants.js'

/**
 * Probes the ADC and OAuth-flow credential factories and prints a two-line
 * status report. Exits 0 in all cases — a non-OK probe is informational.
 * @returns {Promise<void>}
 */
export async function runAuthStatusCommand() {
  const scopes = Object.values(SCOPES)
  const adcProbe = await adcCredential().probe()
  const oauthProbe = await oauthFlowCredential().probe()
  console.log('Auth status:')
  console.log('  ADC:        ' + buildScopesField(adcProbe, scopes))
  console.log('  OAuth flow: ' + buildScopesField(oauthProbe, scopes))
}
