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
 * @file Unit tests for the JWT verifier. Mocks google-auth-library so the
 * tests never need network access or real JWKS lookups.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import esmock from 'esmock'

import { parseExpectedAudience } from '../../lib/util/credential/jwt_verifier.js'

describe('parseExpectedAudience', () => {
  it('When env var is undefined, then result is undefined', () => {
    assert.equal(parseExpectedAudience(undefined), undefined)
  })

  it('When env var is empty, then result is undefined', () => {
    assert.equal(parseExpectedAudience(''), undefined)
    assert.equal(parseExpectedAudience('  '), undefined)
  })

  it('When env var has one value, then result is the string', () => {
    assert.equal(
      parseExpectedAudience('client-id-1.apps.googleusercontent.com'),
      'client-id-1.apps.googleusercontent.com',
    )
  })

  it('When env var is comma-separated, then result is the array', () => {
    assert.deepEqual(parseExpectedAudience('a.example.com, b.example.com'), ['a.example.com', 'b.example.com'])
  })

  it('When env var has trailing commas, then result is the trimmed list', () => {
    assert.deepEqual(parseExpectedAudience('a, b,, c,'), ['a', 'b', 'c'])
  })
})

describe('verifyIdToken', () => {
  it('When token is missing, then it throws', async () => {
    const { verifyIdToken } = await esmock('../../lib/util/credential/jwt_verifier.js', {})
    await assert.rejects(() => verifyIdToken('', { expectedAudience: 'aud' }), /token is required/)
  })

  it('When expectedAudience is missing, then it throws', async () => {
    const { verifyIdToken } = await esmock('../../lib/util/credential/jwt_verifier.js', {})
    await assert.rejects(() => verifyIdToken('eyJhbGciOi...', { expectedAudience: '' }), /expectedAudience is required/)
  })

  it('When verifyIdToken succeeds with a valid payload, then it returns the principal', async () => {
    const { verifyIdToken } = await esmock('../../lib/util/credential/jwt_verifier.js', {
      'google-auth-library': {
        OAuth2Client: class {
          async verifyIdToken({ idToken, audience }) {
            assert.equal(idToken, 'GOOD_TOKEN')
            assert.equal(audience, 'expected-aud')
            return {
              getPayload: () => ({
                email: 'tim@example.com',
                sub: '123456',
                aud: 'expected-aud',
                iss: 'https://accounts.google.com',
              }),
            }
          }
        },
      },
    })
    const principal = await verifyIdToken('GOOD_TOKEN', { expectedAudience: 'expected-aud' })
    assert.deepEqual(principal, {
      email: 'tim@example.com',
      sub: '123456',
      aud: 'expected-aud',
      iss: 'https://accounts.google.com',
    })
  })

  it('When the underlying verifier throws, then verifyIdToken propagates the error', async () => {
    const { verifyIdToken } = await esmock('../../lib/util/credential/jwt_verifier.js', {
      'google-auth-library': {
        OAuth2Client: class {
          async verifyIdToken() {
            throw new Error('Wrong recipient, payload audience != requiredAudience')
          }
        },
      },
    })
    await assert.rejects(() => verifyIdToken('BAD_TOKEN', { expectedAudience: 'expected-aud' }), /Wrong recipient/)
  })

  it('When the payload has no email, then verifyIdToken throws', async () => {
    const { verifyIdToken } = await esmock('../../lib/util/credential/jwt_verifier.js', {
      'google-auth-library': {
        OAuth2Client: class {
          async verifyIdToken() {
            return { getPayload: () => ({ sub: '123', aud: 'aud', iss: 'iss' }) }
          }
        },
      },
    })
    await assert.rejects(() => verifyIdToken('NO_EMAIL_TOKEN', { expectedAudience: 'aud' }), /no email claim/)
  })
})
