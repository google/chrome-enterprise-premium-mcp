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

import fs from 'node:fs'
import os from 'node:os'
import { join } from 'node:path'
import { SCOPES } from '../../lib/constants.js'

/**
 * Redirects HOME (or APPDATA on Windows) to a temp directory containing a
 * synthetic, valid OAuth token cache covering the full required scope set,
 * and registers a cleanup hook for process exit. Used by test runners so the
 * tool-wrapper pre-flight in `lib/util/credential/auth_login.js#isTokenLocallyValid`
 * passes without reading the dev's real cache. Tests that target the
 * pre-flight itself override HOME inside their own setup.
 * @param {string} prefix - mkdtemp prefix used to disambiguate concurrent runners (e.g. 'cep-mcp-unit-home-').
 * @returns {string} The fake HOME path that was written.
 */
export function setupSyntheticTokenCache(prefix) {
  const homeKey = process.platform === 'win32' ? 'APPDATA' : 'HOME'
  const fakeHome = fs.mkdtempSync(join(os.tmpdir(), prefix))
  const cacheDir = process.platform === 'win32' ? join(fakeHome, 'cep-mcp') : join(fakeHome, '.config', 'cep-mcp')
  fs.mkdirSync(cacheDir, { recursive: true })
  fs.writeFileSync(
    join(cacheDir, 'tokens.json'),
    JSON.stringify({
      access_token: 'synthetic-test-token',
      token_type: 'Bearer',
      scope: Object.values(SCOPES).join(' '),
      expiry_date: Date.now() + 3_600_000,
    }),
    { mode: 0o600 },
  )
  process.env[homeKey] = fakeHome
  process.on('exit', () => {
    fs.rmSync(fakeHome, { recursive: true, force: true })
  })
  return fakeHome
}
