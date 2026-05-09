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
 * @file Credential factories for the three Layer-2 delivery mechanisms.
 *
 * Each factory returns an object matching the Credential interface. The wrapper
 * at tools/utils/wrapper.ts selects one factory per request; the boot banner
 * runs probe() on each non-bearer factory.
 */

import { AuthClient } from 'google-auth-library'

/**
 * Represents the result of probing a credential.
 */
export interface CredentialProbe {
  /** Whether the credential is usable. */
  ok: boolean
  /** The credential source. */
  source: 'adc' | 'bearer-access' | 'bearer-id' | 'oauth-flow'
  /** Email for EUC, SA address for SA. */
  principal: string | null
  /** For ADC: google-auth-library client class. For OAuth-flow: 'managed' or 'custom'. */
  credentialType: string | null
  /** Whether the missingScopes list is authoritative. */
  scopesKnown: boolean
  /** Scopes the caller asked for but the credential does not hold. */
  missingScopes: string[]
  /** Resolved quota project (env var or ADC file), or null when unset. */
  quotaProject: string | null
  /** Access-token expiry; null when not applicable. */
  expiry: Date | null
  /** Whether the token cache permissions are too loose (OAuth flow only). */
  permissionsWarning?: boolean
}

/**
 * Standard interface for credentials used by the server.
 */
export interface Credential {
  /** Probes the credential and returns its current state. */
  probe: () => Promise<CredentialProbe>
  /** Returns an auth client ready for API calls. */
  getClient: () => Promise<AuthClient>
  /** Returns remediation lines for a failed probe, or null if none apply. */
  buildRemediation: (probe: CredentialProbe, requiredScopes: string[]) => string[] | null
}
