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

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { classifyBearer } from '../../lib/util/credential/jwt_classify.js'

describe('classifyBearer', () => {
  it('When the token is opaque (no dots), then it returns access', () => {
    assert.equal(classifyBearer('ya29.a0AfH6SMB...'), 'access')
  })

  it('When the token is a JWT with a scope claim, then it returns access', () => {
    const token = makeJwt({ scope: 'https://www.googleapis.com/auth/cloud-platform' })
    assert.equal(classifyBearer(token), 'access')
  })

  it('When the token is a JWT with email and no scope, then it returns id', () => {
    const token = makeJwt({ email: 'tim@example.com' })
    assert.equal(classifyBearer(token), 'id')
  })

  it('When the token is malformed JWT shape, then it returns access (treat as opaque)', () => {
    assert.equal(classifyBearer('not.a.valid.jwt.with.too.many.dots'), 'access')
  })

  it('When the JWT payload is unparseable base64, then it returns access', () => {
    assert.equal(classifyBearer('header.@@@invalid@@@.signature'), 'access')
  })

  it('When the JWT has both email and scope, then scope wins (treat as access)', () => {
    const token = makeJwt({ email: 'tim@example.com', scope: 'cloud-platform' })
    assert.equal(classifyBearer(token), 'access')
  })
})

function makeJwt(payload) {
  const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url')
  return `${b64({ alg: 'RS256' })}.${b64(payload)}.signature`
}
