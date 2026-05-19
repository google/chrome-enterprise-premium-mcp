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
 * @file OS-keychain storage for OAuth refresh tokens.
 *
 * Wraps `@napi-rs/keyring`, which uses macOS Keychain, Windows Credential
 * Vault, and libsecret/gnome-keyring on Linux. The previous community choice
 * `keytar` has been unmaintained since 2023; `@napi-rs/keyring` ships native
 * bindings via N-API and is a drop-in replacement.
 *
 * This module is not yet wired into the auth flow. See issue #239 for the
 * follow-up PR that switches `access_type` to `'offline'` and persists the
 * refresh token returned from the hosted token exchange.
 *
 * `getPassword()` from the underlying library returns `null` when no entry
 * exists; that case is treated as a non-error. Anything else thrown by the
 * native binding (libsecret missing, DBus session absent, locked keychain,
 * etc.) bubbles up as an `Error` with a useful message.
 */

/** Service name registered in the OS keychain. */
export const SERVICE_NAME = 'chrome-enterprise-premium-mcp'

/**
 * Default factory: lazy-imports `@napi-rs/keyring` and returns an entry bound
 * to `(SERVICE_NAME, account)`. The import is deferred so unit tests that pass
 * an in-memory factory never touch the native module.
 * @param {string} service Service name.
 * @param {string} account Account identifier (the OAuth email claim).
 * @returns {Promise<{getPassword: () => (string|null), setPassword: (p: string) => void, deletePassword: () => boolean}>} A keyring entry.
 */
async function defaultKeyringFactory(service, account) {
  const mod = await import('@napi-rs/keyring')
  return new mod.Entry(service, account)
}

/**
 * Stores `token` under service `SERVICE_NAME` and account `account`. Replaces
 * any existing value.
 * @param {string} account OAuth email claim used as the keychain account.
 * @param {string} token Refresh token to persist.
 * @param {object} [opts] Optional dependency injection.
 * @param {(service: string, account: string) => Promise<object>} [opts.keyringFactory] Factory returning a keyring entry.
 * @returns {Promise<void>} Resolves once the entry is written.
 */
export async function setRefreshToken(account, token, opts = {}) {
  const factory = opts.keyringFactory || defaultKeyringFactory
  const entry = await factory(SERVICE_NAME, account)
  try {
    entry.setPassword(token)
  } catch (err) {
    throw wrapKeyringError(err, `setRefreshToken(${account})`)
  }
}

/**
 * Returns the stored refresh token for `account`, or null when none is set.
 * @param {string} account OAuth email claim used as the keychain account.
 * @param {object} [opts] Optional dependency injection.
 * @param {(service: string, account: string) => Promise<object>} [opts.keyringFactory] Factory returning a keyring entry.
 * @returns {Promise<string|null>} The stored token, or null when absent.
 */
export async function getRefreshToken(account, opts = {}) {
  const factory = opts.keyringFactory || defaultKeyringFactory
  const entry = await factory(SERVICE_NAME, account)
  try {
    const value = entry.getPassword()
    return value === null || value === undefined ? null : value
  } catch (err) {
    throw wrapKeyringError(err, `getRefreshToken(${account})`)
  }
}

/**
 * Removes the stored refresh token for `account`.
 * @param {string} account OAuth email claim used as the keychain account.
 * @param {object} [opts] Optional dependency injection.
 * @param {(service: string, account: string) => Promise<object>} [opts.keyringFactory] Factory returning a keyring entry.
 * @returns {Promise<boolean>} True when an entry was removed, false when none existed.
 */
export async function deleteRefreshToken(account, opts = {}) {
  const factory = opts.keyringFactory || defaultKeyringFactory
  const entry = await factory(SERVICE_NAME, account)
  try {
    return Boolean(entry.deletePassword())
  } catch (err) {
    throw wrapKeyringError(err, `deleteRefreshToken(${account})`)
  }
}

/**
 * Reports whether the keychain backend can be used in this environment.
 * Probes by attempting a benign read on a sentinel account; treats any thrown
 * error as "unavailable" (no libsecret on Linux, no DBus session, etc.).
 * @param {object} [opts] Optional dependency injection.
 * @param {(service: string, account: string) => Promise<object>} [opts.keyringFactory] Factory returning a keyring entry.
 * @returns {Promise<boolean>} True when the backend responds to a read.
 */
export async function isAvailable(opts = {}) {
  const factory = opts.keyringFactory || defaultKeyringFactory
  try {
    const entry = await factory(SERVICE_NAME, '__availability_probe__')
    entry.getPassword()
    return true
  } catch {
    return false
  }
}

/**
 * Wraps an underlying keyring error with operation context.
 * @param {unknown} err The original error.
 * @param {string} op Short description of the failing operation.
 * @returns {Error} A normalized Error preserving the original message.
 */
function wrapKeyringError(err, op) {
  const msg = err && err.message ? err.message : String(err)
  const wrapped = new Error(`keyring ${op} failed: ${msg}`)
  wrapped.cause = err
  return wrapped
}
