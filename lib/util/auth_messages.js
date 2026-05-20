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
 * @file Pure formatters for the startup banner's credential, scope, and
 * quota-project status. The OAuth-flow probe drives stdio mode; bearer-mode
 * deployments have no local credentials and use the relevant red-status
 * branches.
 */

import { cliInvocation } from './cli_invocation.js'

/**
 * Maps a credential source identifier to a display label.
 * @param {string} source - The credential source ('oauth-flow', 'bearer-access', 'bearer-id').
 * @returns {string} Display label for the source.
 */
function labelFor(source) {
  const labels = {
    'oauth-flow': 'OAuth',
    'bearer-access': 'Bearer (access)',
    'bearer-id': 'Bearer (ID)',
  }
  return labels[source] || 'Bearer'
}

/**
 * Builds the single-line "Auth scopes:" field shown in the banner.
 * @param {import('./credential/index.js').CredentialProbe} probe - The credential probe result.
 * @param {string[]} requiredScopes - Scopes the server needs.
 * @returns {string} The banner field text.
 */
export function buildScopesField(probe, requiredScopes) {
  if (probe.scopesKnown && probe.missingScopes.length > 0) {
    return `🔴 ${probe.missingScopes.length} of ${requiredScopes.length} missing`
  }

  if (!probe.ok) {
    switch (probe.source) {
      case 'oauth-flow':
        return '🔴 OAuth tokens missing or invalid'
      case 'bearer-id':
        return '🔴 ID token rejected'
      default:
        return '🔴 Authentication failed'
    }
  }

  if (!probe.scopesKnown) {
    return `🟢 ${labelFor(probe.source)}`
  }

  const principal = probe.principal ? ` (${probe.principal})` : ''
  return `🟢 ${labelFor(probe.source)}${principal}, ${requiredScopes.length}/${requiredScopes.length} scopes`
}

/**
 * Builds the multi-line CLI-login remediation block shown after the banner
 * whenever OAuth tokens are missing or under-scoped. Returns `null` when no
 * remediation is needed.
 * @param {import('./credential/index.js').CredentialProbe} probe - The credential probe result.
 * @param {string[]} requiredScopes - Scopes the server needs.
 * @returns {?string[]} Array of lines (no trailing newline), or null.
 */
export function buildAuthRemediationLines(probe, requiredScopes) {
  if (probe.ok) {
    return null
  }

  const lines = []
  const hasPartialScopes = probe.scopesKnown && probe.missingScopes.length > 0
  if (hasPartialScopes) {
    lines.push(`${probe.missingScopes.length} required scope(s) missing. Re-authorize with:`)
  } else {
    lines.push('No cached OAuth credentials. Authorize with:')
  }
  lines.push(cliInvocation('auth login'))
  lines.push('')
  if (hasPartialScopes) {
    lines.push('Missing:')
    for (const s of probe.missingScopes) {
      lines.push(`  - ${s}`)
    }
  } else {
    lines.push(`Required scopes (${requiredScopes.length}):`)
    for (const s of requiredScopes) {
      lines.push(`  - ${s}`)
    }
  }
  return lines
}

/**
 * Describes the active OAuth client config in one short token.
 * @param {?{clientId: string, source: 'managed'|'custom'}} config The resolved OAuth client config, or null when resolution failed.
 * @returns {string} A short label.
 */
function oauthClientLabel(config) {
  if (!config) {
    return 'unresolved client'
  }
  if (config.source === 'managed') {
    return 'Google-managed'
  }
  return `custom ${config.clientId.slice(0, 8)}...`
}

/**
 * Builds the banner's "API credentials:" field, combining the probe principal
 * with the OAuth client identity in a single line.
 * @param {import('./credential/index.js').CredentialProbe} probe The credential probe result.
 * @param {?{clientId: string, source: 'managed'|'custom'}} clientConfig The resolved OAuth client config.
 * @returns {string[]} A [head, parens] tuple suitable for the banner's fmtField.
 */
export function buildApiCredsField(probe, clientConfig) {
  const client = oauthClientLabel(clientConfig)
  if (!probe.ok) {
    return ['OAuth', `(not configured, ${client})`]
  }
  const principal = probe.principal || 'detected'
  return ['OAuth', `(${client}, ${principal})`]
}
