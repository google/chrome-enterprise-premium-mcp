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

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { formatStatus } from '../../../tools/utils/wrapper.js'

describe('Tool Utils - formatStatus', () => {
  test('When input is null or undefined, then it returns "Unknown"', () => {
    assert.strictEqual(formatStatus(null), 'Unknown')
    assert.strictEqual(formatStatus(undefined), 'Unknown')
    assert.strictEqual(formatStatus(''), 'Unknown')
  })

  test('When input is in SNAKE_CASE, then it is converted to Title Case with spaces', () => {
    assert.strictEqual(formatStatus('ACTIVE'), 'Active')
    assert.strictEqual(formatStatus('PARTIALLY_ENFORCED'), 'Partially Enforced')
    assert.strictEqual(formatStatus('ACTIVE_SCANNING'), 'Active Scanning')
  })

  test('When input is already Title Case or mixed case, then it is normalized correctly', () => {
    assert.strictEqual(formatStatus('Active'), 'Active')
    assert.strictEqual(formatStatus('partially enforced'), 'Partially Enforced')
  })

  test('When input contains multiple underscores, then they are all replaced with spaces', () => {
    assert.strictEqual(formatStatus('VERY_DEEPLY_NESTED_STATE'), 'Very Deeply Nested State')
  })

  test('When input is not a string, then it is converted to a string and formatted', () => {
    assert.strictEqual(formatStatus(true), 'True')
  })
})
