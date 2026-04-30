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
import {
  buildScopesField,
  buildAuthRemediationLines,
  buildQuotaProjectWarning,
  buildOAuthClientField,
  shellTokenize,
} from '../../lib/util/auth_messages.js'
import { SCOPES } from '../../lib/constants.js'

const REQUIRED = Object.values(SCOPES)

const adcMissing = {
  valid: false,
  email: null,
  missingScopes: [],
  scopesKnown: false,
  credentialType: null,
  quotaProject: null,
}
const adcValidAllScopes = {
  valid: true,
  email: 'sa@example.iam.gserviceaccount.com',
  missingScopes: [],
  scopesKnown: true,
  credentialType: 'JWT',
  quotaProject: null,
}
const adcValidPartial = {
  valid: true,
  email: 'user@example.com',
  missingScopes: [SCOPES.CHROME_MANAGEMENT_POLICY, SCOPES.ADMIN_DIRECTORY_ORGUNIT_READONLY],
  scopesKnown: true,
  credentialType: 'UserRefreshClient',
  quotaProject: 'my-project',
}
const adcValidScopesUnknown = {
  valid: true,
  email: null,
  missingScopes: [],
  scopesKnown: false,
  credentialType: 'UserRefreshClient',
  quotaProject: 'my-project',
}
const adcUserNoQuotaProject = {
  valid: true,
  email: 'user@example.com',
  missingScopes: [],
  scopesKnown: true,
  credentialType: 'UserRefreshClient',
  quotaProject: null,
}
const adcUserWithQuotaProject = {
  valid: true,
  email: 'user@example.com',
  missingScopes: [],
  scopesKnown: true,
  credentialType: 'UserRefreshClient',
  quotaProject: 'my-project',
}
const adcServiceAccountNoQuotaProject = {
  valid: true,
  email: 'sa@example.iam.gserviceaccount.com',
  missingScopes: [],
  scopesKnown: true,
  credentialType: 'JWT',
  quotaProject: null,
}

describe('buildScopesField', () => {
  test('When ADC is not configured, then it surfaces a red status without claiming validity', () => {
    const field = buildScopesField(adcMissing, REQUIRED)
    assert.match(field, /🔴/)
    assert.match(field, /not configured/i)
    assert.doesNotMatch(field, /All valid/, 'must not regress to the old "All valid" lie')
    assert.doesNotMatch(field, /granted/i, 'must not claim scopes are granted when ADC is missing')
  })

  test('When tokeninfo could not enumerate scopes, then it surfaces a yellow "unable to verify" status', () => {
    const field = buildScopesField(adcValidScopesUnknown, REQUIRED)
    assert.match(field, /🟡/)
    assert.match(field, /unable to verify/i)
    assert.doesNotMatch(field, /All .* granted/, 'must not claim all granted when scopes are unknown')
  })

  test('When every required scope is present, then it reports the count actually verified, not a hardcoded "all"', () => {
    const field = buildScopesField(adcValidAllScopes, REQUIRED)
    assert.match(field, /🟢/)
    assert.ok(field.includes(String(REQUIRED.length)), `field should include the verified scope count: ${field}`)
    assert.match(field, /granted/i)
  })

  test('When some scopes are missing, then it reports the exact missing-vs-required ratio', () => {
    const field = buildScopesField(adcValidPartial, REQUIRED)
    assert.match(field, /🔴/)
    assert.ok(
      field.includes(`${adcValidPartial.missingScopes.length} of ${REQUIRED.length}`),
      `expected "K of N missing"; got: ${field}`,
    )
    assert.match(field, /missing/i)
  })

  test('When probe has source adc with all scopes and principal, then it shows ADC label with principal', () => {
    const probe = {
      ok: true,
      source: 'adc',
      scopesKnown: true,
      missingScopes: [],
      principal: 'tim@example.com',
    }
    const field = buildScopesField(probe, REQUIRED)
    assert.match(field, /🟢/)
    assert.match(field, /ADC/)
    assert.match(field, /tim@example\.com/)
    assert.ok(field.includes(`${REQUIRED.length}/${REQUIRED.length}`), `expected "N/N scopes"; got: ${field}`)
  })

  test('When probe has source oauth-flow with all scopes and principal, then it shows OAuth label with principal', () => {
    const probe = {
      ok: true,
      source: 'oauth-flow',
      scopesKnown: true,
      missingScopes: [],
      principal: 'tim@example.com',
    }
    const field = buildScopesField(probe, REQUIRED)
    assert.match(field, /🟢/)
    assert.match(field, /OAuth/)
    assert.match(field, /tim@example\.com/)
    assert.ok(field.includes(`${REQUIRED.length}/${REQUIRED.length}`), `expected "N/N scopes"; got: ${field}`)
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
    assert.match(field, /Bearer/)
    assert.match(field, /\(access\)/)
    assert.doesNotMatch(field, /\d+\/\d+/, 'must not show scope count when scopesKnown is false')
  })

  test('When probe has source adc and ok is false, then it shows ADC not configured', () => {
    const probe = {
      ok: false,
      source: 'adc',
      scopesKnown: false,
      missingScopes: [],
      principal: undefined,
    }
    const field = buildScopesField(probe, REQUIRED)
    assert.match(field, /🔴/)
    assert.match(field, /ADC/)
    assert.match(field, /not configured/i)
  })

  test('When probe has source oauth-flow and ok is false, then it shows OAuth tokens missing', () => {
    const probe = {
      ok: false,
      source: 'oauth-flow',
      scopesKnown: false,
      missingScopes: [],
      principal: undefined,
    }
    const field = buildScopesField(probe, REQUIRED)
    assert.match(field, /🔴/)
    assert.match(field, /OAuth/)
    assert.match(field, /tokens.*missing/i)
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

  test('When probe has unknown source, then it shows generic authentication failed', () => {
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

  test('When probe has source adc, ok is true, but scopes unknown, then it shows unable to verify', () => {
    const probe = {
      ok: true,
      source: 'adc',
      scopesKnown: false,
      missingScopes: [],
      principal: 'tim@example.com',
    }
    const field = buildScopesField(probe, REQUIRED)
    assert.match(field, /🟡/)
    assert.match(field, /unable to verify/i)
  })

  test('When probe has source adc with missing scopes, then it reports the missing ratio', () => {
    const missingCount = 2
    const probe = {
      ok: true,
      source: 'adc',
      scopesKnown: true,
      missingScopes: [SCOPES.CHROME_MANAGEMENT_POLICY, SCOPES.ADMIN_DIRECTORY_ORGUNIT_READONLY],
      principal: 'tim@example.com',
    }
    const field = buildScopesField(probe, REQUIRED)
    assert.match(field, /🔴/)
    assert.ok(field.includes(`${missingCount} of ${REQUIRED.length}`), `expected "K of N missing"; got: ${field}`)
    assert.match(field, /missing/i)
  })

  test('When probe lacks source field, it falls back to legacy ADC behavior with valid field', () => {
    const legacyProbe = {
      valid: true,
      email: 'user@example.com',
      missingScopes: [],
      scopesKnown: true,
    }
    const field = buildScopesField(legacyProbe, REQUIRED)
    assert.match(field, /🟢/)
    assert.ok(field.includes(String(REQUIRED.length)), `field should include the verified scope count: ${field}`)
  })

  test('When probe lacks source but has ok field instead of valid, it treats ok as the status flag', () => {
    const probe = {
      ok: false,
      email: null,
      missingScopes: [],
      scopesKnown: false,
    }
    const field = buildScopesField(probe, REQUIRED)
    assert.match(field, /🔴/)
    assert.match(field, /ADC/)
    assert.match(field, /not configured/i)
  })
})

describe('buildAuthRemediationLines', () => {
  test('When all scopes are granted, then it returns null and does not nag', () => {
    assert.strictEqual(buildAuthRemediationLines(adcValidAllScopes, REQUIRED), null)
  })

  test('When ADC is missing, then it instructs the user to authorize and prints a paste-safe gcloud command', () => {
    const lines = buildAuthRemediationLines(adcMissing, REQUIRED)
    assert.ok(Array.isArray(lines), 'expected an array of lines')
    assert.match(lines[0], /not configured/i)
    assert.match(lines[0], /authorize/i)
    assert.strictEqual(lines[1], 'gcloud auth application-default login \\')
  })

  test('When some scopes are missing, then it explains why and lists the gaps after the command', () => {
    const lines = buildAuthRemediationLines(adcValidPartial, REQUIRED)
    assert.match(lines[0], new RegExp(`${adcValidPartial.missingScopes.length} required scope`))
    assert.match(lines[0], /re-authorize/i)
    const missingHeaderIdx = lines.findIndex(l => l === 'Missing:')
    assert.ok(missingHeaderIdx > 0, 'expected a "Missing:" header listing the gaps')
    for (const scope of adcValidPartial.missingScopes) {
      assert.ok(lines.includes(`  - ${scope}`), `expected missing scope listed verbatim: ${scope}`)
    }
  })

  test('When the printed command is shell-tokenized, then it produces exactly one --scopes argv with no internal whitespace', () => {
    const lines = buildAuthRemediationLines(adcMissing, REQUIRED)
    const commandText = lines.slice(1).join('\n')
    const tokens = shellTokenize(commandText)
    assert.deepStrictEqual(tokens.slice(0, 4), ['gcloud', 'auth', 'application-default', 'login'])
    assert.strictEqual(
      tokens.length,
      5,
      `expected exactly 5 argv tokens (gcloud auth application-default login --scopes=...); got ${tokens.length}: ${JSON.stringify(tokens)}`,
    )
    assert.ok(tokens[4].startsWith('--scopes='), `expected --scopes flag, got: ${tokens[4]}`)
    assert.doesNotMatch(
      tokens[4],
      /\s/,
      '--scopes value must not contain whitespace; that would make gcloud reject the trailing URLs as positional args',
    )
  })

  test('When the command is shell-tokenized, then the --scopes value contains every required scope and nothing extra', () => {
    const lines = buildAuthRemediationLines(adcMissing, REQUIRED)
    const tokens = shellTokenize(lines.slice(1).join('\n'))
    const scopeArg = tokens[4].slice('--scopes='.length)
    const printedScopes = scopeArg.split(',')
    assert.deepStrictEqual(
      printedScopes.slice().sort(),
      REQUIRED.slice().sort(),
      'printed --scopes value must enumerate every scope in lib/constants.js#SCOPES exactly once',
    )
  })

  test('When the command is shell-tokenized, then every scope other than openid is a full URL — short-form scopes break gcloud', () => {
    // Regression: bare 'email' makes gcloud's application-default login abort
    // with "Scope has changed from … to https://…/auth/userinfo.email" because
    // the token endpoint rewrites short-form OIDC scopes to canonical URLs
    // and gcloud strictly compares the request set to the response set.
    // openid is the documented exception — it is returned verbatim.
    const lines = buildAuthRemediationLines(adcMissing, REQUIRED)
    const tokens = shellTokenize(lines.slice(1).join('\n'))
    const printedScopes = tokens[4].slice('--scopes='.length).split(',')
    for (const scope of printedScopes) {
      if (scope === 'openid') {
        continue
      }
      assert.match(
        scope,
        /^https:\/\/www\.googleapis\.com\/auth\//,
        `scope "${scope}" must be a full googleapis.com/auth/ URL; short-form scopes trigger gcloud's "Scope has changed" abort`,
      )
    }
  })
})

describe('buildOAuthClientField', () => {
  test('When source is managed, then it returns "OAuth client: Google-managed"', () => {
    assert.equal(
      buildOAuthClientField({ clientId: 'a', clientSecret: 'b', source: 'managed' }),
      'OAuth client: Google-managed',
    )
  })
  test('When source is custom, then it returns "OAuth client: custom (<first 8 chars>...)"', () => {
    assert.equal(
      buildOAuthClientField({ clientId: '1234567890abcdef', clientSecret: 'b', source: 'custom' }),
      'OAuth client: custom (12345678...)',
    )
  })
  test('When the custom client_id is shorter than 8 chars, then it returns the full id followed by ...', () => {
    assert.equal(
      buildOAuthClientField({ clientId: 'short', clientSecret: 'b', source: 'custom' }),
      'OAuth client: custom (short...)',
    )
  })
  test('When config is null, then it returns a TODO line flagging the unprovisioned managed client', () => {
    const text = buildOAuthClientField(null)
    assert.match(text, /TODO/)
    assert.match(text, /CEP_OAUTH_CLIENT_ID/)
  })
})

describe('buildQuotaProjectWarning', () => {
  test('When ADC is not configured, then it returns null — the auth remediation block handles that case first', () => {
    assert.strictEqual(buildQuotaProjectWarning(adcMissing), null)
  })

  test('When the user already set a quota project on ADC, then no warning is needed', () => {
    assert.strictEqual(buildQuotaProjectWarning(adcUserWithQuotaProject), null)
  })

  test('When the credential is a service account, then no warning is needed because the SA carries its own project', () => {
    assert.strictEqual(buildQuotaProjectWarning(adcServiceAccountNoQuotaProject), null)
  })

  test('When user ADC has no quota project, then it explains the requirement, links to the project selector, and prints the gcloud command', () => {
    const lines = buildQuotaProjectWarning(adcUserNoQuotaProject)
    assert.ok(Array.isArray(lines), 'expected an array of lines')
    assert.match(lines[0], /quota project/i, 'first line should frame this as a quota-project requirement')
    assert.doesNotMatch(lines[0], /billing project/i, 'must say "quota project", not "billing project"')
    const linkLine = lines.find(l => /\bconsole\.cloud\.google\.com\b/.test(l))
    assert.ok(linkLine, `expected a link to the cloud console project selector; got: ${JSON.stringify(lines)}`)
    const cmdLine = lines.find(l => l.startsWith('gcloud auth application-default set-quota-project'))
    assert.ok(cmdLine, `expected the set-quota-project command; got: ${JSON.stringify(lines)}`)
  })

  test('When the gcloud command is shell-tokenized, then it produces exactly 5 argv tokens with an ALL_CAPS placeholder project id', () => {
    const lines = buildQuotaProjectWarning(adcUserNoQuotaProject)
    const cmdLine = lines.find(l => l.startsWith('gcloud auth application-default set-quota-project'))
    const tokens = shellTokenize(cmdLine)
    assert.deepStrictEqual(tokens.slice(0, 4), ['gcloud', 'auth', 'application-default', 'set-quota-project'])
    assert.strictEqual(
      tokens.length,
      5,
      `expected exactly 5 argv tokens; got ${tokens.length}: ${JSON.stringify(tokens)}`,
    )
    assert.match(
      tokens[4],
      /^[A-Z_]+$/,
      `placeholder should be ALL_CAPS so users notice they need to substitute it; got "${tokens[4]}"`,
    )
  })
})
