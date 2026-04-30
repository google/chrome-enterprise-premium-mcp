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
 * @file Pure formatters for the startup banner's ADC / scope / quota status.
 *
 * Side-effect-free so the conditional messaging can be exercised by unit
 * tests without spawning the server. ADC is the only Google-API-auth path
 * today; every helper here assumes the caller has already probed ADC.
 */

/**
 * @typedef {object} AdcProbeResult
 * @property {boolean} valid           Whether ADC produced a usable token.
 * @property {?string} email           Principal email if resolvable, else null.
 * @property {string[]} missingScopes  Required scopes the token does not grant.
 * @property {boolean} scopesKnown     False when tokeninfo could not enumerate scopes.
 * @property {?string} credentialType  google-auth-library client class name (e.g. 'UserRefreshClient', 'JWT', 'Compute').
 * @property {?string} quotaProject    Resolved quota project (env var or ADC file), or null when unset.
 */

/**
 * Maps a source identifier to a display label.
 * @param {string} source - The credential source (adc, oauth-flow, bearer-access, bearer-id, etc).
 * @returns {string} Display label for the source.
 */
function labelFor(source) {
  const labels = {
    adc: 'ADC',
    'oauth-flow': 'OAuth',
    'bearer-access': 'Bearer (access)',
    'bearer-id': 'Bearer (ID)',
  }
  return labels[source] || 'Bearer'
}

/**
 * Builds the single-line "Auth scopes:" field shown in the banner.
 * @param {AdcProbeResult|object} probe - ADC probe result or CredentialProbe object.
 * @param {string[]} requiredScopes   - The full list of scopes the server uses.
 * @returns {string} The banner field text.
 */
export function buildScopesField(probe, requiredScopes) {
  // Handle backward compatibility: if source is missing, treat as legacy ADC probe
  const hasSource = 'source' in probe
  const source = hasSource ? probe.source : 'adc'

  // Normalize the ok/valid field: if ok is missing but valid exists, use valid
  const isOk = hasSource ? probe.ok : probe.ok !== undefined ? probe.ok : probe.valid

  // Failure states
  if (!isOk) {
    switch (source) {
      case 'adc':
        return '🔴 ADC not configured'
      case 'oauth-flow':
        return '🔴 OAuth tokens missing or invalid'
      case 'bearer-id':
        return '🔴 ID token rejected'
      default:
        return '🔴 Authentication failed'
    }
  }

  // Success states with scope information
  if (!probe.scopesKnown) {
    // Unknown scopes: show "unable to verify" when source is ADC or legacy
    if (source === 'adc') {
      return '🟡 Unable to verify (tokeninfo unavailable)'
    }
    // Bearer tokens and OAuth without scope info (new sources only): show label
    if (hasSource) {
      const label = labelFor(source)
      return `🟢 ${label}`
    }
    // Legacy ADC path
    return '🟡 Unable to verify (tokeninfo unavailable)'
  }

  // All scopes granted
  if (probe.missingScopes.length === 0) {
    // Legacy ADC behavior (no source field): preserve old format
    if (!hasSource) {
      return `🟢 All ${requiredScopes.length} scopes granted`
    }
    // New source-based format with principal and scope count
    const label = labelFor(source)
    const principal = probe.principal ? ` (${probe.principal})` : ''
    const scopeCount = requiredScopes.length
    return `🟢 ${label}${principal}, ${scopeCount}/${scopeCount} scopes`
  }

  // Some scopes missing
  const missingCount = probe.missingScopes.length
  const totalCount = requiredScopes.length
  return `🔴 ${missingCount} of ${totalCount} missing`
}

/**
 * Builds the multi-line `gcloud auth application-default login` block shown
 * after the banner whenever ADC is missing or under-scoped. Returns `null`
 * when no remediation is needed.
 *
 * Continuation lines deliberately have no leading whitespace: bash collapses
 * `\<LF>` to nothing, so indentation would land inside the comma-separated
 * `--scopes=` value as literal spaces and gcloud would reject the trailing
 * URLs as positional arguments.
 * @param {AdcProbeResult} adc       - ADC probe result.
 * @param {string[]} requiredScopes  - The full list of scopes the server uses.
 * @returns {?string[]} Array of lines (no trailing newline), or null.
 */
export function buildAuthRemediationLines(adc, requiredScopes) {
  if (adc.valid && adc.missingScopes.length === 0) {
    return null
  }
  if (adc.valid && !adc.scopesKnown) {
    return null
  }

  const lines = []
  lines.push(
    !adc.valid
      ? 'ADC is not configured. Authorize it with:'
      : `${adc.missingScopes.length} required scope(s) missing. Re-authorize with the full list:`,
  )
  lines.push('gcloud auth application-default login \\')
  lines.push(`--scopes=${requiredScopes[0]},\\`)
  for (let i = 1; i < requiredScopes.length - 1; i++) {
    lines.push(`${requiredScopes[i]},\\`)
  }
  lines.push(requiredScopes[requiredScopes.length - 1])
  if (adc.valid && adc.missingScopes.length > 0) {
    lines.push('')
    lines.push('Missing:')
    for (const s of adc.missingScopes) {
      lines.push(`  - ${s}`)
    }
  }
  return lines
}

/**
 * Builds the notice shown when ADC works but has no quota project. Google
 * APIs need a project to attribute quota and access checks against —
 * without one, requests come back as "quota exceeded" or "API not enabled"
 * even though no charges accrue. Only fires for user (`UserRefreshClient`)
 * credentials; service accounts and compute-metadata creds carry their
 * project implicitly.
 * @param {AdcProbeResult} adc - ADC probe result.
 * @returns {?string[]} Array of lines to print, or null when no notice is needed.
 */
export function buildQuotaProjectWarning(adc) {
  if (!adc.valid) {
    return null
  }
  if (adc.quotaProject) {
    return null
  }
  if (adc.credentialType !== 'UserRefreshClient') {
    return null
  }
  return [
    'ADC requires a quota project. Google APIs use it to attribute quota and access checks.',
    'Pick a project you have access to from:',
    '  https://console.cloud.google.com/projectselector2/home/dashboard',
    'Then point ADC at it:',
    'gcloud auth application-default set-quota-project YOUR_GCP_PROJECT_ID',
  ]
}

/**
 * Renders the banner field for the active OAuth client config.
 * @param {?{clientId: string, clientSecret: string, source: 'managed'|'custom'}} config The resolved OAuth client config, or null when resolution failed.
 * @returns {string} The banner field text.
 */
export function buildOAuthClientField(config) {
  if (!config) {
    return 'OAuth client: TODO (managed client not yet provisioned; set CEP_OAUTH_CLIENT_ID/SECRET to bring your own)'
  }
  if (config.source === 'managed') {
    return 'OAuth client: Google-managed'
  }
  return `OAuth client: custom (${config.clientId.slice(0, 8)}...)`
}

/**
 * Collapses bash `\<LF>` line continuations and splits on whitespace, the
 * way the shell would tokenize an unquoted command. Useful for verifying
 * that a printed command parses into the intended argv.
 * @param {string} text - Multi-line shell command text.
 * @returns {string[]} Argv-style tokens.
 */
export function shellTokenize(text) {
  return text.replace(/\\\n/g, '').trim().split(/\s+/)
}
