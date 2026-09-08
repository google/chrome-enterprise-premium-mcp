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
 * @file Helper utilities for normalizing and checking CEP_AUTH_MODE configurations.
 */

/**
 * Returns the normalized auth mode: 'dynamic' | 'bearer-only' | 'service-account-only'.
 * @returns {'dynamic' | 'bearer-only' | 'service-account-only'} The active auth mode.
 * @throws {Error} If CEP_AUTH_MODE is set to an invalid mode string.
 */
export function getAuthMode() {
  const mode = (process.env.CEP_AUTH_MODE || 'dynamic').trim().toLowerCase()
  if (mode !== 'dynamic' && mode !== 'bearer-only' && mode !== 'service-account-only') {
    throw new Error(`Invalid CEP_AUTH_MODE "${mode}". Allowed values: dynamic, bearer-only, service-account-only.`)
  }
  return mode
}

/**
 * Returns true if the server is configured in strict bearer token mode.
 * @returns {boolean} True if the server is in strict bearer-only mode.
 */
export function isBearerMode() {
  return getAuthMode() === 'bearer-only'
}

/**
 * Returns true if the server is configured in strict service account mode.
 * @returns {boolean} True if the server is in strict service-account-only mode.
 */
export function isServiceAccountMode() {
  return getAuthMode() === 'service-account-only'
}

/**
 * Returns true if the server is configured in dynamic CLI sign-in mode.
 * @returns {boolean} True if the server is in dynamic CLI mode.
 */
export function isDynamicMode() {
  return getAuthMode() === 'dynamic'
}

/**
 * Determines if interactive authentication tools (such as `cep_auth`) should be registered.
 * @returns {boolean} True if auth tools should be registered.
 */
export function shouldRegisterAuthTools() {
  const mode = getAuthMode()
  return mode !== 'bearer-only' && mode !== 'service-account-only'
}
