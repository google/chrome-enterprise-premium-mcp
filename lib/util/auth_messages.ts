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

export interface AdcProbeResult {
  /** Whether ADC produced a usable token (legacy). */
  valid?: boolean
  /** Whether the credential is usable (new standard). */
  ok?: boolean
  /** Principal email if resolvable, else null (legacy). */
  email?: string | null
  /** Principal email if resolvable, else null (new standard). */
  principal?: string | null
  /** Required scopes the token does not grant. */
  missingScopes: string[]
  /** False when tokeninfo could not enumerate scopes. */
  scopesKnown: boolean
  /** google-auth-library client class name (e.g. 'UserRefreshClient', 'JWT', 'Compute'). */
  credentialType?: string | null
  /** Resolved quota project (env var or ADC file), or null when unset. */
  quotaProject?: string | null
  /** The credential source (adc, oauth-flow, etc). */
  source?: 'adc' | 'bearer-access' | 'bearer-id' | 'oauth-flow' | (string & {})
}

/**
 * Maps a source identifier to a display label.
 * @param source The credential source.
 * @returns Display label for the source.
 */
function labelFor(source: string): string {
  const labels: Record<string, string> = {
    adc: 'ADC',
    'oauth-flow': 'OAuth',
    'bearer-access': 'Bearer (access)',
    'bearer-id': 'Bearer (ID)',
  }
  return labels[source] || 'Bearer'
}

/**
 * Builds the single-line "Auth scopes:" field shown in the banner.
 * @param probe ADC probe result or CredentialProbe object.
 * @param requiredScopes The full list of scopes the server uses.
 * @returns The banner field text.
 */
export function buildScopesField(probe: AdcProbeResult, requiredScopes: string[]): string {
  const hasSource = 'source' in probe
  const source = hasSource ? (probe.source as string) : 'adc'

  // Normalize the ok/valid field: if ok is missing but valid exists, use valid
  const isOk = hasSource ? probe.ok : probe.ok !== undefined ? probe.ok : probe.valid

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

  if (!probe.scopesKnown) {
    if (source === 'adc') {
      return '🟡 Unable to verify (tokeninfo unavailable)'
    }
    if (hasSource) {
      const label = labelFor(source)
      return `🟢 ${label}`
    }
    return '🟡 Unable to verify (tokeninfo unavailable)'
  }

  if (probe.missingScopes.length === 0) {
    if (!hasSource) {
      return `🟢 All ${requiredScopes.length} scopes granted`
    }
    const label = labelFor(source)
    const activePrincipal = probe.principal || probe.email
    const principal = activePrincipal ? ` (${activePrincipal})` : ''
    const scopeCount = requiredScopes.length
    return `🟢 ${label}${principal}, ${scopeCount}/${scopeCount} scopes`
  }

  const missingCount = probe.missingScopes.length
  const totalCount = requiredScopes.length
  return `🔴 ${missingCount} of ${totalCount} missing`
}

/**
 * Builds the multi-line `gcloud auth application-default login` block shown
 * after the banner whenever ADC is missing or under-scoped.
 * @param adc ADC probe result.
 * @param requiredScopes The full list of scopes the server uses.
 * @returns Array of lines (no trailing newline), or null.
 */
export function buildAuthRemediationLines(adc: AdcProbeResult, requiredScopes: string[]): string[] | null {
  const isValid = adc.valid || adc.ok
  if (isValid && adc.missingScopes.length === 0) {
    return null
  }
  if (isValid && !adc.scopesKnown) {
    return null
  }

  const lines: string[] = []
  lines.push(
    !isValid
      ? 'ADC is not configured. Authorize it with:'
      : `${adc.missingScopes.length} required scope(s) missing. Re-authorize with the full list:`,
  )
  lines.push('gcloud auth application-default login \\')
  lines.push(`--scopes=${requiredScopes[0]},\\`)
  for (let i = 1; i < requiredScopes.length - 1; i++) {
    lines.push(`${requiredScopes[i]},\\`)
  }
  lines.push(requiredScopes[requiredScopes.length - 1])
  if (isValid && adc.missingScopes.length > 0) {
    lines.push('')
    lines.push('Missing:')
    for (const s of adc.missingScopes) {
      lines.push(`  - ${s}`)
    }
  }
  return lines
}

/**
 * Builds the notice shown when ADC works but has no quota project.
 * @param adc ADC probe result.
 * @returns Array of lines to print, or null when no notice is needed.
 */
export function buildQuotaProjectWarning(adc: AdcProbeResult): string[] | null {
  const isValid = adc.valid || adc.ok
  if (!isValid) {
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

interface OAuthClientConfig {
  clientId: string
  clientSecret: string
  source: 'managed' | 'custom'
}

/**
 * Renders the banner field for the active OAuth client config.
 * @param config The resolved OAuth client config, or null when resolution failed.
 * @returns The banner field text.
 */
export function buildOAuthClientField(config: OAuthClientConfig | null): string {
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
 * way the shell would tokenize an unquoted command.
 * @param text Multi-line shell command text.
 * @returns Argv-style tokens.
 */
export function shellTokenize(text: string): string[] {
  return text.replace(/\\\n/g, '').trim().split(/\s+/)
}
