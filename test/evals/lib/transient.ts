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
 * @file Transient-error classification for the eval runner.
 *
 * Distinguishes infrastructure / quota / network failures (which should be
 * retried and, if persistent, recorded as TRANSIENT and not counted toward
 * pass-rate) from genuine model-output failures (FAIL).
 */

/** Per-run terminal classification. Used in result.status. */
export const Status = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  TRANSIENT: 'TRANSIENT',
})

/** Where a transient failure originated, used in result.transient.source. */
export const TransientSource = Object.freeze({
  AGENT: 'agent',
  JUDGE: 'judge',
})

const TRANSIENT_MESSAGE_PATTERNS = [
  /\b503\b/,
  /\b429\b/,
  /\b408\b/,
  /service unavailable/i,
  /too many requests/i,
  /rate ?limit/i,
  /resource[ _]?exhausted/i,
  /deadline[ _]?exceeded/i,
  /\bunavailable\b/i,
  /\bquota\b/i,
  /\btimed? ?out\b/i,
  /aborted/i,
  /socket hang up/i,
]

const TRANSIENT_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENOTFOUND',
  'EPIPE',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
])

/**
 * Returns true if the error looks like a transient infrastructure, quota, or
 * network failure rather than a real model-output or programming error.
 *
 * Inspects HTTP status, error code, message text, and `err.cause` recursively.
 * @param {unknown} err
 * @returns {boolean}
 */
export function isTransient(err) {
  if (!err || typeof err !== 'object') {
    return false
  }

  const status = err.status ?? err.statusCode ?? err.response?.status
  if (typeof status === 'number') {
    if (status === 408 || status === 429) {
      return true
    }
    if (status >= 500 && status < 600) {
      return true
    }
  }

  const code = err.code ?? err.cause?.code
  if (typeof code === 'string' && TRANSIENT_CODES.has(code)) {
    return true
  }

  const message = typeof err.message === 'string' ? err.message : String(err)
  for (const pat of TRANSIENT_MESSAGE_PATTERNS) {
    if (pat.test(message)) {
      return true
    }
  }

  if (err.cause && err.cause !== err) {
    return isTransient(err.cause)
  }

  return false
}

/**
 * Default retry knobs for the transient-retry helper.
 */
export const RETRY_DEFAULTS = Object.freeze({
  maxRetries: 3,
  baseDelayMs: 2000,
  maxJitterMs: 750,
})

/**
 * Invokes an async function with bounded retry on transient errors.
 *
 * Non-transient errors are re-thrown immediately so callers can handle real
 * failures without ever waiting on a retry. After exhausting retries on a
 * transient error, returns `{ ok: false, transient: true, error }` rather
 * than throwing; the runner uses that to record TRANSIENT status.
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ maxRetries?: number, baseDelayMs?: number, maxJitterMs?: number, sleep?: (ms: number) => Promise<void> }} [opts]
 * @returns {Promise<{ ok: true, value: T } | { ok: false, transient: true, error: Error, attempts: number }>}
 */
export async function withTransientRetry(fn, opts = {}) {
  const { maxRetries, baseDelayMs, maxJitterMs } = { ...RETRY_DEFAULTS, ...opts }
  const sleep =
    opts.sleep ??
    (ms =>
      new Promise(r => {
        setTimeout(r, ms)
      }))

  let lastErr
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return { ok: true, value: await fn() }
    } catch (err) {
      if (!isTransient(err)) {
        throw err
      }
      lastErr = err
      if (attempt < maxRetries) {
        const delay = baseDelayMs * 2 ** attempt + Math.floor(Math.random() * maxJitterMs)
        await sleep(delay)
      }
    }
  }
  return { ok: false, transient: true, error: lastErr, attempts: maxRetries + 1 }
}
