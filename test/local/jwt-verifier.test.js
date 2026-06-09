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

describe('verifyToken', () => {
  it('When token is missing, then it throws', async () => {
    const { verifyToken } = await esmock('../../lib/util/credential/jwt_verifier.js', {})
    await assert.rejects(() => verifyToken('', { expectedAudience: 'aud' }), /token is required/)
  })

  it('When expectedAudience is missing, then it throws', async () => {
    const { verifyToken } = await esmock('../../lib/util/credential/jwt_verifier.js', {})
    await assert.rejects(() => verifyToken('eyJhbGciOi...', { expectedAudience: '' }), /expectedAudience is required/)
  })

  it('When getTokenInfo (Path A) succeeds with matching audience, then it returns the principal', async () => {
    const { verifyToken } = await esmock('../../lib/util/credential/jwt_verifier.js', {
      'google-auth-library': {
        OAuth2Client: class {
          async getTokenInfo(token) {
            assert.equal(token, 'ACCESS_TOKEN')
            return {
              email: 'user@example.com',
              sub: 'user-123',
              aud: 'expected-aud',
            }
          }
          // Path B should not be reached
          async verifyIdToken() {
            assert.fail('Path B should not be reached when Path A succeeds')
          }
        },
      },
    })
    const principal = await verifyToken('ACCESS_TOKEN', { expectedAudience: 'expected-aud' })
    assert.deepEqual(principal, {
      email: 'user@example.com',
      sub: 'user-123',
      aud: 'expected-aud',
    })
  })

  it('When getTokenInfo (Path A) fails but verifyIdToken (Path B) succeeds, then it returns the principal', async () => {
    const { verifyToken } = await esmock('../../lib/util/credential/jwt_verifier.js', {
      'google-auth-library': {
        OAuth2Client: class {
          async getTokenInfo() {
            throw new Error('invalid_token (this is expected for JWTs)')
          }
          async verifyIdToken({ idToken, audience }) {
            assert.equal(idToken, 'ID_TOKEN')
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
    const principal = await verifyToken('ID_TOKEN', { expectedAudience: 'expected-aud' })
    assert.deepEqual(principal, {
      email: 'tim@example.com',
      sub: '123456',
      aud: 'expected-aud',
      iss: 'https://accounts.google.com',
    })
  })

  it('When Path A fails and Path B fails, then verifyToken propagates the Error from Path B', async () => {
    const { verifyToken } = await esmock('../../lib/util/credential/jwt_verifier.js', {
      'google-auth-library': {
        OAuth2Client: class {
          async getTokenInfo() {
            throw new Error('invalid_token')
          }
          async verifyIdToken() {
            throw new Error('Path B final failure')
          }
        },
      },
    })
    await assert.rejects(() => verifyToken('BAD_TOKEN', { expectedAudience: 'expected-aud' }), /Path B final failure/)
  })

  it('When Path A succeeds but audience mismatch, then verifyToken throws without falling back to Path B', async () => {
    const { verifyToken } = await esmock('../../lib/util/credential/jwt_verifier.js', {
      'google-auth-library': {
        OAuth2Client: class {
          async getTokenInfo() {
            return {
              aud: 'wrong-aud',
              email: 'user@example.com',
              sub: '123',
            }
          }
          async verifyIdToken() {
            assert.fail('Should not fall back to Path B if Path A audience check fails')
          }
        },
      },
    })
    await assert.rejects(
      () => verifyToken('ACCESS_TOKEN_WRONG_AUD', { expectedAudience: 'expected-aud' }),
      /invalid audience/,
    )
  })

  it('When Path A succeeds but no email, then verifyToken throws', async () => {
    const { verifyToken } = await esmock('../../lib/util/credential/jwt_verifier.js', {
      'google-auth-library': {
        OAuth2Client: class {
          async getTokenInfo() {
            return {
              aud: 'expected-aud',
              sub: '123',
            }
          }
        },
      },
    })
    await assert.rejects(() => verifyToken('ACCESS_TOKEN_NO_EMAIL', { expectedAudience: 'expected-aud' }), /no email/)
  })

  it('When Path B payload has no email, then verifyToken throws', async () => {
    const { verifyToken } = await esmock('../../lib/util/credential/jwt_verifier.js', {
      'google-auth-library': {
        OAuth2Client: class {
          async getTokenInfo() {
            throw new Error('not an access token')
          }
          async verifyIdToken() {
            return { getPayload: () => ({ sub: '123', aud: 'aud', iss: 'iss' }) }
          }
        },
      },
    })
    await assert.rejects(() => verifyToken('NO_EMAIL_ID_TOKEN', { expectedAudience: 'aud' }), /no email claim/)
  })
})
