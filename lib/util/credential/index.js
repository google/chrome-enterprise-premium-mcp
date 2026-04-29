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
 * Each factory returns an object matching the Credential typedef. The wrapper
 * at tools/utils/wrapper.js selects one factory per request; the boot banner
 * runs probe() on each non-bearer factory.
 */

/**
 * @typedef {object} CredentialProbe
 * @property {boolean} ok                       Whether the credential is usable.
 * @property {'adc'|'bearer-access'|'bearer-id'|'oauth-flow'} source
 * @property {?string} principal                Email for EUC, SA address for SA.
 * @property {?string} credentialType           For ADC: google-auth-library client class. For OAuth-flow: 'managed' or 'custom'.
 * @property {boolean} scopesKnown              Whether the missingScopes list is authoritative.
 * @property {string[]} missingScopes
 * @property {?Date} expiry                     Access-token expiry; null when not applicable.
 */

/**
 * @typedef {object} Credential
 * @property {() => Promise<CredentialProbe>} probe
 * @property {() => Promise<import('google-auth-library').AuthClient>} getClient
 * @property {(probe: CredentialProbe, requiredScopes: string[]) => string[]|null} buildRemediation
 */

// Re-exports are added by later tasks as each factory module is created:
// export { adcCredential } from './adc.js'      // Task 2 / sub-issue #88
// export { bearerCredential } from './bearer.js' // Task 5 / sub-issue #88
// export { oauthFlowCredential } from './oauth_flow.js' // sub-issue #90
