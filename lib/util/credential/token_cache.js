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
 * @file Persistent cache for the managed-OAuth flow's access token only.
 *
 * Refresh tokens are NEVER persisted. The CEP MCP server is not cleared to
 * store refresh tokens for the first-party managed OAuth client, and the
 * scopes the server requests (Workspace Admin Directory, Reports, Cloud
 * Identity policies, Chrome Management) are sensitive enough that the same
 * policy applies to BYO clients. When the cached access token expires, the
 * user re-runs the CLI login to consent again.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { cliInvocation } from '../cli_invocation.js'

/**
 * Reads and writes the OAuth-flow token cache file with a 0600 mode invariant.
 * The persisted shape contains `access_token`, `expiry_date`, `id_token`, and
 * `scope` only. Any `refresh_token` field on the input to `write()` is
 * dropped before persisting (see file-level comment for the policy).
 */
export class TokenCache {
  /**
   * Creates a TokenCache instance.
   * @param {string} filePath - The cache file path.
   */
  constructor(filePath) {
    this._path = filePath
  }

  /**
   * Reads the cache file. Returns null when the file does not exist.
   * @returns {Promise<object|null>} The parsed token object, or null if file does not exist.
   */
  async read() {
    try {
      const buf = await fs.readFile(this._path, 'utf8')
      return JSON.parse(buf)
    } catch (err) {
      if (err.code === 'ENOENT') {
        return null
      }
      throw err
    }
  }

  /**
   * Writes the cache file with mode 0600. Strips `refresh_token` before
   * persisting (the cache is access-token-only by policy; see file header).
   * Creates parent directories as needed.
   * @param {object} tokens - The token object to persist.
   * @returns {Promise<void>} Resolves when the file has been written.
   */
  async write(tokens) {
    const safe = { ...tokens }
    delete safe.refresh_token
    await fs.mkdir(path.dirname(this._path), { recursive: true })
    await fs.writeFile(this._path, JSON.stringify(safe, null, 2), { mode: 0o600 })
    await fs.chmod(this._path, 0o600)
  }

  /**
   * Deletes the cache file if it exists.
   * @returns {Promise<void>} Resolves when the file has been deleted.
   */
  async clear() {
    try {
      await fs.unlink(this._path)
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err
      }
    }
  }

  /**
   * Returns true when the cache file's mode is exactly 0600 (no group/other access).
   * @returns {Promise<boolean>} True if the file mode is 0600, false otherwise.
   */
  async modeIsTight() {
    try {
      const stat = await fs.stat(this._path)
      return (stat.mode & 0o077) === 0
    } catch {
      return true
    }
  }

  /**
   * Reads the cache and rejects when the file mode is loose. Returns null when
   * the file is absent.
   * @returns {Promise<object|null>} The parsed token object, or null when missing.
   * @throws {Error} When the file exists but has group- or other-readable bits.
   */
  async readEnforcingMode() {
    const tokens = await this.read()
    if (!tokens) {
      return null
    }
    if (!(await this.modeIsTight())) {
      throw new Error(
        `OAuth token cache at ${this._path} has loose permissions; ` +
          `refusing to read. Run \`chmod 600 ${this._path}\` to tighten it, ` +
          `or re-run \`${cliInvocation('auth login')}\` to recreate the file with mode 0600.`,
      )
    }
    return tokens
  }

  /**
   * The default cache path: ~/.config/cep-mcp/tokens.json on Unix-like systems,
   * %APPDATA%/cep-mcp/tokens.json on Windows.
   * @returns {string} The default cache file path.
   */
  static defaultPath() {
    if (process.platform === 'win32') {
      return path.join(process.env.APPDATA || '', 'cep-mcp', 'tokens.json')
    }
    return path.join(process.env.HOME || '', '.config', 'cep-mcp', 'tokens.json')
  }
}
