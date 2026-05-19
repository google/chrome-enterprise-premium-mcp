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

import { describe, test } from 'node:test'
import assert from 'node:assert'
import { buildApiCredsField, buildScopesField, buildAuthRemediationLines } from '../../lib/util/auth_messages.js'
import { cliInvocation } from '../../lib/util/cli_invocation.js'
import { SCOPES } from '../../lib/constants.js'

const REQUIRED = Object.values(SCOPES)

const oauthMissing = {
  ok: false,
  source: 'oauth-flow',
  principal: null,
  credentialType: null,
  scopesKnown: false,
  missingScopes: REQUIRED,
  expiry: null,
}
const oauthValidAllScopes = {
  ok: true,
  source: 'oauth-flow',
  principal: 'tim@example.com',
  credentialType: 'managed',
  scopesKnown: true,
  missingScopes: [],
  expiry: null,
}
const oauthValidPartial = {
  ok: false,
  source: 'oauth-flow',
  principal: 'tim@example.com',
  credentialType: 'custom',
  scopesKnown: true,
  missingScopes: [SCOPES.CHROME_MANAGEMENT_POLICY, SCOPES.ADMIN_DIRECTORY_ORGUNIT_READONLY],
  expiry: null,
}

describe('buildScopesField', () => {
  test('When OAuth tokens are missing, then it surfaces a red status', () => {
    const field = buildScopesField(oauthMissing, REQUIRED)
    assert.match(field, /🔴/)
    assert.match(field, /OAuth tokens missing/i)
  })

  test('When all scopes are granted, then it shows OAuth label, principal, and N/N count', () => {
    const field = buildScopesField(oauthValidAllScopes, REQUIRED)
    assert.match(field, /🟢/)
    assert.match(field, /OAuth/)
    assert.match(field, /tim@example\.com/)
    assert.ok(field.includes(`${REQUIRED.length}/${REQUIRED.length}`), `expected "N/N scopes"; got: ${field}`)
  })

  test('When some scopes are missing, then it reports the exact missing-vs-required ratio', () => {
    const field = buildScopesField(oauthValidPartial, REQUIRED)
    assert.match(field, /🔴/)
    assert.ok(
      field.includes(`${oauthValidPartial.missingScopes.length} of ${REQUIRED.length}`),
      `expected "K of N missing"; got: ${field}`,
    )
    assert.match(field, /missing/i)
  })

  test('When probe has source bearer-access without scope info, then it shows Bearer label without scope count', () => {
    const probe = {
      ok: true,
      source: 'bearer-access',
      scopesKnown: false,
      missingScopes: [],
      principal: undefined,
    }
    const field = buildScopesField(probe, REQUIRED)
    assert.match(field, /🟢/)
    assert.match(field, /Bearer \(access\)/)
  })

  test('When probe has source bearer-id and ok is false, then it shows ID token rejected', () => {
    const probe = {
      ok: false,
      source: 'bearer-id',
      scopesKnown: false,
      missingScopes: [],
      principal: undefined,
    }
    const field = buildScopesField(probe, REQUIRED)
    assert.match(field, /🔴/)
    assert.match(field, /ID token/)
    assert.match(field, /rejected/i)
  })

  test('When probe has unknown source and ok is false, then it shows generic authentication failed', () => {
    const probe = {
      ok: false,
      source: 'unknown-source',
      scopesKnown: false,
      missingScopes: [],
      principal: undefined,
    }
    const field = buildScopesField(probe, REQUIRED)
    assert.match(field, /🔴/)
    assert.match(field, /authentication.*failed/i)
  })
})

describe('buildAuthRemediationLines', () => {
  test('When all scopes are granted, then it returns null and does not nag', () => {
    assert.strictEqual(buildAuthRemediationLines(oauthValidAllScopes, REQUIRED), null)
  })

  test('When OAuth tokens are missing, then it instructs the user to authorize with the CLI login command', () => {
    const lines = buildAuthRemediationLines(oauthMissing, REQUIRED)
    assert.match(lines[0], /no cached.*authorize/i)
    assert.strictEqual(lines[1], cliInvocation('auth login'))
  })

  test('When some scopes are missing, then it explains why and lists the gaps after the command', () => {
    const lines = buildAuthRemediationLines(oauthValidPartial, REQUIRED)
    assert.ok(
      lines[0].includes(`${oauthValidPartial.missingScopes.length} required scope`),
      `expected line to mention "${oauthValidPartial.missingScopes.length} required scope"; got: ${lines[0]}`,
    )
    assert.match(lines[0], /re-authorize/i)
    const missingHeaderIdx = lines.findIndex(l => l === 'Missing:')
    assert.ok(missingHeaderIdx > 0, 'expected a "Missing:" header listing the gaps')
    for (const scope of oauthValidPartial.missingScopes) {
      assert.ok(lines.includes(`  - ${scope}`), `expected missing scope listed verbatim: ${scope}`)
    }
  })
})

describe('buildApiCredsField', () => {
  const managedClient = { clientId: 'manageclientid', source: 'managed' }
  const customClient = { clientId: '1234567890abcdef', source: 'custom' }

  test('When tokens are cached and the client is managed, then it shows OAuth (Google-managed, principal)', () => {
    const [head, parens] = buildApiCredsField(oauthValidAllScopes, managedClient)
    assert.equal(head, 'OAuth')
    assert.match(parens, /Google-managed/)
    assert.match(parens, /tim@example\.com/)
  })

  test('When tokens are cached and the client is custom, then it shows OAuth (custom <id-excerpt>, principal)', () => {
    const [head, parens] = buildApiCredsField(oauthValidAllScopes, customClient)
    assert.equal(head, 'OAuth')
    assert.match(parens, /custom 12345678\.\.\./)
    assert.match(parens, /tim@example\.com/)
  })

  test('When no tokens are cached, then it shows OAuth (not configured, <client>)', () => {
    const [head, parens] = buildApiCredsField(oauthMissing, managedClient)
    assert.equal(head, 'OAuth')
    assert.match(parens, /not configured/)
    assert.match(parens, /Google-managed/)
  })

  test('When the OAuth client config could not be resolved, then the parens label it as "unresolved client"', () => {
    const [, parens] = buildApiCredsField(oauthValidAllScopes, null)
    assert.match(parens, /unresolved client/)
  })
})
