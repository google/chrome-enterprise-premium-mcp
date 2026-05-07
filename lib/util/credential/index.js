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
 * @file Credential factories for the supported delivery mechanisms.
 *
 * Each factory returns an object matching the Credential typedef. HTTP-mode
 * handlers select the bearer path per request; stdio mode and the boot banner
 * read the OAuth-flow factory's probe.
 */

/**
 * @typedef {object} CredentialProbe
 * @property {boolean} ok                       Whether the credential is usable.
 * @property {'bearer-access'|'bearer-id'|'oauth-flow'} source The credential source.
 * @property {?string} principal                Email for EUC, SA address for SA.
 * @property {?string} credentialType           For OAuth-flow: 'managed' or 'custom'. Null for bearer.
 * @property {boolean} scopesKnown              Whether the missingScopes list is authoritative.
 * @property {string[]} missingScopes           Scopes the caller asked for but the credential does not hold.
 * @property {?Date} expiry                     Access-token expiry; null when not applicable.
 */

/**
 * @typedef {object} Credential
 * @property {() => Promise<CredentialProbe>} probe Probes the credential and returns its current state.
 * @property {() => Promise<import('google-auth-library').AuthClient>} getClient Returns an auth client ready for API calls.
 * @property {(probe: CredentialProbe, requiredScopes: string[]) => string[]|null} buildRemediation Returns remediation lines for a failed probe, or null if none apply.
 */
